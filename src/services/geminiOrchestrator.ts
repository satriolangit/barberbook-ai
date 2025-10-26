import dotenv from "dotenv";
import { getGeminiModel } from "./geminiClient";
import { SYSTEM_PROMPT } from "../config/prompt";
import { getSession } from "./sessionManager";

dotenv.config();

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

  // 🧩 Panggil Gemini
  const model = getGeminiModel();

  const result = await model.generateContent({
    contents: [{ role: "user", parts: [{ text: fullPrompt }] }],
  });

  const textResponse = result.response.text();

  // 🧼 Bersihkan markdown dan karakter tambahan
  const cleaned = textResponse
    .replace(/```json/i, "")
    .replace(/```/g, "")
    .trim();

  // 🧩 Coba parse JSON
  try {
    const parsed = JSON.parse(cleaned);

    // Validasi output minimal
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

    return parsed;
  } catch (err) {
    console.error("⚠️ Gemini parse error:", err, "\nRaw output:", textResponse);

    const trimmed = textResponse.trim();
    const isLikelyJSON = /^[{\[]/.test(trimmed);

    if (!isLikelyJSON) {
      // plain text → smalltalk / direct reply
      return {
        intent: "smalltalk",
        direct_reply: trimmed,
        entities: {},
      };
    }

    // Kembalikan default agar sistem tidak crash
    return {
      intent: contextIntent || "unknown_intent",
      entities: {},
    };
  }
}
