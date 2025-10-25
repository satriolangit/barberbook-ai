/**
 * Utility untuk slot management dalam sistem percakapan Barberbook AI
 * Berlaku generik untuk semua intent yang menggunakan slot-filling.
 */

export interface EntityMap {
  [key: string]: any;
}

export interface FlowDefinition {
  required_slots?: string[];
  optional_slots?: string[];
}

/**
 * Ambil daftar slot yang masih kosong dari entitas saat ini
 *
 * @param entities - entitas yang sudah diketahui dari AI
 * @param requiredSlots - daftar slot wajib (required)
 * @returns array nama slot yang masih kosong
 */
export function getMissingSlots(
  entities: EntityMap = {},
  requiredSlots: string[] = []
): string[] {
  if (!requiredSlots.length) return [];
  return requiredSlots.filter(
    (slot) =>
      !entities[slot] || entities[slot] === "" || entities[slot] === null
  );
}

/**
 * Gabungkan entitas lama dengan yang baru (update session data)
 *
 * @param oldData - entitas lama dari session
 * @param newData - entitas baru dari hasil analisis Gemini
 * @returns entitas hasil merge
 */
export function mergeEntities(
  oldData: EntityMap = {},
  newData: EntityMap = {}
): EntityMap {
  const merged = { ...oldData };

  for (const key of Object.keys(newData)) {
    const val = newData[key];
    // Update hanya jika value baru tidak kosong/null
    if (val !== undefined && val !== null && val !== "") {
      merged[key] = val;
    }
  }

  return merged;
}

/**
 * Mengecek apakah semua slot wajib sudah terisi
 *
 * @param entities - entitas user
 * @param requiredSlots - daftar slot wajib
 * @returns true jika semua terisi
 */
export function isAllSlotsFilled(
  entities: EntityMap = {},
  requiredSlots: string[] = []
): boolean {
  return getMissingSlots(entities, requiredSlots).length === 0;
}

/**
 * Utility helper untuk mendapatkan slot berikutnya yang perlu ditanyakan
 *
 * @param entities - entitas user saat ini
 * @param flow - definisi flow (berisi daftar required_slots)
 * @returns nama slot berikutnya yang masih kosong, atau null jika lengkap
 */
export function getNextSlot(
  entities: EntityMap = {},
  flow: FlowDefinition
): string | null {
  const missing = getMissingSlots(entities, flow.required_slots || []);
  return missing.length > 0 ? missing[0] : null;
}
