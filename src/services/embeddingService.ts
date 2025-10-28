// src/services/embeddingService.ts
import db from "../config/db";
import { toSql } from "pgvector";
import { getEmbedding } from "./geminiClient"; // atau openaiClient, tergantung yang kamu pakai

/**
 * Generate and save embedding untuk 1 service
 */
export async function generateServiceEmbedding(
  serviceId: number,
  name: string
) {
  const embedding = await getEmbedding(name);
  await db.query("UPDATE services SET embedding = $1 WHERE id = $2", [
    toSql(embedding),
    serviceId,
  ]);
  return embedding;
}

/**
 * Generate embedding untuk semua layanan (misal saat startup atau update besar)
 */
export async function refreshAllServiceEmbeddings() {
  const res = await db.query(
    "SELECT id, name, service_description FROM services"
  );
  for (const s of res.rows) {
    const text = `${s.name}. ${s.service_description ?? ""}`;
    await generateServiceEmbedding(s.id, text);
  }
}

/**
 * Cari layanan paling mirip berdasarkan embedding similarity
 */
export async function findNearestService(
  serviceCandidate: string,
  threshold = 0.6
) {
  console.log("findNearestService ==>");
  const embedding = await getEmbedding(serviceCandidate);
  const result = await db.query(
    `SELECT id, name, duration_minutes, price, 1 - (embedding <=> $1::vector) AS similarity
     FROM services
     ORDER BY similarity DESC
     LIMIT 1`,
    [toSql(embedding)]
  );

  const best = result.rows[0];
  console.log("🧠 Similarity:", best?.similarity);
  if (!best || best.similarity < threshold) return null;
  return best;
}

// Cari layanan mirip (context chunk)
export async function searchSimilarServices(query: string, limit = 5) {
  const embedding = await getEmbedding(query);
  const vector = toSql(embedding);
  const result = await db.query(
    `
    SELECT id, name, duration_minutes, price,
           1 - (embedding <=> $1::vector) AS similarity
    FROM services
    ORDER BY similarity DESC
    LIMIT $2
  `,
    [vector, limit]
  );
  return result.rows;
}
