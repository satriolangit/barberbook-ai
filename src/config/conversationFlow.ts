export type ConversationFlowsType = {
  [key: string]: {
    intent: string;
    description: string;
    required_slots: string[];
    optional_slots: string[];
    states: {
      name: string;
      trigger: string[];
      action: {
        type: string;
        message: string;
      };
      next_state: string;
      condition?: undefined | any;
    }[];
  };
};

export const ConversationFlows: ConversationFlowsType = {
  // ======================================================
  // 🧾 BOOKING FLOW
  // ======================================================
  start_booking: {
    intent: "start_booking",
    description: "Flow percakapan untuk membuat booking baru di Barberbook.",
    required_slots: ["customer_name", "service_name", "date", "time"],
    optional_slots: ["barber_name", "payment_method"],
    states: [
      {
        name: "idle",
        trigger: ["greet_user", "smalltalk"],
        action: {
          type: "reply",
          message: "Halo! Mau booking potong rambut atau layanan lainnya?",
        },
        next_state: "awaiting_customer_name",
      },
      {
        name: "awaiting_customer_name",
        condition: { missing: "customer_name" },
        trigger: [],
        action: {
          type: "ask",
          message: "Boleh tahu nama Anda siapa?",
        },
        next_state: "awaiting_service_name",
      },
      {
        name: "awaiting_service_name",
        condition: { missing: "service_name" },
        trigger: [],
        action: {
          type: "ask",
          message:
            "Layanan apa yang ingin Anda booking? (potong rambut, shaving, cuci rambut)",
        },
        next_state: "awaiting_date",
      },
      {
        name: "awaiting_date",
        condition: { missing: "date" },
        trigger: [],
        action: {
          type: "ask",
          message: "Untuk tanggal berapa ya?",
        },
        next_state: "awaiting_time",
      },
      {
        name: "awaiting_time",
        condition: { missing: "time" },
        trigger: [],
        action: {
          type: "ask",
          message: "Jam berapa Anda ingin datang?",
        },
        next_state: "awaiting_barber",
      },
      {
        name: "awaiting_barber",
        condition: { optional_missing: "barber_name" },
        trigger: [],
        action: {
          type: "ask",
          message: "Apakah Anda punya barber favorit?",
        },
        next_state: "review_booking",
      },
      {
        name: "review_booking",
        condition: { all_filled: true },
        trigger: [],
        action: {
          type: "template",
          message:
            "Baik, berikut detail booking Anda:\n- Nama: {{customer_name}}\n- Layanan: {{service_name}}\n- Tanggal: {{date}}\n- Jam: {{time}}\n{{#if barber_name}}- Barber: {{barber_name}}{{/if}}\nApakah sudah benar?",
        },
        next_state: "awaiting_confirmation",
      },
      {
        name: "awaiting_confirmation",
        trigger: ["confirm_booking"],
        action: {
          type: "reply",
          message:
            "Booking berhasil disimpan! Terima kasih sudah memilih Barberbook ✂️",
        },
        next_state: "completed",
      },
      {
        name: "awaiting_confirmation",
        trigger: ["deny_information"],
        action: {
          type: "reply",
          message:
            "Oke, bagian mana yang ingin Anda ubah? (tanggal, waktu, layanan, atau barber?)",
        },
        next_state: "awaiting_correction",
      },
      {
        name: "awaiting_correction",
        trigger: ["provide_information"],
        action: {
          type: "reply",
          message: "Terima kasih! Data telah diperbarui.",
        },
        next_state: "review_booking",
      },
      {
        name: "completed",
        trigger: ["end_of_flow"],
        action: {
          type: "reply",
          message: "Booking selesai. Sampai jumpa di Barberbook! 💈",
        },
        next_state: "idle",
      },
    ],
  },

  // ======================================================
  // ✅ CONFIRM BOOKING FLOW
  // ======================================================
  confirm_booking: {
    intent: "confirm_booking",
    description: "Flow untuk menyelesaikan booking setelah review.",
    required_slots: [],
    optional_slots: [],
    states: [
      {
        name: "confirm",
        trigger: ["confirm_booking"],
        action: {
          type: "reply",
          message:
            "Booking berhasil disimpan! Terima kasih sudah memilih Barberbook ✂️",
        },
        next_state: "completed",
      },
      {
        name: "completed",
        trigger: ["end_of_flow"],
        action: {
          type: "reply",
          message: "Booking selesai. Sampai jumpa di Barberbook! 💈",
        },
        next_state: "idle",
      },
    ],
  },

  // ======================================================
  //  CANCEL BOOKING FLOW
  // ======================================================
  cancel_booking: {
    intent: "cancel_booking",
    description: "Membatalkan proses booking yang sedang berlangsung.",
    required_slots: [],
    optional_slots: [],
    states: [
      {
        name: "respond_info",
        trigger: ["cancel_booking"],
        action: {
          type: "reply",
          message:
            "Oke, booking kamu sudah dibatalkan. Kalau mau buat jadwal baru, tinggal bilang ya.",
        },
        next_state: "idle",
      },
    ],
  },

  change_booking: {
    intent: "change_booking",
    description:
      "Menangani perubahan detail booking (tanggal, waktu, layanan, nama, dll).",
    required_slots: [], // karena user bisa menyebut salah satu saja
    optional_slots: [
      "customer_name",
      "service_name",
      "date",
      "time",
      "barber_name",
    ],
    states: [
      {
        name: "awaiting_field",
        trigger: ["change_booking"],
        action: {
          type: "ask",
          message:
            "Bagian mana yang ingin Anda ubah? (tanggal, waktu, layanan, atau nama?)",
        },
        next_state: "awaiting_correction",
      },
      {
        name: "awaiting_correction",
        condition: { missing: "field_to_change" },
        trigger: [],
        action: {
          type: "ask",
          message: "Silakan sebutkan nilai yang baru",
        },
        next_state: "review_booking",
      },
      {
        name: "review_booking",
        trigger: ["provide_information"],
        action: {
          type: "template",
          message:
            "Oke, sudah saya ubah. Berikut detail booking terbaru Anda:\n- Nama: {{customer_name}}\n- Layanan: {{service_name}}\n- Tanggal: {{date}}\n- Jam: {{time}}\n{{#if barber_name}}- Barber: {{barber_name}}{{/if}}\nApakah sudah benar?",
        },
        next_state: "awaiting_confirmation",
      },
    ],
  },

  // ======================================================
  // 💬 INFORMATIVE INTENTS (non-booking)
  // ======================================================

  // 🪞 ask_services
  ask_services: {
    intent: "ask_services",
    description: "Menjawab pertanyaan tentang layanan yang tersedia.",
    required_slots: [],
    optional_slots: [],
    states: [
      {
        name: "respond_info",
        trigger: ["ask_services"],
        action: {
          type: "reply",
          message:
            "Kami menyediakan layanan berikut:\n💇 Potong Rambut\n🧔 Shaving\n💆 Cuci & Pijat Kepala\n💈 Creambath",
        },
        next_state: "idle",
      },
    ],
  },

  // 💸 ask_prices
  ask_prices: {
    intent: "ask_prices",
    description: "Memberikan informasi harga layanan tertentu.",
    required_slots: ["service_name"],
    optional_slots: [],
    states: [
      {
        name: "awaiting_service_name",
        condition: { missing: "service_name" },
        trigger: [],
        action: {
          type: "ask",
          message:
            "Untuk layanan apa ya? (contoh: potong rambut, shaving, creambath)",
        },
        next_state: "respond_info",
      },
      {
        name: "respond_info",
        trigger: ["ask_prices"],
        action: {
          type: "reply",
          message: "Harga untuk layanan *{{service_name}}* adalah Rp50.000 💰", // 🧠 sementara statis, nanti bisa dynamic dari DB
        },
        next_state: "idle",
      },
    ],
  },

  // ⏰ ask_availability
  ask_availability: {
    intent: "ask_availability",
    description:
      "Menjawab pertanyaan tentang ketersediaan jadwal/barber di tanggal tertentu.",
    required_slots: ["date", "time"],
    optional_slots: ["barber_name", "service_name"],
    states: [
      {
        name: "awaiting_date",
        condition: { missing: "date" },
        trigger: [],
        action: {
          type: "ask",
          message: "Untuk tanggal berapa ingin dicek ketersediaannya?",
        },
        next_state: "awaiting_time",
      },
      {
        name: "awaiting_time",
        condition: { missing: "time" },
        trigger: [],
        action: {
          type: "ask",
          message: "Jam berapa kamu ingin datang?",
        },
        next_state: "respond_info",
      },
      {
        name: "respond_info",
        trigger: ["ask_availability"],
        action: {
          type: "reply",
          message:
            "Untuk memastikan ketersediaan jadwal, sebutkan tanggal dan jam yang kamu inginkan ya ✂️",
        },
        next_state: "idle",
      },
    ],
  },

  // 🚶 ask_queue_status
  ask_queue_status: {
    intent: "ask_queue_status",
    description: "Menjawab pertanyaan tentang kondisi antrian di barbershop.",
    required_slots: [],
    optional_slots: [],
    states: [
      {
        name: "respond_info",
        trigger: ["ask_queue_status"],
        action: {
          type: "reply",
          message:
            "Saat ini antrian cukup santai 😎 Rata-rata waktu tunggu sekitar 10–15 menit.",
        },
        next_state: "idle",
      },
    ],
  },

  // 🆘 help
  help: {
    intent: "help",
    description: "Memberikan panduan penggunaan chatbot Barberbook.",
    required_slots: [],
    optional_slots: [],
    states: [
      {
        name: "respond_help",
        trigger: ["help"],
        action: {
          type: "reply",
          message:
            "Saya bisa bantu kamu untuk booking layanan, cek harga, atau menanyakan ketersediaan barber. Mau mulai booking sekarang? 💈",
        },
        next_state: "idle",
      },
    ],
  },
};
