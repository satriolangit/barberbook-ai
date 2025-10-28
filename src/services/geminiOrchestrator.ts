import dotenv from "dotenv";
import { getGeminiModel } from "./geminiClient";
import { SYSTEM_PROMPT } from "../config/prompt";
import { getSession } from "./sessionManager";
import db from "../config/db";
import { findNearestService, searchSimilarServices } from "./embeddingService";

dotenv.config();

/**
 * Build dynamic service context for prompt
 * - If vector embeddings available → top 5 similar (context chunk)
 * - Else → list all services
 */
async function buildServiceContext(userQuery?: string): Promise<string> {
  try {
    let context = "";

    // 🧠 Try vector search first (RAG mode)
    if (userQuery && userQuery.length > 2) {
      const similar = await searchSimilarServices(userQuery, 5);
      if (similar && similar.length > 0) {
        context += "## 💈 LAYANAN TERKAIT (HASIL PENCARIAN SEMANTIK)\n";
        context += similar
          .map(
            (s: any) =>
              `- ${s.name} (${
                s.duration_minutes
              } menit, Rp${s.price.toLocaleString()})`
          )
          .join("\n");
        context +=
          "\n\nGunakan nama layanan dari daftar di atas untuk mengisi 'service_name'.\n";
        return context;
      }
    }

    // 🧾 Fallback to listing all services
    const result = await db.query(
      "SELECT name, duration_minutes, price FROM services ORDER BY id ASC"
    );
    if (result.rows.length > 0) {
      context += "## 💈 LAYANAN TERSEDIA SAAT INI\n";
      context += result.rows
        .map(
          (r) =>
            `- ${r.name} (${
              r.duration_minutes
            } menit, Rp${r.price.toLocaleString()})`
        )
        .join("\n");
      context +=
        "\nGunakan hanya nama layanan dari daftar di atas untuk mengisi 'service_name'.\n";
    }

    return context;
  } catch (err) {
    console.error("⚠️ buildServiceContext error:", err);
    return "";
  }
}

/**
 * Main analyzer
 */
export async function analyzeMessage(message: string, userId: string) {
  const session = await getSession(userId);
  const contextIntent = session?.data?.intent || null;
  const contextState = session?.state || "idle";
  const contextEntities = session?.data || {};

  // 🧩 Generate dynamic service context
  const dynamicServiceContext = await buildServiceContext(message);

  // 🧱 Compose contextual block
  const contextBlock = `
KONTEKS SAAT INI:
Intent aktif: ${contextIntent ?? "none"}
State saat ini: ${contextState}
Entitas yang sudah diketahui:
${JSON.stringify(contextEntities, null, 2)}

Pesan user: "${message}"
`;

  // 🧠 Final prompt (hybrid with context chunk)
  const fullPrompt = `
${SYSTEM_PROMPT}

${dynamicServiceContext}

---

Gunakan konteks berikut untuk menentukan intent dan entities dengan benar.
Jika pengguna sedang dalam proses melengkapi data booking (flow "start_booking"),
dan hanya menyebutkan tanggal, waktu, nama, atau layanan tanpa kata seperti
"ubah", "ganti", atau "batalkan", **jangan ubah intent menjadi "change_booking"**.

${contextBlock}
`;

  // ⚙️ Gemini API call
  const model = getGeminiModel();
  const result = await model.generateContent({
    contents: [{ role: "user", parts: [{ text: fullPrompt }] }],
  });

  const textResponse = result.response.text();

  // 🧼 Cleanup
  const cleaned = textResponse
    .replace(/```json/i, "")
    .replace(/```/g, "")
    .trim();

  try {
    const parsed = JSON.parse(cleaned);
    if (!parsed.intent) parsed.intent = "unknown_intent";
    if (!parsed.entities) parsed.entities = {};

    // 🔄 Prevent false "change_booking"
    if (
      parsed.intent === "change_booking" &&
      contextIntent === "start_booking"
    ) {
      const lower = message.toLowerCase();
      const isExplicitChange = /(ubah|ganti|edit|pindah|batalkan)/.test(lower);
      if (!isExplicitChange) parsed.intent = "start_booking";
    }

    // 🧠 Fallback to previous intent if unknown
    if (
      (parsed.intent === "unknown" || parsed.intent === "unknown_intent") &&
      contextIntent &&
      contextIntent !== "unknown_intent"
    ) {
      parsed.intent = contextIntent;
    }

    // 🔍 Validate or enrich service_name using embedding
    if (!parsed.entities.service_name?.trim()) {
      const bestMatch = await findNearestService(message);
      if (bestMatch && bestMatch.similarity > 0.6) {
        parsed.entities.service_name = bestMatch.name;
        parsed.entities.service_id = bestMatch.id;
        parsed.entities.service_duration = bestMatch.duration_minutes;
        parsed.entities.service_price = bestMatch.price;
      }
    } else {
      const bestMatch = await findNearestService(parsed.entities.service_name);
      if (bestMatch && bestMatch.similarity > 0.75) {
        parsed.entities.service_name = bestMatch.name;
        parsed.entities.service_id = bestMatch.id;
        parsed.entities.service_duration = bestMatch.duration_minutes;
        parsed.entities.service_price = bestMatch.price;
      }
    }

    return parsed;
  } catch (err) {
    console.error("⚠️ Gemini parse error:", err, "\nRaw output:", textResponse);
    const trimmed = textResponse.trim();
    const isLikelyJSON = /^[{\[]/.test(trimmed);

    if (!isLikelyJSON) {
      return {
        intent: "smalltalk",
        direct_reply: trimmed,
        entities: {},
      };
    }

    return {
      intent: contextIntent || "unknown_intent",
      entities: {},
    };
  }
}
