import pool from "../config/db";

export async function getSession(userId: string) {
  const { rows } = await pool.query(
    "SELECT * FROM conversation_sessions WHERE user_id=$1 LIMIT 1",
    [userId]
  );
  return rows[0] || null;
}

export async function updateSession(
  userId: string,
  state: string,
  data: Record<string, any>
) {
  await pool.query(
    `INSERT INTO conversation_sessions(user_id, state, data, updated_at)
     VALUES($1, $2, $3, NOW())
     ON CONFLICT (user_id)
     DO UPDATE SET state=$2, data=$3, updated_at=NOW()`,
    [userId, state, JSON.stringify(data)]
  );
}

export async function clearSession(userId: string) {
  await pool.query(`DELETE FROM conversation_sessions WHERE user_id=$1`, [
    userId,
  ]);
}
