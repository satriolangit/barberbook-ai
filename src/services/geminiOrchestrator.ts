import dotenv from "dotenv";
import { getGeminiModel } from "./geminiClient";
import { SYSTEM_PROMPT } from "../config/prompt";
import { getSession } from "./sessionManager";

dotenv.config();

/**
 * analyzeMessage(message, userId)
 * - preserves contextIntent / contextState / contextEntities from session
 * - constructs prompt with the context block (so Gemini can continue flows)
 * - robustly extracts JSON even if mixed with markdown or extra text
 * - guarantees direct_reply for smalltalk (plain-text responses)
 */
export async function analyzeMessage(message: string, userId: string) {
  // 🧠 Ambil session user (jika ada)
  const session = await getSession(userId);
  const contextIntent = session?.data?.intent || null;
  const contextState = session?.state || "idle";
  const contextEntities = session?.data || {};

  // 🧩 Bangun konteks percakapan untuk prompt
  const contextBlock = `
KONTEKS SAAT INI:
Intent aktif: ${contextIntent ?? "none"}
State saat ini: ${contextState}
Entitas yang sudah diketahui:
${JSON.stringify(contextEntities, null, 2)}

Pesan user: "${message}"
`;

  // 🧱 Gabungkan system prompt dan konteks user
  const fullPrompt = `${SYSTEM_PROMPT}

---

Gunakan konteks di bawah ini untuk menentukan intent dan entities.
Jika pesan ini adalah lanjutan dari flow booking (misalnya user menyebut tanggal atau jam),
maka intent-nya tetap "start_booking" dan lengkapi entitas yang relevan.

${contextBlock}
`;

  const model = getGeminiModel();

  try {
    const result = await model.generateContent({
      contents: [{ role: "user", parts: [{ text: fullPrompt }] }],
    });

    const textResponse = result.response.text();

    // --- Helper: extract first JSON object substring if present (balanced braces)
    function extractFirstJson(text: string): string | null {
      const start = text.indexOf("{");
      if (start === -1) return null;
      let depth = 0;
      for (let i = start; i < text.length; i++) {
        if (text[i] === "{") depth++;
        if (text[i] === "}") depth--;
        if (depth === 0) {
          return text.slice(start, i + 1);
        }
      }
      return null;
    }

    // --- Try to parse cleaned candidate first (strip ```json fences)
    const cleanedCandidate = (textResponse || "")
      .replace(/```json/gi, "")
      .replace(/```/g, "")
      .trim();

    let parsed: any = null;

    try {
      parsed = JSON.parse(cleanedCandidate);
    } catch {
      // fallback: try to extract first {...} block from raw output
      try {
        const jsonStr = extractFirstJson(textResponse || "");
        if (jsonStr) parsed = JSON.parse(jsonStr);
      } catch {
        parsed = null;
      }
    }

    // --- If parsed JSON exists, normalize and apply intent fallback
    if (parsed && typeof parsed === "object") {
      if (!parsed.intent) parsed.intent = "unknown_intent";
      if (!parsed.entities) parsed.entities = {};

      // Fallback ke intent lama jika AI tidak yakin
      if (
        (parsed.intent === "unknown" || parsed.intent === "unknown_intent") &&
        contextIntent &&
        contextIntent !== "unknown_intent"
      ) {
        parsed.intent = contextIntent;
      }

      // Ensure smalltalk has direct_reply (use remainder or reply field)
      if (parsed.intent === "smalltalk" && !parsed.direct_reply) {
        // attempt to compute leftover human-readable text
        const jsonSerialized = (() => {
          try {
            return JSON.stringify(parsed);
          } catch {
            return null;
          }
        })();
        let remainder = "";
        if (jsonSerialized) {
          remainder = textResponse.replace(jsonSerialized, "").trim();
        } else {
          remainder = textResponse.trim();
        }
        parsed.direct_reply =
          parsed.direct_reply || parsed.reply || remainder || null;
      }

      return parsed;
    }

    // --- If parsing failed, detect if raw text is plain text (smalltalk) ---
    const trimmed = textResponse.trim();
    const isLikelyJSON = /^[{\[]/.test(trimmed);

    if (!isLikelyJSON) {
      // treat as smalltalk direct reply
      return {
        intent: "smalltalk",
        direct_reply: trimmed,
        entities: {},
      };
    }

    // --- Otherwise fallback to previous context intent to avoid losing flow ---
    return {
      intent: contextIntent || "unknown_intent",
      entities: {},
    };
  } catch (error) {
    console.error("❌ Error in analyzeMessage:", error);
    return {
      intent: "error",
      direct_reply: "Maaf, terjadi kesalahan saat memproses pesan.",
      entities: {},
    };
  }
}
