import {
  ConversationFlows,
  ConversationFlowsType,
} from "../config/conversationFlow";
import { getSession, updateSession, clearSession } from "./sessionManager";
import { getMissingSlots, mergeEntities } from "../utils/slotUtils";
import { createBooking } from "./bookingService";

/**
 * Daftar intent yang masih termasuk dalam konteks booking
 * Jadi meskipun AI mendeteksi intent lain, sistem tetap di flow 'start_booking'
 */
const RELATED_BOOKING_INTENTS = [
  "start_booking",
  "provide_information",
  "ask_availability",
  "confirm_booking",
];

export async function runConversationOrchestrator(
  userId: string,
  intent: string,
  entities: Record<string, any> = {}
) {
  // Ambil session aktif
  const session = await getSession(userId);

  let currentIntent = session?.data?.intent || intent;
  let currentState = session?.state || "idle";
  let currentData = session?.data || {};

  // 🧠 Jika sedang dalam flow booking dan intent masih berhubungan, pertahankan
  if (
    session &&
    session.data?.intent === "start_booking" &&
    RELATED_BOOKING_INTENTS.includes(intent)
  ) {
    // Biarkan confirm_booking lewat sebagai flow baru
    if (intent !== "confirm_booking") {
      intent = "start_booking";
    }
  }

  // Jika intent sekarang unknown tapi sesi masih aktif → pakai intent lama
  if (
    (intent === "unknown" || intent === "unknown_intent") &&
    currentIntent &&
    currentIntent !== "unknown" &&
    currentIntent !== "unknown_intent"
  ) {
    intent = currentIntent;
  }

  let flow = ConversationFlows[intent];
  if (!flow) {
    return {
      reply: "Maaf, aku belum paham maksudmu 😅.",
      nextState: "idle",
      data: {},
      mode: "unknown_intent",
    };
  }

  // Gabungkan entity lama dan baru
  const mergedEntities = mergeEntities(currentData, entities);

  // Ambil daftar slot wajib dari flow
  const missingSlots = getMissingSlots(
    mergedEntities,
    flow.required_slots || []
  );

  // Jika masih ada slot kosong → tanya satu per satu
  if (missingSlots.length > 0) {
    const nextSlot = missingSlots[0];
    const nextState = `awaiting_${nextSlot}`;
    const next = flow.states.find((s) => s.name === nextState);

    if (next) {
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
    }
  }

  // ✅ Semua slot terisi → review
  if (missingSlots.length === 0) {
    const review = flow.states.find((s) => s.name === "review_booking");
    if (review) {
      const message = fillTemplate(review.action.message, mergedEntities);
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

  // ✅ Tangani redirect ke confirm_booking flow
  if (flow.intent === "start_booking" && intent === "confirm_booking") {
    flow = ConversationFlows["confirm_booking"];
    const confirm = flow.states.find((s) => s.name === "confirm");

    if (confirm) {
      await clearSession(userId);
      return {
        reply: confirm.action.message,
        nextState: "completed",
        data: mergedEntities,
        mode: "completed",
      };
    }
  }

  // ✅ Jika intent memang confirm_booking sejak awal
  if (intent === "confirm_booking") {
    const confirmFlow = ConversationFlows["confirm_booking"];
    const confirm = confirmFlow.states.find((s) => s.name === "confirm");
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

      // FOR NOW DISABLED CREATE BOOKING
      await createBooking(bookingData);

      await clearSession(userId);
      return {
        reply: confirm.action.message,
        nextState: "completed",
        mode: "completed",
      };
    }
  }

  // ❌ Default fallback
  return {
    reply:
      "Bisa tolong jelaskan lebih jelas? Saya belum menangkap maksudnya 😊",
    nextState: currentState,
    data: mergedEntities,
    mode: "fallback",
  };
}

/**
 * Utility untuk mengisi template dengan data entity
 */
function fillTemplate(template: string, data: Record<string, any>) {
  return template.replace(/{{(.*?)}}/g, (_, key) => {
    const k = key.trim();
    return data[k] ?? "";
  });
}
