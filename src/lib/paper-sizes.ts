/**
 * Definisi ukuran kertas & auto-layout calculator
 * Mendukung A5, A4, A3 (potret & lanskap)
 */

export interface PaperSize {
  id: string;
  label: string;
  /** lebar dalam mm (potret) */
  widthMm: number;
  /** tinggi dalam mm (potret) */
  heightMm: number;
  /** pixel @ 300 dpi (satu sisi) */
  dpiPx: number;
}

const mmToInch = (mm: number) => mm / 25.4;
const mmToPx300 = (mm: number) => Math.round(mmToInch(mm) * 300);

export const PAPER_SIZES: PaperSize[] = [
  {
    id: "A5",
    label: "A5 (148×210 mm)",
    widthMm: 148,
    heightMm: 210,
    dpiPx: mmToPx300(148),
  },
  {
    id: "A4",
    label: "A4 (210×297 mm)",
    widthMm: 210,
    heightMm: 297,
    dpiPx: mmToPx300(210),
  },
  {
    id: "A3",
    label: "A3 (297×420 mm)",
    widthMm: 297,
    heightMm: 420,
    dpiPx: mmToPx300(297),
  },
];

export function getPaperSize(id: string): PaperSize | undefined {
  return PAPER_SIZES.find((p) => p.id === id);
}

export type Orientation = "portrait" | "landscape";

export interface Margin {
  top: number;
  right: number;
  bottom: number;
  left: number;
}

export const DEFAULT_MARGIN: Margin = {
  top: 5,
  right: 5,
  bottom: 5,
  left: 5,
};

/** Unit: mm */
export const DEFAULT_GAP = 3; // jarak antar potret foto

export interface LayoutItem {
  /** posisi x dalam mm dari pojok kiri atas kertas */
  xMm: number;
  /** posisi y dalam mm */
  yMm: number;
  /** lebar mm foto (setelah orientasi disesuaikan) */
  widthMm: number;
  /** tinggi mm foto */
  heightMm: number;
  /** indeks foto sumber (untuk multi-photo) */
  photoIndex: number;
}

export interface LayoutResult {
  items: LayoutItem[];
  cols: number;
  rows: number;
  count: number;
  /** total foto yang muat */
  totalFit: number;
  /** sisa ruang horizontal (mm) */
  remainingHorizontalMm: number;
  /** sisa ruang vertikal (mm) */
  remainingVerticalMm: number;
  /** dimensi kerja kertas (mm) */
  workWidthMm: number;
  workHeightMm: number;
}

export interface CalcLayoutParams {
  paperSize: PaperSize;
  orientation: Orientation;
  photoWidthMm: number;
  photoHeightMm: number;
  margin?: Margin;
  gap?: number;
  /** rotasikan foto 90 derajat untuk hemat ruang */
  allowRotatePhoto?: boolean;
}

/**
 * Hitung grid foto yang muat di kertas.
 * - Foto dipasang dengan orientasi yang sama (atau rotate bila diizinkan & hemat).
 * - Auto-layout: pilih orientasi foto (normal/rotate) yang menghasilkan jumlah maksimum.
 */
export function calculateLayout({
  paperSize,
  orientation,
  photoWidthMm,
  photoHeightMm,
  margin = DEFAULT_MARGIN,
  gap = DEFAULT_GAP,
  allowRotatePhoto = true,
}: CalcLayoutParams): LayoutResult {
  const paperWidthMm =
    orientation === "portrait" ? paperSize.widthMm : paperSize.heightMm;
  const paperHeightMm =
    orientation === "portrait" ? paperSize.heightMm : paperSize.widthMm;

  const workWidthMm = paperWidthMm - margin.left - margin.right;
  const workHeightMm = paperHeightMm - margin.top - margin.bottom;

  // Hitung untuk dua orientasi foto (normal vs rotate 90°)
  const variants: Array<{
    w: number;
    h: number;
    label: "normal" | "rotated";
  }> = [
    { w: photoWidthMm, h: photoHeightMm, label: "normal" },
    ...(allowRotatePhoto
      ? [{ w: photoHeightMm, h: photoWidthMm, label: "rotated" as const }]
      : []),
  ];

  let best: {
    variant: (typeof variants)[number];
    cols: number;
    rows: number;
    total: number;
  } | null = null;

  for (const v of variants) {
    const cols = Math.max(0, Math.floor((workWidthMm + gap) / (v.w + gap)));
    const rows = Math.max(0, Math.floor((workHeightMm + gap) / (v.h + gap)));
    const total = cols * rows;
    if (!best || total > best.total) {
      best = { variant: v, cols, rows, total };
    }
  }

  if (!best || best.total === 0) {
    return {
      items: [],
      cols: 0,
      rows: 0,
      count: 0,
      totalFit: 0,
      remainingHorizontalMm: workWidthMm,
      remainingVerticalMm: workHeightMm,
      workWidthMm,
      workHeightMm,
    };
  }

  // Center grid di dalam work area
  const gridWidthMm =
    best.cols * best.variant.w + Math.max(0, best.cols - 1) * gap;
  const gridHeightMm =
    best.rows * best.variant.h + Math.max(0, best.rows - 1) * gap;
  const offsetX = margin.left + (workWidthMm - gridWidthMm) / 2;
  const offsetY = margin.top + (workHeightMm - gridHeightMm) / 2;

  const items: LayoutItem[] = [];
  for (let r = 0; r < best.rows; r++) {
    for (let c = 0; c < best.cols; c++) {
      items.push({
        xMm: offsetX + c * (best.variant.w + gap),
        yMm: offsetY + r * (best.variant.h + gap),
        widthMm: best.variant.w,
        heightMm: best.variant.h,
        photoIndex: 0, // akan di-remap oleh caller (cycling photos)
      });
    }
  }

  return {
    items,
    cols: best.cols,
    rows: best.rows,
    count: items.length,
    totalFit: items.length,
    remainingHorizontalMm: Math.max(0, workWidthMm - gridWidthMm),
    remainingVerticalMm: Math.max(0, workHeightMm - gridHeightMm),
    workWidthMm,
    workHeightMm,
  };
}

