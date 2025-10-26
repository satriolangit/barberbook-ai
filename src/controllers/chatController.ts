import { Request, Response } from "express";
import { analyzeMessage } from "../services/geminiOrchestrator";
import { runConversationOrchestrator } from "../services/conversationOrchestrator";
import { saveLog } from "../services/logService";
import { updateSession, clearSession } from "../services/sessionManager";

export async function simulateChat(req: Request, res: Response) {
  try {
    const userId = req.body.user_id || req.body.phone || "unknown_user";
    const userMessage = req.body.message?.trim();

    if (!userMessage) {
      return res.status(400).json({ error: "Message is required" });
    }

    // 🧾 [1] Simpan pesan user ke log
    await saveLog(userId, "user", userMessage, "pending", null);

    // 🤖 [2] Analisis pesan menggunakan Gemini (AI intent + entities)
    const { intent, entities, direct_reply } = await analyzeMessage(
      userMessage,
      userId
    );

    // 💬 [3] Jika AI mengembalikan smalltalk atau direct reply → balas langsung
    if (intent === "smalltalk" && (direct_reply || entities?.direct_reply)) {
      const replyText =
        direct_reply ||
        entities?.direct_reply ||
        "Baik, ada yang bisa saya bantu lagi?";
      await saveLog(userId, "assistant", direct_reply, intent, {});
      return res.json({
        reply: replyText,
        intent,
        entities,
        mode: "direct_reply",
        next_state: "idle",
      });
    }

    // ❓ [4] Jika intent tidak diketahui → fallback
    if (!intent || intent === "unknown_intent") {
      const fallback =
        "Saya belum memahami maksud Anda 😅 Bisa dijelaskan sedikit lebih detail?";
      await saveLog(userId, "assistant", fallback, "unknown_intent", {});
      return res.json({
        reply: fallback,
        intent: "unknown_intent",
        entities: {},
        mode: "fallback",
        next_state: "idle",
      });
    }

    // 🧠 [5] Jalankan Conversation Orchestrator (slot filling / flow logic)
    const result = await runConversationOrchestrator(userId, intent, entities);

    // 🗂️ [6] Simpan response bot ke log
    await saveLog(userId, "assistant", result.reply, intent, result.data);

    // 🔄 [7] Update atau hapus session sesuai status
    if (result.mode === "completed" || result.nextState === "idle") {
      await clearSession(userId);
    } else {
      await updateSession(userId, result.nextState, {
        intent,
        ...result.data,
      });
    }

    // 📤 [8] Kirim hasil ke frontend
    return res.json({
      reply: result.reply,
      intent,
      entities: result.data,
      mode: result.mode,
      next_state: result.nextState,
    });
  } catch (err) {
    console.error("❌ Error in handleChat:", err);
    return res.status(500).json({ error: "Internal Server Error" });
  }
}
