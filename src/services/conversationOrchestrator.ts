import {
  ConversationFlows,
  ConversationFlowsType,
} from "../config/conversationFlow";
import { getSession, updateSession, clearSession } from "./sessionManager";
import { getMissingSlots, mergeEntities } from "../utils/slotUtils";
import { createBooking, buildBookingSummary } from "./bookingService";

/**
 * Refactored Conversation Orchestrator
 *
 * Goals:
 * - Soft intent switching (don't clear session aggressively)
 * - Preserve useful context when user asks info in the middle of a booking
 * - Support stateless one-shot info intents without losing booking context
 * - Merge "parent" required slots when switching between related flows
 */

const STATELESS_INTENTS = [
  // ADJUSTMENT: intents that should be handled as one-shot info replies
  "ask_services",
  "ask_prices",
  "ask_queue_status",
  "help",
];

export async function runConversationOrchestrator(
  userId: string,
  intent: string,
  entities: Record<string, any> = {}
) {
  // [1] Ambil session aktif (jika ada)
  const session = await getSession(userId);
  let currentIntent = session?.data?.intent || intent;
  let currentState = session?.state || "idle";
  let currentData = session?.data || {};

  // [2] If the incoming intent is unclear, keep previous intent (context carry-over)
  if (
    (intent === "unknown" || intent === "unknown_intent") &&
    currentIntent &&
    currentIntent !== "unknown" &&
    currentIntent !== "unknown_intent"
  ) {
    intent = currentIntent;
  }

  // [3] Context inheritance: fill missing incoming entities with session data
  // ADJUSTMENT: perform inheritance BEFORE any potential soft-switch
  for (const key of Object.keys(currentData)) {
    if (entities[key] === null || entities[key] === undefined) {
      entities[key] = currentData[key];
    }
  }

  // [4] Soft-switch policy (ADJUSTMENT):
  // - If intent changed and both intents are related to booking flows, do not fully clear session.
  // - If intent is unrelated and we explicitly want a fresh start, clear session.
  // The previous behavior always cleared session on intent change which caused context loss.
  const prevIntent = session?.data?.intent || null;
  const isBookingRelated = (i: string | null) =>
    !!i && ["start_booking", "ask_availability", "confirm_booking"].includes(i);

  if (session && prevIntent && prevIntent !== intent) {
    if (isBookingRelated(prevIntent) && isBookingRelated(intent)) {
      // ADJUSTMENT: keep session data (soft transfer), just reset state to idle
      // We keep currentData to allow inheritance and continue slot-filling.
      currentState = "idle";
      // do NOT clear session here so partial entities are preserved
    } else if (STATELESS_INTENTS.includes(intent)) {
      // ADJUSTMENT: allow stateless info intents without destroying booking context
      // we will handle stateless intent below as one-shot; preserve session
    } else {
      // For unrelated intents that should start fresh, clear session.
      // This preserves safety: unrelated flows won't mix contexts.
      await clearSession(userId);
      currentData = {};
      currentState = "idle";
    }
  }

  // [5] Load flow config for the active intent
  const flow = ConversationFlows[intent];
  if (!flow) {
    return {
      reply: "Maaf, aku belum paham maksudmu 😅.",
      nextState: "idle",
      data: {},
      mode: "unknown_intent",
    };
  }

  // [6] Merge session data + incoming entities (canonicalized)
  const mergedEntities = mergeEntities(currentData, entities);

  // [7] Special handling for stateless/info intents (ADJUSTMENT):
  // If intent is stateless and flow is a simple one-shot (no required slots),
  // reply immediately using flow state's template but DO NOT clear user's booking session.
  if (STATELESS_INTENTS.includes(intent)) {
    // find a state whose trigger includes this intent (common pattern in flows)
    const infoState =
      flow.states.find((s) => (s.trigger || []).includes(intent)) ||
      flow.states.find(
        (s) => s.name === "respond_info" || s.name === "respond_help"
      );

    if (infoState && infoState.action?.message) {
      const message = fillTemplate(infoState.action.message, mergedEntities);

      // ADJUSTMENT: preserve session (do not clear) so booking context remains if user had one
      return {
        reply: message,
        nextState: "idle",
        data: mergedEntities,
        mode: "info",
      };
    }
  }

  // [8] If switching between related flows (e.g. ask_availability -> start_booking),
  // merge required slots from previous flow to reduce redundant questions (ADJUSTMENT).
  let requiredSlots = flow.required_slots || [];
  if (prevIntent && prevIntent !== intent) {
    const prevFlow = ConversationFlows[prevIntent];
    if (prevFlow) {
      // ADJUSTMENT: union of required slots from both flows to avoid re-asking filled slots
      requiredSlots = Array.from(
        new Set([...(prevFlow.required_slots || []), ...requiredSlots])
      );
    }
  }

  // [9] Evaluate missing slots using the (possibly merged) requiredSlots
  const missingSlots = getMissingSlots(mergedEntities, requiredSlots || []);

  // [10] If there are missing slots, ask the next one (slot-filling)
  if (missingSlots.length > 0) {
    const nextSlot = missingSlots[0];
    const nextState = `awaiting_${nextSlot}`;
    const next = flow.states.find((s) => s.name === nextState);

    if (next) {
      // ADJUSTMENT: persist partial mergedEntities in session so it won't be lost
      await updateSession(userId, nextState, {
        intent,
        ...mergedEntities,
      });

      return {
        reply: next.action.message,
        nextState,
        data: mergedEntities,
        mode: "slot_filling",
      };
    } else {
      // fallback if flow doesn't define that waiting-state name
      await updateSession(userId, currentState, {
        intent,
        ...mergedEntities,
      });
      return {
        reply:
          "Untuk melanjutkan, bisa sebutkan detail yang diminta ya? (mis. nama, layanan, tanggal, atau jam)",
        nextState: currentState,
        data: mergedEntities,
        mode: "slot_filling",
      };
    }
  }

  // [11] All required slots satisfied → proceed to review or the flow's next action
  if (missingSlots.length === 0) {
    const review = flow.states.find((s) => s.name === "review_booking");
    if (review) {
      const message = fillTemplate(review.action.message, mergedEntities);
      // ADJUSTMENT: update session to review state (store entities)
      await updateSession(userId, "review_booking", {
        intent,
        ...mergedEntities,
      });

      return {
        reply: message,
        nextState: "review_booking",
        data: mergedEntities,
        mode: "review",
      };
    }
  }

  // [12] If user explicitly confirms booking -> create booking, clear session and reply
  if (intent === "confirm_booking") {
    const confirmFlow = ConversationFlows["confirm_booking"];
    const confirm = confirmFlow?.states.find((s) => s.name === "confirm");

    if (confirm) {
      const bookingData = {
        user_id: userId,
        customer_name: mergedEntities.customer_name,
        service_name: mergedEntities.service_name,
        date: mergedEntities.date,
        time: mergedEntities.time,
        barber_name: mergedEntities.barber_name || null,
        payment_method: mergedEntities.payment_method || null,
      };

      // Create booking in DB
      const booking = await createBooking(bookingData);

      // ADJUSTMENT: clear session only AFTER booking persisted
      await clearSession(userId);

      // Use summary builder for dynamic confirmation message
      const summary = buildBookingSummary(booking);

      return {
        reply: summary,
        nextState: "completed",
        data: {},
        mode: "completed",
      };
    }
  }

  // [13] If flow defines a direct response state triggered by this intent, return it
  // (useful for flows that don't require slot filling)
  const directState = flow.states.find((s) =>
    (s.trigger || []).includes(intent)
  );
  if (directState && directState.action?.message) {
    const message = fillTemplate(directState.action.message, mergedEntities);

    // ADJUSTMENT: for non-booking direct responses we preserve session (do not clear)
    // but if the flow is confirm_booking we already handled it above.
    return {
      reply: message,
      nextState: "idle",
      data: mergedEntities,
      mode: "info",
    };
  }

  // [14] Final fallback
  return {
    reply:
      "Bisa tolong dijelaskan lebih jelas? Saya belum menangkap maksudnya 😊",
    nextState: currentState,
    data: mergedEntities,
    mode: "fallback",
  };
}

/* -------------------------------------------------------------------------- */
/* Utility: replace {{field}} in templates */
function fillTemplate(template: string, data: Record<string, any>) {
  return template.replace(/{{(.*?)}}/g, (_, key) => {
    const k = key.trim();
    return data[k] ?? "";
  });
}