/**
 * Hitung layout polaroid di kertas.
 * Polaroid punya bingkai putih tebal dengan area foto + ruang caption di bawah.
 */
export interface PolaroidLayoutItem extends LayoutItem {
  /** lebar area foto di dalam polaroid (mm) */
  photoWidthMm: number;
  /** tinggi area foto di dalam polaroid (mm) */
  photoHeightMm: number;
}

export interface CalcPolaroidLayoutParams {
  paperSize: PaperSize;
  orientation: Orientation;
  /** lebar total polaroid (mm) — kotak standar */
  polaroidWidthMm?: number;
  margin?: Margin;
  gap?: number;
}

export const POLAROID_DEFAULT_WIDTH = 62; // mm (~2.4 inchi, mirip instax mini)
export const POLAROID_PHOTO_RATIO = 1; // foto polaroid selalu kotak

/**
 * Polaroid klasik: lebar X, foto kotak di atas (margin ~5mm samping, 5mm atas),
 * caption di bawah ~25mm.
 */
export function calculatePolaroidLayout({
  paperSize,
  orientation,
  polaroidWidthMm = POLAROID_DEFAULT_WIDTH,
  margin = DEFAULT_MARGIN,
  gap = 4,
}: CalcPolaroidLayoutParams): {
  items: PolaroidLayoutItem[];
  cols: number;
  rows: number;
  count: number;
} {
  const polaroidHeightMm = polaroidWidthMm * 1.35; // rasio klasik ~1.35
  const photoSideMm = polaroidWidthMm - 10; // 5mm margin sisi kiri+kanan
  const photoOffsetTopMm = 5;
  const captionSpaceMm = polaroidHeightMm - photoSideMm - photoOffsetTopMm; // sisa untuk caption

  const paperWidthMm =
    orientation === "portrait" ? paperSize.widthMm : paperSize.heightMm;
  const paperHeightMm =
    orientation === "portrait" ? paperSize.heightMm : paperSize.widthMm;

  const workWidthMm = paperWidthMm - margin.left - margin.right;
  const workHeightMm = paperHeightMm - margin.top - margin.bottom;

  const cols = Math.max(0, Math.floor((workWidthMm + gap) / (polaroidWidthMm + gap)));
  const rows = Math.max(
    0,
    Math.floor((workHeightMm + gap) / (polaroidHeightMm + gap)),
  );

  if (cols === 0 || rows === 0) {
    return { items: [], cols: 0, rows: 0, count: 0 };
  }

  const gridWidthMm =
    cols * polaroidWidthMm + Math.max(0, cols - 1) * gap;
  const gridHeightMm =
    rows * polaroidHeightMm + Math.max(0, rows - 1) * gap;
  const offsetX = margin.left + (workWidthMm - gridWidthMm) / 2;
  const offsetY = margin.top + (workHeightMm - gridHeightMm) / 2;

  const items: PolaroidLayoutItem[] = [];
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      items.push({
        xMm: offsetX + c * (polaroidWidthMm + gap),
        yMm: offsetY + r * (polaroidHeightMm + gap),
        widthMm: polaroidWidthMm,
        heightMm: polaroidHeightMm,
        photoWidthMm: photoSideMm,
        photoHeightMm: photoSideMm,
        photoIndex: 0,
      });
    }
  }

  // gunakan captionSpaceMm untuk penanda
  void captionSpaceMm;

  return { items, cols, rows, count: items.length };
}

/**
 * Konversi mm → px pada DPI tertentu
 */
export function mmToPx(mm: number, dpi = 96): number {
  return Math.round((mm / 25.4) * dpi);
}

/**
 * Konversi mm → px untuk canvas preview @ 96 DPI (CSS)
 */
export function mmToCssPx(mm: number): number {
  return mmToPx(mm, 96);
}
