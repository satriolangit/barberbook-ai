import dotenv from "dotenv";
import { getGeminiModel } from "./geminiClient";
import { SYSTEM_PROMPT } from "../config/prompt";
import { getSession } from "./sessionManager";

dotenv.config();

export async function analyzeMessage(message: string, userId: string) {
  // 🧠 Ambil session aktif (jika ada)
  const session = await getSession(userId);
  const contextIntent = session?.data?.intent || null;
  const contextState = session?.state || "idle";
  const contextEntities = session?.data || {};

  // 🧩 Buat blok konteks percakapan agar model tahu status sebelumnya
  const contextBlock = `
KONTEKS SAAT INI:
Intent aktif: ${contextIntent ?? "none"}
State saat ini: ${contextState}
Entitas yang sudah diketahui:
${JSON.stringify(contextEntities, null, 2)}

Pesan user: "${message}"
`;

  // 🧱 Bangun prompt final untuk Gemini
  const fullPrompt = `${SYSTEM_PROMPT}

---

Gunakan konteks berikut untuk menentukan intent dan entities dengan benar.
Jika pengguna sedang dalam proses melengkapi data booking (flow "start_booking"),
dan hanya menyebutkan tanggal, waktu, nama, atau layanan tanpa kata seperti
"ubah", "ganti", atau "batalkan", **jangan ubah intent menjadi "change_booking"**.

${contextBlock}
`;

  // ⚙️ Panggil Gemini API
  const model = getGeminiModel();

  const result = await model.generateContent({
    contents: [{ role: "user", parts: [{ text: fullPrompt }] }],
  });

  const textResponse = result.response.text();

  // 🧼 Bersihkan markdown dan tanda JSON
  const cleaned = textResponse
    .replace(/```json/i, "")
    .replace(/```/g, "")
    .trim();

  try {
    const parsed = JSON.parse(cleaned);

    // 🧩 Validasi & fallback
    if (!parsed.intent) parsed.intent = "unknown_intent";
    if (!parsed.entities) parsed.entities = {};

    // 🔄 SELF-HEALING: koreksi salah deteksi change_booking saat slot-filling
    if (
      parsed.intent === "change_booking" &&
      contextIntent === "start_booking"
    ) {
      const lower = message.toLowerCase();
      const isExplicitChange = /(ubah|ganti|edit|pindah|batalkan)/.test(lower);

      // Jika user tidak eksplisit ingin mengubah, treat sebagai slot filling
      if (!isExplicitChange) {
        parsed.intent = "start_booking";
      }
    }

    // 🧠 Fallback: jika Gemini tidak yakin, gunakan intent lama
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

    // default fallback agar sistem tetap jalan
    return {
      intent: contextIntent || "unknown_intent",
      entities: {},
    };
  }
}
