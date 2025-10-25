import { Request, Response } from "express";
import { analyzeMessage } from "../services/geminiOrchestrator";
import pool from "../config/db";

export async function simulateChat(req: Request, res: Response) {
  const { userId, message } = req.body;
  if (!userId || !message)
    return res.status(400).json({ error: "userId and message required" });

  // load recent conversation history (last 6 logs) for context
  const { rows } = await pool.query(
    `SELECT role, message, intent, entities FROM conversation_logs WHERE user_id=$1 ORDER BY created_at DESC LIMIT 6`,
    [userId]
  );

  const convo = rows.map((r) => ({
    role: r.role,
    message: r.message,
    intent: r.intent,
    entities: r.entities,
  }));

  // analyze with Gemini

  const ai = await analyzeMessage(message, rows.length > 0 ? convo : undefined);

  // save user message to logs
  await pool.query(
    `INSERT INTO conversation_logs(user_id, role, message, intent, entities) VALUES($1,$2,$3,$4,$5)`,
    [
      userId,
      "user",
      message,
      ai.intent ?? null,
      ai.entities ? JSON.stringify(ai.entities) : null,
    ]
  );

  // If direct_reply -> return textual reply
  if ((ai as any).direct_reply) {
    const text = (ai as any).direct_reply;
    // save bot reply
    await pool.query(
      `INSERT INTO conversation_logs(user_id, role, message) VALUES($1,$2,$3)`,
      [userId, "assistant", text]
    );
    return res.json({ reply: text, mode: "direct" });
  }

  // If JSON intent -> gateway decides action (for MVP we just simulate)
  const intent = ai.intent ?? "unknown";
  // basic simulation: if start_booking and entities complete -> create booking
  if (
    intent === "start_booking" &&
    ai.entities?.service_name &&
    ai.entities?.date &&
    ai.entities?.time
  ) {
    // upsert customer (by userId as phone)
    const name = ai.entities.customer_name ?? null;
    const clientResult = await pool.query(
      `INSERT INTO customers(phone, name) VALUES($1,$2) ON CONFLICT (phone) DO UPDATE SET name = COALESCE($2, customers.name) RETURNING id`,
      [userId, name]
    );
    const customerId = clientResult.rows[0].id;
    const insert = await pool.query(
      `INSERT INTO bookings(customer_id, service_name, date, time, payment_method, status) VALUES($1,$2,$3,$4,$5,$6) RETURNING id`,
      [
        customerId,
        ai.entities.service_name,
        ai.entities.date,
        ai.entities.time,
        ai.entities.payment_method ?? null,
        "confirmed",
      ]
    );
    const bookingId = insert.rows[0].id;

    const replyText = `✅ Booking confirmed (id: ${bookingId}) untuk ${ai.entities.service_name} pada ${ai.entities.date} ${ai.entities.time}`;
    await pool.query(
      `INSERT INTO conversation_logs(user_id, role, message, intent) VALUES($1,$2,$3,$4)`,
      [userId, "assistant", replyText, "booking_confirmed"]
    );
    return res.json({ reply: replyText, bookingId, mode: "action" });
  }

  // fallback: return parsed JSON so developer/gateway can take next step
  return res.json({ reply: ai, mode: "parsed" });
}
