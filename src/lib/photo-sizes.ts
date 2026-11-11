/**
 * Definisi ukuran foto cetak Indonesia
 * - Pas foto cm: 2x3, 3x4, 4x6 (cm)
 * - Standar R (inch): 1R-10R
 * Semua disimpan dalam mm untuk akurasi tinggi
 */

export interface PhotoSize {
  id: string;
  label: string;
  category: "pas-foto" | "standar-r";
  /** lebar dalam mm */
  widthMm: number;
  /** tinggi dalam mm */
  heightMm: number;
  /** rasio aspek w:h (untuk deteksi potret/lanskap) */
  ratio: number;
  /** deskripsi singkat */
  description: string;
}

const inch = 25.4; // 1 inch = 25.4 mm

export const PHOTO_SIZES: PhotoSize[] = [
  // Pas Foto (cm → mm)
  {
    id: "2x3",
    label: "2×3 cm",
    category: "pas-foto",
    widthMm: 20,
    heightMm: 30,
    ratio: 2 / 3,
    description: "Pas foto lama, sering untuk KTP lama",
  },
  {
    id: "3x4",
    label: "3×4 cm",
    category: "pas-foto",
    widthMm: 30,
    heightMm: 40,
    ratio: 3 / 4,
    description: "Pas foto standar Indonesia untuk dokumen",
  },
  {
    id: "4x6",
    label: "4×6 cm",
    category: "pas-foto",
    widthMm: 40,
    heightMm: 60,
    ratio: 2 / 3,
    description: "Pas foto besar untuk ijazah, surat",
  },
  // Standar R (inch → mm)
  {
    id: "1R",
    label: "1R",
    category: "standar-r",
    widthMm: Math.round(1.0 * inch),
    heightMm: Math.round(1.5 * inch),
    ratio: 2 / 3,
    description: "Foto mini 1×1.5 inchi",
  },
  {
    id: "2R",
    label: "2R",
    category: "standar-r",
    widthMm: Math.round(2.0 * inch),
    heightMm: Math.round(2.6 * inch),
    ratio: 2 / 2.6,
    description: "Foto dompet 2×2.6 inchi",
  },
  {
    id: "3R",
    label: "3R",
    category: "standar-r",
    widthMm: Math.round(3.5 * inch),
    heightMm: Math.round(5.0 * inch),
    ratio: 3.5 / 5,
    description: "Foto 3.5×5 inchi (postcard)",
  },
  {
    id: "4R",
    label: "4R",
    category: "standar-r",
    widthMm: Math.round(4.0 * inch),
    heightMm: Math.round(6.0 * inch),
    ratio: 2 / 3,
    description: "Foto standar 4×6 inchi (paling populer)",
  },
  {
    id: "5R",
    label: "5R",
    category: "standar-r",
    widthMm: Math.round(5.0 * inch),
    heightMm: Math.round(7.0 * inch),
    ratio: 5 / 7,
    description: "Foto 5×7 inchi",
  },
  {
    id: "6R",
    label: "6R",
    category: "standar-r",
    widthMm: Math.round(6.0 * inch),
    heightMm: Math.round(8.0 * inch),
    ratio: 3 / 4,
    description: "Foto 6×8 inchi",
  },
  {
    id: "7R",
    label: "7R",
    category: "standar-r",
    widthMm: Math.round(7.0 * inch),
    heightMm: Math.round(10.0 * inch),
    ratio: 7 / 10,
    description: "Foto 7×10 inchi",
  },
  {
    id: "8R",
    label: "8R",
    category: "standar-r",
    widthMm: Math.round(8.0 * inch),
    heightMm: Math.round(10.0 * inch),
    ratio: 4 / 5,
    description: "Foto 8×10 inchi",
  },
  {
    id: "9R",
    label: "9R (8×12)",
    category: "standar-r",
    widthMm: Math.round(8.0 * inch),
    heightMm: Math.round(12.0 * inch),
    ratio: 2 / 3,
    description: "Foto 8×12 inchi (Super B)",
  },
  {
    id: "10R",
    label: "10R (10×12)",
    category: "standar-r",
    widthMm: Math.round(10.0 * inch),
    heightMm: Math.round(12.0 * inch),
    ratio: 5 / 6,
    description: "Foto 10×12 inchi (Super C)",
  },
];

export function getPhotoSize(id: string): PhotoSize | undefined {
  return PHOTO_SIZES.find((s) => s.id === id);
}

/** pas foto (cm) */
export const PAS_PHOTO_SIZES = PHOTO_SIZES.filter(
  (s) => s.category === "pas-foto",
);
/** standar R */
export const R_PHOTO_SIZES = PHOTO_SIZES.filter(
  (s) => s.category === "standar-r",
);

// =============================================================
// CUSTOM TEMPLATE (UKURAN BEBAS)
// =============================================================

