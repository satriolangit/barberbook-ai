import { GoogleGenerativeAI } from "@google/generative-ai";
const client = new GoogleGenerativeAI(
  process.env.GEMINI_API_KEY ?? "AIzaSyDkDbR8Fig4nUxf8wEUmkkncC2eqijOc5E"
);
const model = process.env.GEMINI_MODEL_NAME ?? "gemini-2.5-flash";

export function getGeminiModel() {
  return client.getGenerativeModel({ model: model });
}
