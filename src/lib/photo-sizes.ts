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
