/**
 * bookingService.ts
 * ----------------------------------------------
 * 🎯 Service layer untuk menangani semua operasi booking Barberbook
 * - Dipanggil oleh ConversationOrchestrator saat user konfirmasi booking
 * - Berisi logika CRUD + helper untuk ketersediaan dan konfirmasi
 * ----------------------------------------------
 */

import db from "../config/db";
import { getEmbedding } from "./geminiClient";

/* -------------------------------------------------------------------------- */
/* 🧾 CREATE BOOKING */
/* -------------------------------------------------------------------------- */
export async function createBooking(bookingData: {
  user_id: string;
  customer_name: string;
  service_name: string;
  date: string;
  time: string;
  barber_name?: string | null;
  payment_method?: string | null;
  status?: string | null;
  barber_id?: number | null;
  service_id?: number | null;
  end_time?: string | null;
}) {
  // ✅ Simpan data booking ke database
  const result = await db.query(
    `
    INSERT INTO bookings 
      (user_id, customer_name, service_name, date, time, barber_name, payment_method, status, barber_id, service_id, end_time)
    VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9, $10, $11)
    RETURNING 
      id, customer_name, service_name, date, time, barber_name, payment_method, status, barber_id, service_id, end_time
  `,
    [
      bookingData.user_id,
      bookingData.customer_name,
      bookingData.service_name,
      bookingData.date,
      bookingData.time,
      bookingData.barber_name,
      bookingData.payment_method,
      bookingData.status ? bookingData.status : "pending",
      bookingData.barber_id ? bookingData.barber_id : null,
      bookingData.service_id ? bookingData.service_id : null,
      bookingData.end_time ? bookingData.end_time : null,
    ]
  );

  return result.rows[0];
}

/* -------------------------------------------------------------------------- */
/* 🔍 CHECK AVAILABILITY */
/* -------------------------------------------------------------------------- */
/**
 * Mengecek apakah slot waktu tertentu masih tersedia.
 * - Jika barber_name disertakan → periksa khusus barber itu.
 * - Jika tidak → periksa global (semua barber).
 */
export async function checkAvailability(
  date: string,
  time: string,
  barberName?: string
): Promise<boolean> {
  const query = barberName
    ? `SELECT COUNT(*) FROM bookings WHERE date=$1 AND time=$2 AND barber_name=$3`
    : `SELECT COUNT(*) FROM bookings WHERE date=$1 AND time=$2`;

  const values = barberName ? [date, time, barberName] : [date, time];
  const result = await db.query(query, values);
  const count = parseInt(result.rows[0].count, 10);

  return count === 0; // true = tersedia
}

/* -------------------------------------------------------------------------- */
/* 📋 BUILD BOOKING SUMMARY */
/* -------------------------------------------------------------------------- */
/**
 * Utility untuk membangun pesan konfirmasi booking
 * yang ramah pengguna dan informatif.
 */
export function buildBookingSummary(booking: Record<string, any>): string {
  return (
    `✅ Booking berhasil disimpan!\n\n` +
    `📋 Detail Booking:\n` +
    `- Nama: ${booking.customer_name}\n` +
    `- Layanan: ${booking.service_name}\n` +
    `- Tanggal: ${booking.date}\n` +
    `- Jam: ${booking.time}\n` +
    (booking.barber_name ? `- Barber: ${booking.barber_name}\n` : "") +
    (booking.payment_method
      ? `- Metode Pembayaran: ${booking.payment_method}\n`
      : "") +
    `\nTerima kasih sudah memilih Barberbook 💈`
  );
}

/* -------------------------------------------------------------------------- */
/* 🔄 GET USER BOOKINGS */
/* -------------------------------------------------------------------------- */
/**
 * Mendapatkan daftar booking user (berguna untuk fitur "cek booking saya").
 */
export async function getBookingsByUser(userId: string) {
  const result = await db.query(
    `
    SELECT id, customer_name, service_name, date, time, barber_name, payment_method, status
    FROM bookings
    WHERE user_id = $1
    ORDER BY date DESC, time DESC
  `,
    [userId]
  );

  return result.rows;
}

/* -------------------------------------------------------------------------- */
/* ❌ CANCEL BOOKING (future extension) */
/* -------------------------------------------------------------------------- */
/**
 * Membatalkan booking tertentu.
 */
export async function cancelBooking(bookingId: string) {
  const result = await db.query(
    `UPDATE bookings SET status='cancelled' WHERE id=$1 RETURNING *`,
    [bookingId]
  );
  return result.rows[0];
}

/* -------------------------------------------------------------------------- */
/* 🔄 GET AVAILABLE BARBERS */
/* -------------------------------------------------------------------------- */
/**
 * Mendapatkan daftar barber yang tersedia.
 */
export async function getAvailableBarber(date: string, time: string) {
  const query = `
    SELECT b.id, b.barber_name
    FROM barbers b
    WHERE b.is_active = TRUE
    AND b.id NOT IN (
      SELECT barber_id FROM bookings 
      WHERE date = $1 AND time = $2 AND status = 'confirmed'
    )
    LIMIT 1
  `;
  const result = await db.query(query, [date, time]);
  return result.rows[0] || null;
}

/* -------------------------------------------------------------------------- */
/* 🔄 GET AVAILABLE BARBERS WITH LOCK */
/* -------------------------------------------------------------------------- */
/**
 * Mendapatkan daftar barber yang tersedia.
 */
export async function getAvailableBarberWithLock(
  date: string,
  startTime: string,
  endTime: string
) {
  const client = await db.connect();
  try {
    await client.query("BEGIN");

    // Ambil 1 barber yang available, lock baris agar tidak dipakai user lain
    const sql = `
      SELECT id, barber_name FROM barbers
      WHERE is_active = true AND id NOT IN (
        SELECT barber_id FROM bookings
        WHERE date = $1 AND (
        (time, end_time) OVERLAPS ($2::time, $3::time)
      ) 
        AND status = 'confirmed'
      )
      FOR UPDATE SKIP LOCKED
      LIMIT 1
      `;

    const params = [date, startTime, endTime];

    console.log("getAvailableBarberWithLock ==>");
    console.log(sql, params);

    const result = await client.query(sql, params);

    const barber = result.rows[0];

    if (!barber) {
      await client.query("ROLLBACK");
      return null;
    }

    await client.query("COMMIT");
    return barber;
  } catch (err) {
    await client.query("ROLLBACK");
    throw err;
  } finally {
    client.release();
  }
}
