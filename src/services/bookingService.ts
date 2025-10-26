/**
 * bookingService.ts
 * ----------------------------------------------
 * 🎯 Service layer untuk menangani semua operasi booking Barberbook
 * - Dipanggil oleh ConversationOrchestrator saat user konfirmasi booking
 * - Berisi logika CRUD + helper untuk ketersediaan dan konfirmasi
 * ----------------------------------------------
 */

import db from "../config/db";

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
}) {
  // ✅ Simpan data booking ke database
  const result = await db.query(
    `
    INSERT INTO bookings 
      (user_id, customer_name, service_name, date, time, barber_name, payment_method, status)
    VALUES ($1,$2,$3,$4,$5,$6,$7,'pending')
    RETURNING 
      id, customer_name, service_name, date, time, barber_name, payment_method, status
  `,
    [
      bookingData.user_id,
      bookingData.customer_name,
      bookingData.service_name,
      bookingData.date,
      bookingData.time,
      bookingData.barber_name,
      bookingData.payment_method,
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
