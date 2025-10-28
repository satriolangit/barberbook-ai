/**
 * Barberbook Chatbot — End-to-End Conversation Tests
 *
 * Prasyarat:
 *  - Express app diexport dari src/app.ts atau src/server.ts
 *  - Endpoint: POST /api/chat/simulate
 *  - Database test terisolasi (gunakan .env.test)
 */

import request from "supertest";
import app from "../src/app"; // adjust path ke app Express kamu
import { clearAllSessions } from "../src/services/sessionManager";

describe("💈 Barberbook Chatbot E2E Flow Tests", () => {
  const endpoint = "/api/chat/simulate";
  const send = (userId: string, message: string) =>
    request(app).post(endpoint).send({ userId, message });

  beforeAll(async () => {
    await clearAllSessions?.(); // optional cleanup helper
  });

  afterEach(async () => {
    // sedikit delay antar test untuk simulasi percakapan natural
    await new Promise((r) => setTimeout(r, 300));
  });

  /* -------------------------------------------------------------------------- */
  /* 1️⃣ FLOW DASAR BOOKING BARU                                               */
  /* -------------------------------------------------------------------------- */
  test("Booking flow basic (start → confirm)", async () => {
    const uid = "test_user_basic";
    await send(uid, "Halo Barberbot");
    await send(uid, "Saya mau potong rambut besok jam 3 sore");
    await send(uid, "Nama saya Andi");
    const review = await send(uid, "Ya benar");

    expect(review.body.intent).toBe("confirm_booking");
    expect(review.body.reply).toMatch(/Booking berhasil/i);
  });

  /* -------------------------------------------------------------------------- */
  /* 2️⃣ INTERRUPTION: ASK QUEUE DI TENGAH BOOKING                              */
  /* -------------------------------------------------------------------------- */
  test("Ask queue status mid booking", async () => {
    const uid = "test_user_interrupt";
    await send(uid, "Saya mau potong rambut besok jam 2 siang");
    const info = await send(uid, "Sekarang ramai gak?");
    expect(info.body.intent).toBe("ask_queue_status");
    expect(info.body.reply).toMatch(/antrian/i);
    const cont = await send(uid, "Nama saya Budi");
    expect(cont.body.mode).not.toBe("fallback");
  });

  /* -------------------------------------------------------------------------- */
  /* 3️⃣ CHANGE BOOKING: Ubah waktu booking aktif                               */
  /* -------------------------------------------------------------------------- */
  test("Change booking mid flow", async () => {
    const uid = "test_user_change";
    await send(uid, "Saya mau potong rambut besok jam 3 sore");
    await send(uid, "Nama saya Dimas");
    const change = await send(uid, "Ganti jamnya jadi jam 5 sore");

    expect(change.body.intent).toBe("change_booking");
    expect(change.body.reply).toMatch(/17:00|jam 5/i);

    const confirm = await send(uid, "Ya benar");
    expect(confirm.body.mode).toBe("completed");
  });

  /* -------------------------------------------------------------------------- */
  /* 4️⃣ CANCEL BOOKING SAAT AKTIF                                             */
  /* -------------------------------------------------------------------------- */
  test("Cancel booking active flow", async () => {
    const uid = "test_user_cancel";
    await send(uid, "Saya mau potong rambut besok jam 1 siang");
    const cancel = await send(uid, "Batalkan booking saya");

    expect(cancel.body.intent).toBe("cancel_booking");
    expect(cancel.body.reply).toMatch(/dibatalkan/i);
  });

  /* -------------------------------------------------------------------------- */
  /* 5️⃣ CANCEL BOOKING SAAT IDLE                                              */
  /* -------------------------------------------------------------------------- */
  test("Cancel booking saat tidak ada session", async () => {
    const uid = "test_user_cancel_idle";
    const res = await send(uid, "Batalkan booking saya");
    expect(res.body.reply).toMatch(/tidak ada booking/i);
  });

  /* -------------------------------------------------------------------------- */
  /* 6️⃣ SMALLTALK DAN SAPAAN                                                  */
  /* -------------------------------------------------------------------------- */
  test("Smalltalk direct reply", async () => {
    const uid = "test_user_smalltalk";
    const hi = await send(uid, "Hai Barberbot");
    const thanks = await send(uid, "Terima kasih");
    expect(hi.body.mode).toBe("direct_reply");
    expect(thanks.body.mode).toBe("direct_reply");
  });

  /* -------------------------------------------------------------------------- */
  /* 7️⃣ ASK AVAILABILITY DI TENGAH BOOKING                                    */
  /* -------------------------------------------------------------------------- */
  test("Ask availability in middle of booking", async () => {
    const uid = "test_user_availability";
    await send(uid, "Saya mau booking potong rambut besok jam 2");
    const avail = await send(uid, "Besok ramai gak?");
    expect(avail.body.intent).toBe("ask_queue_status");
    expect(avail.body.reply).toMatch(/antrian|waktu tunggu/i);
    const next = await send(uid, "Nama saya Andi");
    expect(next.body.mode).not.toBe("fallback");
  });

  /* -------------------------------------------------------------------------- */
  /* 8️⃣ ERROR HANDLING                                                        */
  /* -------------------------------------------------------------------------- */
  test("Unknown intent fallback", async () => {
    const uid = "test_user_unknown";
    const res = await send(uid, "Pesan pizza dong");
    expect(res.body.intent).toBe("unknown_intent");
    expect(res.body.reply).toMatch(/barbershop/i);
  });

  /* -------------------------------------------------------------------------- */
  /* 9️⃣ EDGE CASES                                                            */
  /* -------------------------------------------------------------------------- */
  test("Change booking tanpa flow aktif", async () => {
    const uid = "test_user_change_idle";
    const res = await send(uid, "Ganti jam jadi jam 5 sore");
    expect(res.body.reply).toMatch(/tidak ada booking aktif/i);
  });

  test("Confirm booking tanpa flow aktif", async () => {
    const uid = "test_user_confirm_idle";
    const res = await send(uid, "Ya benar");
    expect(res.body.reply).toMatch(/belum ada data booking/i);
  });
});
