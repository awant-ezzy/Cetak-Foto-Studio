/**
 * PDF generator utilities
 * Generate multi-page A5/A4/A3 PDF dari canvas berisi layout foto
 */
import { jsPDF } from "jspdf";
import type { PaperSize, Orientation } from "./paper-sizes";

export interface PdfPageSpec {
  /** canvas berisi halaman final (resolusi DPI 300) */
  canvas: HTMLCanvasElement;
}

/**
 * Generate PDF dari kumpulan canvas halaman.
 * @param pages array canvas per halaman
 * @param paperSize ukuran kertas target
 * @param orientation orientasi kertas
 * @returns jsPDF instance (untuk .save() atau .output())
 */
export function generatePdfFromCanvases(
  pages: PdfPageSpec[],
  paperSize: PaperSize,
  orientation: Orientation,
): jsPDF {
  const widthMm =
    orientation === "portrait" ? paperSize.widthMm : paperSize.heightMm;
  const heightMm =
    orientation === "portrait" ? paperSize.heightMm : paperSize.widthMm;

  const doc = new jsPDF({
    unit: "mm",
    format: [widthMm, heightMm],
    orientation: orientation === "portrait" ? "portrait" : "landscape",
    compress: true,
  });

  pages.forEach((page, idx) => {
    if (idx > 0) doc.addPage([widthMm, heightMm], orientation);
    const imgData = page.canvas.toDataURL("image/jpeg", 0.92);
    doc.addImage(imgData, "JPEG", 0, 0, widthMm, heightMm, undefined, "FAST");
  });

  return doc;
}

/**
 * Download PDF dengan nama file.
 */
export function downloadPdf(
  pages: PdfPageSpec[],
  paperSize: PaperSize,
  orientation: Orientation,
  filename: string,
): void {
  const doc = generatePdfFromCanvases(pages, paperSize, orientation);
  doc.save(filename.endsWith(".pdf") ? filename : `${filename}.pdf`);
}

/**
 * Render satu canvas halaman dari layout foto
 */
export interface RenderPageParams {
  paperWidthMm: number;
  paperHeightMm: number;
  /** daftar item foto yang sudah diposisikan (mm) */
  items: Array<{
    xMm: number;
    yMm: number;
    widthMm: number;
    heightMm: number;
    /** canvas source (sudah final/edit) */
    canvas: HTMLCanvasElement;
  }>;
  /** DPI target (default 300 untuk kualitas cetak) */
  dpi?: number;
  /** warna background kertas */
  background?: string;
}

/**
 * Render halaman akhir kertas berisi semua item foto.
 */
export function renderPageToCanvas({
  paperWidthMm,
  paperHeightMm,
  items,
  dpi = 300,
  background = "#ffffff",
}: RenderPageParams): HTMLCanvasElement {
  const widthPx = Math.round((paperWidthMm / 25.4) * dpi);
  const heightPx = Math.round((paperHeightMm / 25.4) * dpi);

  const canvas = document.createElement("canvas");
  canvas.width = widthPx;
  canvas.height = heightPx;
  const ctx = canvas.getContext("2d")!;

  // Background kertas putih
  ctx.fillStyle = background;
  ctx.fillRect(0, 0, widthPx, heightPx);

  // Gambar tiap item
  for (const item of items) {
    const itemW = Math.round((item.widthMm / 25.4) * dpi);
    const itemH = Math.round((item.heightMm / 25.4) * dpi);
    const itemX = Math.round((item.xMm / 25.4) * dpi);
    const itemY = Math.round((item.yMm / 25.4) * dpi);

    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = "high";
    ctx.drawImage(item.canvas, itemX, itemY, itemW, itemH);
  }

  return canvas;
}
