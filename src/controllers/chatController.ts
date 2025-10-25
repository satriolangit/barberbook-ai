import { Request, Response } from "express";
import { analyzeMessage } from "../services/geminiOrchestrator";
import { runConversationOrchestrator } from "../services/conversationOrchestrator";
import pool from "../config/db";

function sanitizeResponse(raw: any) {
  if (!raw) return null;

  if (typeof raw === "object" && raw.intent) return raw;

  if (typeof raw === "string") {
    const cleaned = raw
      .replace(/```json/i, "")
      .replace(/```/g, "")
      .trim();
    try {
      return JSON.parse(cleaned);
    } catch {
      return { direct_reply: cleaned };
    }
  }

  if (raw.direct_reply) {
    const cleaned = raw.direct_reply
      .replace(/```json/i, "")
      .replace(/```/g, "")
      .trim();
    try {
      return JSON.parse(cleaned);
    } catch {
      return { direct_reply: cleaned };
    }
  }

  return raw;
}

/**
 * Endpoint utama simulasi chat Barberbook MVP
 * Menggunakan Gemini untuk intent detection dan Conversation Orchestrator untuk state logic
 */
export async function simulateChat(req: Request, res: Response) {
  const { userId, message } = req.body;

  // Validasi input
  if (!userId || !message) {
    return res.status(400).json({ error: "userId and message are required" });
  }

  try {
    // --- Step 1: Analisis intent & entities dari Gemini ---
    const rawAi = await analyzeMessage(message, userId);
    const ai = sanitizeResponse(rawAi);

    // --- Step 2: Handle percakapan ringan (smalltalk/greeting) ---
    if (
      ai?.direct_reply ||
      (ai?.intent &&
        ["greet_user", "smalltalk", "farewell"].includes(ai.intent))
    ) {
      const replyText =
        ai?.direct_reply ||
        ai?.reply ||
        "Halo! Ada yang bisa BarberBot bantu hari ini? ✂️";

      await logConversation(
        userId,
        "user",
        message,
        ai.intent ?? "smalltalk",
        null
      );
      await logConversation(userId, "assistant", replyText, "smalltalk", null);

      return res.json({
        reply: replyText,
        mode: "direct",
        state: "idle",
      });
    }

    // --- STEP 3: Jalankan Conversation Orchestrator ---
    const intent = ai?.intent || "unknown_intent";
    const entities = ai?.entities || {};

    const result = await runConversationOrchestrator(userId, intent, entities);

    // --- Step 4: Log conversation ke database ---
    await logConversation(
      userId,
      "user",
      message,
      intent,
      Object.keys(entities).length ? entities : null
    );
    await logConversation(
      userId,
      "assistant",
      result.reply,
      result.mode === "unknown_intent" ? "unknown_intent" : intent,
      result.data ?? null
    );

    // --- Step 5: Response ke client ---
    return res.json({
      reply: result.reply,
      mode: result.mode,
      state: result.nextState,
      data: result.data || {},
    });
  } catch (error: any) {
    console.error("❌ simulateChat error:", error);
    return res.status(500).json({
      error: "Terjadi kesalahan internal pada server.",
      detail: error?.message ?? String(error),
    });
  }
}

/**
 * Utility: Menyimpan percakapan ke tabel conversation_logs
 *
 * entities: Record<string, any> | null
 */
async function logConversation(
  userId: string,
  role: "user" | "assistant",
  message: string,
  intent: string | null,
  entities: Record<string, any> | null
) {
  try {
    await pool.query(
      `INSERT INTO conversation_logs (user_id, role, message, intent, entities, created_at)
       VALUES ($1, $2, $3, $4, $5, NOW())`,
      [
        userId,
        role,
        message,
        intent,
        entities ? JSON.stringify(entities) : null,
      ]
    );
  } catch (err) {
    console.error("⚠️ Failed to log conversation:", err);
  }
}
