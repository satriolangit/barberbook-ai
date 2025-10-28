import { GoogleGenerativeAI } from "@google/generative-ai";
const client = new GoogleGenerativeAI(
  process.env.GEMINI_API_KEY ?? "AIzaSyDkDbR8Fig4nUxf8wEUmkkncC2eqijOc5E"
);
const model = process.env.GEMINI_MODEL_NAME ?? "gemini-2.5-flash";

export function getGeminiModel() {
  return client.getGenerativeModel({ model: model });
}

/**
 * Fungsi utilitas untuk membuat embedding teks
 * menggunakan model text-embedding-004
 *
 * - Cocok untuk semantic search, RAG, pgvector
 * - Output: number[] dengan panjang sekitar 1536
 */
export async function getEmbedding(text: string): Promise<number[]> {
  if (!text || text.trim().length === 0) return [];

  const embeddingModel = client.getGenerativeModel({
    model: "text-embedding-004", // model khusus embedding
  });

  const response = await embeddingModel.embedContent(text);
  const embedding = response?.embedding?.values;

  if (!embedding || !Array.isArray(embedding)) {
    throw new Error("Failed to generate embedding from Gemini API");
  }

  return embedding;
}
