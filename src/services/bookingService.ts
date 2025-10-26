import pool from "../config/db";

export interface BookingData {
  user_id: string;
  customer_name: string;
  service_name: string;
  date: string;
  time: string;
  barber_name?: string | null;
  payment_method?: string | null;
  payment_status?: string | null;
}

/**
 * Membuat booking baru di tabel bookings
 */
export async function createBooking(data: BookingData) {
  const {
    user_id,
    customer_name,
    service_name,
    date,
    time,
    barber_name = null,
    payment_method = null,
    payment_status = "pending",
  } = data;

  try {
    const result = await pool.query(
      `
      INSERT INTO bookings 
        (user_id, customer_name, service_name, date, time, barber_name, payment_method, payment_status, status, created_at)
      VALUES 
        ($1, $2, $3, $4, $5, $6, $7, $8, 'confirmed', NOW())
      RETURNING id, customer_name user_id, service_name, date, time, barber_name, payment_status, status;
      `,
      [
        user_id,
        customer_name,
        service_name,
        date,
        time,
        barber_name,
        payment_method,
        payment_status,
      ]
    );

    return result.rows[0];
  } catch (error) {
    console.error("❌ Gagal menyimpan booking:", error);
    throw new Error("Database error: gagal membuat booking.");
  }
}

/**
 * Mengecek status booking terakhir user
 */
export async function getLastBooking(userId: string) {
  try {
    const result = await pool.query(
      `
      SELECT * FROM bookings 
      WHERE user_id = $1 
      ORDER BY created_at DESC 
      LIMIT 1;
      `,
      [userId]
    );

    return result.rows[0] || null;
  } catch (error) {
    console.error("⚠️ Gagal mengambil booking terakhir:", error);
    return null;
  }
}

/**
 * Mengupdate status booking
 */
export async function updateBookingStatus(bookingId: number, status: string) {
  try {
    const result = await pool.query(
      `
      UPDATE bookings
      SET status = $2, updated_at = NOW()
      WHERE id = $1
      RETURNING *;
      `,
      [bookingId, status]
    );

    return result.rows[0] || null;
  } catch (error) {
    console.error("⚠️ Gagal update status booking:", error);
    return null;
  }
}
