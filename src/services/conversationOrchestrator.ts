import {
  ConversationFlows,
  ConversationFlowsType,
} from "../config/conversationFlow";
import { getSession, updateSession, clearSession } from "./sessionManager";
import { getMissingSlots, mergeEntities } from "../utils/slotUtils";
import { createBooking, buildBookingSummary } from "./bookingService";

/**
 * 🧠 Barberbook Conversation Orchestrator (Final Version)
 * -------------------------------------------------------
 * - Semua intent (booking & informasi) diproses via ConversationFlows.
 * - Tidak lagi menggunakan handleInfoIntent / isInfoIntent.
 * - Mendukung context inheritance dan automatic state transition.
 */
export async function runConversationOrchestrator(
  userId: string,
  intent: string,
  entities: Record<string, any> = {}
) {
  // 🧩 [1] Ambil session aktif (jika ada)
  const session = await getSession(userId);
  let currentIntent = session?.data?.intent || intent;
  let currentState = session?.state || "idle";
  let currentData = session?.data || {};

  // 🧠 [2] Context Carry-Over: gunakan intent lama jika yang baru tidak jelas
  if (
    (intent === "unknown" || intent === "unknown_intent") &&
    currentIntent &&
    currentIntent !== "unknown" &&
    currentIntent !== "unknown_intent"
  ) {
    intent = currentIntent;
  }

  // 🔁 [3] Context Inheritance: isi entity kosong dari session sebelumnya
  for (const key of Object.keys(currentData)) {
    if (entities[key] === null || entities[key] === undefined) {
      entities[key] = currentData[key];
    }
  }

  // 🚀 [4] Auto-switch antar flow:
  // jika intent berbeda dari sesi sebelumnya, reset session (fresh start)
  if (session && session.data?.intent && session.data.intent !== intent) {
    await clearSession(userId);
    currentData = {};
    currentState = "idle";
  }

  // 🧩 [5] Ambil flow berdasarkan intent aktif
  const flow = ConversationFlows[intent];
  if (!flow) {
    return {
      reply: "Maaf, aku belum paham maksudmu 😅.",
      nextState: "idle",
      data: {},
      mode: "unknown_intent",
    };
  }

  // 🔗 [6] Merge entity lama + baru
  const mergedEntities = mergeEntities(currentData, entities);

  // 🎯 [7] Cari slot wajib yang belum terisi
  const missingSlots = getMissingSlots(
    mergedEntities,
    flow.required_slots || []
  );

  // 🧩 [8] Jika masih ada slot kosong → tanya 1 per 1
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

  // ✅ [9] Semua slot sudah terisi → cari state dengan nama "review_booking" (kalau ada)
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

  // ✅ [10] Jika intent adalah confirm_booking → simpan booking & akhiri flow
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

      const booking = await createBooking(bookingData);
      await clearSession(userId);

      return {
        reply: buildBookingSummary(booking),
        nextState: "completed",
        mode: "completed",
      };
    }
  }

  // ✅ [11] Jika flow punya state tunggal (misal intent informasi seperti ask_prices)
  const infoState = flow.states.find((s) => s.trigger.includes(intent));
  if (infoState && infoState.action?.message) {
    const message = fillTemplate(infoState.action.message, mergedEntities);

    await clearSession(userId); // intent info → one-shot, tidak perlu simpan sesi
    return {
      reply: message,
      nextState: "idle",
      data: mergedEntities,
      mode: "info",
    };
  }

  // ❌ [12] Fallback terakhir
  return {
    reply:
      "Tolong jelaskan sekali lagi ? Saya masih belum menangkap maksudnya 😊",
    nextState: currentState,
    data: mergedEntities,
    mode: "fallback",
  };
}

/* -------------------------------------------------------------------------- */
/* 🧩 Utility Functions */
/* -------------------------------------------------------------------------- */

/**
 * Utility untuk mengganti {{entity}} di template pesan
 */
function fillTemplate(template: string, data: Record<string, any>) {
  return template.replace(/{{(.*?)}}/g, (_, key) => {
    const k = key.trim();
    return data[k] ?? "";
  });
}
