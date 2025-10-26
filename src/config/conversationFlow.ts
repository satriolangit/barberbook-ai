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
            "Baik, berikut detail booking Anda:\n- Layanan: {{service_name}}\n- Tanggal: {{date}}\n- Jam: {{time}}\n{{#if barber_name}}- Barber: {{barber_name}}{{/if}}\nApakah sudah benar?",
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
          message: "Booking selesai.",
        },
        next_state: "idle",
      },
    ],
  },
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
};
