import { getGeminiModel } from "./geminiClient";
import { SYSTEM_PROMPT } from "../config/prompt";

type AiJson = {
  intent?: string;
  entities?: Record<string, any>;
  direct_reply?: string; // when smalltalk/greet
};

export async function analyzeMessage(
  userMessage: string,
  conversationHistory: any[] = []
): Promise<AiJson> {
  const model = getGeminiModel();
  const historyText = conversationHistory.length
    ? `\nConversationHistory:${JSON.stringify(conversationHistory)}`
    : "";
  const prompt = `${SYSTEM_PROMPT}${historyText}\nUser: ${userMessage}`;

  try {
    const result = await model.generateContent(prompt); // adapt to SDK signature
    const text = result.response?.text?.() ?? result.toString?.() ?? "";

    // If model returned JSON string -> parse; otherwise treat as direct text reply
    try {
      const parsed = JSON.parse(text);
      return parsed;
    } catch {
      // not JSON -> likely direct reply (smalltalk etc)
      return { direct_reply: text };
    }
  } catch (err) {
    console.error("Gemini analyze error", err);
    return {
      direct_reply:
        "Maaf, terjadi kesalahan pada sistem AI. Coba lagi sebentar.",
    };
  }
}
