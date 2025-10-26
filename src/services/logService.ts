// services/logService.ts
import pool from "../config/db";

export async function saveLog(
  userId: string,
  role: "user" | "assistant",
  message: string,
  intent: string,
  entities: any
) {
  await pool.query(
    `INSERT INTO conversation_logs (user_id, role, message, intent, entities, created_at)
     VALUES ($1, $2, $3, $4, $5, NOW())`,
    [userId, role, message, intent, entities ? JSON.stringify(entities) : null]
  );
}