export type SizeUnit = "mm" | "cm" | "inch";

export interface CustomPhotoTemplate {
  id: string;
  /** nama template, mis. "Paspor 35×45" */
  name: string;
  /** lebar dalam satuan asli (input user) */
  widthValue: number;
  /** tinggi dalam satuan asli */
  heightValue: number;
  unit: SizeUnit;
  /** lebar dalam mm (untuk kalkulasi layout) */
  widthMm: number;
  /** tinggi dalam mm */
  heightMm: number;
  /** rasio w:h */
  ratio: number;
  /** tanggal dibuat */
  createdAt: number;
}

/** Faktor konversi unit → mm */
export const UNIT_TO_MM: Record<SizeUnit, number> = {
  mm: 1,
  cm: 10,
  inch: 25.4,
};

/** Konversi value + unit → mm */
export function convertToMm(value: number, unit: SizeUnit): number {
  return value * UNIT_TO_MM[unit];
}

/** Konversi mm → value + unit */
export function convertFromMm(mm: number, unit: SizeUnit): number {
  return mm / UNIT_TO_MM[unit];
}

/** Buat custom template dari input user */
export function createCustomTemplate(
  name: string,
  widthValue: number,
  heightValue: number,
  unit: SizeUnit,
): CustomPhotoTemplate {
  const widthMm = convertToMm(widthValue, unit);
  const heightMm = convertToMm(heightValue, unit);
  return {
    id: `custom-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    name: name.trim() || `Custom ${widthValue}×${heightValue} ${unit}`,
    widthValue,
    heightValue,
    unit,
    widthMm,
    heightMm,
    ratio: widthMm / heightMm,
    createdAt: Date.now(),
  };
}

/** Konversi CustomPhotoTemplate → PhotoSize-compatible (untuk dipakai layout) */
export function customTemplateToPhotoSize(
  tpl: CustomPhotoTemplate,
): PhotoSize {
  return {
    id: tpl.id,
    label: `${tpl.name} (${tpl.widthValue}×${tpl.heightValue} ${tpl.unit})`,
    category: "pas-foto", // supaya muncul di grup pas foto (umumnya custom ukuran bebas)
    widthMm: tpl.widthMm,
    heightMm: tpl.heightMm,
    ratio: tpl.ratio,
    description: `Template custom: ${tpl.widthValue}×${tpl.heightValue} ${tpl.unit}`,
  };
}

const CUSTOM_TEMPLATES_KEY = "cetakfoto:custom-templates";

/** Muat custom templates dari localStorage */
export function loadCustomTemplates(): CustomPhotoTemplate[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(CUSTOM_TEMPLATES_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.filter(
      (t) =>
        t &&
        typeof t.id === "string" &&
        typeof t.name === "string" &&
        typeof t.widthMm === "number" &&
        typeof t.heightMm === "number",
    );
  } catch {
    return [];
  }
}

/** Simpan custom templates ke localStorage */
export function saveCustomTemplates(templates: CustomPhotoTemplate[]): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(
      CUSTOM_TEMPLATES_KEY,
      JSON.stringify(templates),
    );
  } catch {
    /* ignore quota errors */
  }
}

/** Beberapa template preset populer yang sering dipakai di Indonesia */
export const TEMPLATE_PRESETS: Array<{
  name: string;
  widthValue: number;
  heightValue: number;
  unit: SizeUnit;
  note: string;
}> = [
  { name: "Paspor Indonesia", widthValue: 35, heightValue: 45, unit: "mm", note: "Standar paspor 35×45mm" },
  { name: "Visa Schengen", widthValue: 35, heightValue: 45, unit: "mm", note: "Standar visa Eropa" },
  { name: "Pas Foto 2×3", widthValue: 2, heightValue: 3, unit: "cm", note: "Pas foto lama" },
  { name: "Pas Foto 3×4", widthValue: 3, heightValue: 4, unit: "cm", note: "Standar Indonesia" },
  { name: "Pas Foto 4×6", widthValue: 4, heightValue: 6, unit: "cm", note: "Pas foto besar" },
  { name: "ID Card 2.5×3.5", widthValue: 2.5, heightValue: 3.5, unit: "cm", note: "Kartu identitas (CR80 setengah)" },
  { name: "KTP 5.4×8.6", widthValue: 5.4, heightValue: 8.6, unit: "cm", note: "Ukuran kartu KTP" },
  { name: "Foto Postcard 4×6", widthValue: 4, heightValue: 6, unit: "inch", note: "Standar foto cetak 4R" },
  { name: "Square Instagram", widthValue: 10, heightValue: 10, unit: "cm", note: "Kotak 1:1" },
  { name: "Foto Wallet 2×3", widthValue: 2, heightValue: 3, unit: "inch", note: "Foto dompet" },
];
