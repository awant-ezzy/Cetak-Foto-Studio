"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { FileText, Download, Printer, Trash2, X, FileImage, FileType } from "lucide-react";
import { UploadZone } from "@/components/upload/upload-zone";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Slider } from "@/components/ui/slider";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  ToggleGroup,
  ToggleGroupItem,
} from "@/components/ui/toggle-group";
import { toast } from "sonner";
import {
  PAPER_SIZES,
  getPaperSize,
  type Orientation,
  DEFAULT_MARGIN,
  mmToCssPx,
} from "@/lib/paper-sizes";
import { fitContain, loadImageFromFile } from "@/lib/image-processing";
import { downloadPdf, renderPageToCanvas } from "@/lib/pdf-utils";

type DocKind = "image" | "pdf-embed";

interface DocItem {
  id: string;
  kind: DocKind;
  file: File;
  url: string;
  /** untuk image: HTMLCanvasElement source */
  sourceCanvas?: HTMLCanvasElement;
  /** untuk PDF embed: data URL saja */
  name: string;
  sizeHuman: string;
}

function humanSize(bytes: number) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
}

export function DocumentPrinter() {
  const [docs, setDocs] = useState<DocItem[]>([]);
  const [paperId, setPaperId] = useState("A4");
  const [orientation, setOrientation] = useState<Orientation>("portrait");
  const [margin] = useState(DEFAULT_MARGIN);
  const [fitMode, setFitMode] = useState<"contain" | "actual">("contain");
  const [printLoading, setPrintLoading] = useState(false);
  const [pdfLoading, setPdfLoading] = useState(false);

  const handleFiles = useCallback((files: File[]) => {
    const accepted = files.filter((f) => {
      const isImage = f.type.startsWith("image/");
      const isPdf = f.type === "application/pdf" || f.name.toLowerCase().endsWith(".pdf");
      return isImage || isPdf;
    });
    if (accepted.length === 0) {
      toast.error("Format tidak didukung", {
        description: "Hanya gambar (JPG/PNG) atau PDF.",
      });
      return;
    }
    const newItems: DocItem[] = accepted.map((file) => ({
      id: `${Date.now()}-${Math.random().toString(36).slice(2)}`,
      kind:
        file.type === "application/pdf" || file.name.toLowerCase().endsWith(".pdf")
          ? "pdf-embed"
          : "image",
      file,
      url: URL.createObjectURL(file),
      name: file.name,
      sizeHuman: humanSize(file.size),
    }));
    setDocs((prev) => [...prev, ...newItems]);
    toast.success(`${accepted.length} dokumen ditambahkan`);

    // Preload images to source canvas
    newItems.forEach(async (item) => {
      if (item.kind !== "image") return;
      try {
        const img = await loadImageFromFile(item.file);
        const canvas = document.createElement("canvas");
        canvas.width = img.naturalWidth;
        canvas.height = img.naturalHeight;
        const ctx = canvas.getContext("2d")!;
        ctx.drawImage(img, 0, 0);
        setDocs((prev) =>
          prev.map((d) => (d.id === item.id ? { ...d, sourceCanvas: canvas } : d)),
        );
      } catch (e) {
        console.error(e);
      }
    });
  }, []);

  const removeDoc = (id: string) => {
    setDocs((prev) => {
      const t = prev.find((d) => d.id === id);
      if (t) URL.revokeObjectURL(t.url);
      return prev.filter((d) => d.id !== id);
    });
  };

  const clearAll = () => {
    docs.forEach((d) => URL.revokeObjectURL(d.url));
    setDocs([]);
  };

  const paper = getPaperSize(paperId)!;

  // Generate final canvas
  const generateFinalCanvas = useCallback(async (): Promise<HTMLCanvasElement | null> => {
    if (docs.length === 0) {
      toast.error("Belum ada dokumen");
      return null;
    }
    const dpi = 300;
    const paperWidthMm =
      orientation === "portrait" ? paper.widthMm : paper.heightMm;
    const paperHeightMm =
      orientation === "portrait" ? paper.heightMm : paper.widthMm;

    // Untuk PDF, gunakan data URL yang di-embed
    if (docs.length === 1 && docs[0].kind === "pdf-embed") {
      // Tidak bisa render PDF ke canvas tanpa pdf.js; gunakan embed tag untuk preview,
      // dan untuk PDF output langsung copy file original.
      // Kita buat canvas kosong dengan tanda placeholder.
      const canvas = document.createElement("canvas");
      const widthPx = Math.round((paperWidthMm / 25.4) * dpi);
      const heightPx = Math.round((paperHeightMm / 25.4) * dpi);
      canvas.width = widthPx;
      canvas.height = heightPx;
      const ctx = canvas.getContext("2d")!;
      ctx.fillStyle = "#ffffff";
      ctx.fillRect(0, 0, widthPx, heightPx);
      ctx.fillStyle = "#888888";
      ctx.font = "24px system-ui";
      ctx.textAlign = "center";
      ctx.fillText("PDF akan dicetak langsung", widthPx / 2, heightPx / 2);
      return canvas;
    }

    // Image mode: render image ke canvas kertas (contain)
    const items: Array<{
      xMm: number;
      yMm: number;
      widthMm: number;
      heightMm: number;
      canvas: HTMLCanvasElement;
    }> = [];

    docs
      .filter((d) => d.kind === "image" && d.sourceCanvas)
      .forEach((d) => {
        const canvas = d.sourceCanvas!;
        if (fitMode === "contain") {
          // Fit ke area kerja kertas (minus margin)
          const workW = paperWidthMm - margin.left - margin.right;
          const workH = paperHeightMm - margin.top - margin.bottom;
          const fittedMm = fitImageMm(
            canvas.width,
            canvas.height,
            workW,
            workH,
          );
          items.push({
            xMm: margin.left + (workW - fittedMm.w) / 2,
            yMm: margin.top + (workH - fittedMm.h) / 2,
            widthMm: fittedMm.w,
            heightMm: fittedMm.h,
            canvas,
          });
        } else {
          // Actual size: 1px = 1/300 inch (300 DPI)
          // convert px → mm: mm = px / 300 * 25.4
          const wMm = (canvas.width / 300) * 25.4;
          const hMm = (canvas.height / 300) * 25.4;
          items.push({
            xMm: margin.left,
            yMm: margin.top,
            widthMm: wMm,
            heightMm: hMm,
            canvas,
          });
        }
      });

    return renderPageToCanvas({
      paperWidthMm,
      paperHeightMm,
      items,
      dpi,
    });
  }, [docs, orientation, paper, fitMode, margin]);

  const handleDownloadPdf = async () => {
    setPdfLoading(true);
    try {
      // Untuk PDF original, download langsung
      const pdfDoc = docs.find((d) => d.kind === "pdf-embed");
      if (pdfDoc && docs.length === 1) {
        const a = document.createElement("a");
        a.href = pdfDoc.url;
        a.download = pdfDoc.name.endsWith(".pdf") ? pdfDoc.name : `${pdfDoc.name}.pdf`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        toast.success("PDF asli diunduh");
        return;
      }
      const canvas = await generateFinalCanvas();
      if (!canvas) return;
      downloadPdf(
        [{ canvas }],
        paper,
        orientation,
        `dokumen-${paperId}-${Date.now()}`,
      );
      toast.success("PDF berhasil diunduh");
    } catch (e) {
      console.error(e);
      toast.error("Gagal membuat PDF");
    } finally {
      setPdfLoading(false);
    }
  };

  const handlePrint = async () => {
    setPrintLoading(true);
    try {
      const pdfDoc = docs.find((d) => d.kind === "pdf-embed");
      if (pdfDoc && docs.length === 1) {
        // Buka PDF di tab baru untuk print langsung
        const win = window.open(pdfDoc.url, "_blank");
        if (!win) {
          toast.error("Popup diblokir", {
            description: "Izinkan popup untuk mencetak PDF.",
          });
          return;
        }
        toast.success("PDF dibuka di tab baru, tekan Ctrl+P untuk cetak");
        return;
      }
      const canvas = await generateFinalCanvas();
      if (!canvas) return;
      const dataUrl = canvas.toDataURL("image/jpeg", 0.92);
      const printArea = document.getElementById("print-area-document");
      if (printArea) {
        printArea.innerHTML = `<img src="${dataUrl}" style="width:100%;height:100%;object-fit:contain" />`;
        window.print();
      }
      toast.success("Dialog cetak terbuka");
    } catch (e) {
      console.error(e);
      toast.error("Gagal mencetak");
    } finally {
      setPrintLoading(false);
    }
  };

  const previewWidthMm =
    orientation === "portrait" ? paper.widthMm : paper.heightMm;
  const previewHeightMm =
    orientation === "portrait" ? paper.heightMm : paper.widthMm;
  const previewWidthPx = mmToCssPx(previewWidthMm);
  const previewHeightPx = mmToCssPx(previewHeightMm);
  const maxPreviewWidth = 700;
  const previewScale = Math.min(1, maxPreviewWidth / previewWidthPx);
  const finalPreviewWidth = previewWidthPx * previewScale;
  const finalPreviewHeight = previewHeightPx * previewScale;

  return (
    <div className="grid lg:grid-cols-[380px_1fr] gap-6">
      <div className="flex flex-col gap-4">
        <Card className="bg-card/60 border-border/60">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm flex items-center gap-2">
              <FileText className="h-4 w-4 text-neon-cyan" />
              1. Unggah Dokumen
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <UploadZone
              onFiles={handleFiles}
              multiple
              accept={{
                "image/*": [".jpg", ".jpeg", ".png", ".webp"],
                "application/pdf": [".pdf"],
              }}
              title="Tarik dokumen ke sini"
              subtitle="JPG/PNG/PDF · bisa banyak sekaligus"
              className="p-6"
            />
            {docs.length > 0 && (
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <Label className="text-xs">{docs.length} dokumen dimuat</Label>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={clearAll}
                    className="h-7 text-xs text-destructive hover:text-destructive"
                  >
                    <Trash2 className="h-3 w-3 mr-1" />
                    Hapus semua
                  </Button>
                </div>
                <div className="space-y-1.5 max-h-60 overflow-y-auto scrollbar-studio p-1">
                  {docs.map((d, idx) => (
                    <div
                      key={d.id}
                      className="flex items-center gap-2 p-2 rounded-lg bg-secondary/40 border border-border/60 group"
                    >
                      <div className="h-9 w-9 rounded-md bg-primary/20 flex items-center justify-center shrink-0">
                        {d.kind === "pdf-embed" ? (
                          <FileType className="h-4 w-4 text-neon-magenta" />
                        ) : (
                          <FileImage className="h-4 w-4 text-neon-cyan" />
                        )}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-xs font-medium truncate">{d.name}</p>
                        <p className="text-[10px] text-muted-foreground">
                          {d.sizeHuman} · #{idx + 1}
                        </p>
                      </div>
                      <button
                        onClick={() => removeDoc(d.id)}
                        className="h-6 w-6 rounded bg-black/40 hover:bg-destructive flex items-center justify-center text-white opacity-0 group-hover:opacity-100 transition-opacity"
                        aria-label="Hapus"
                      >
                        <X className="h-3 w-3" />
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        <Card className="bg-card/60 border-border/60">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm flex items-center gap-2">
              <FileText className="h-4 w-4 text-neon-cyan" />
              2. Atur Kertas
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-1.5">
              <Label className="text-xs">Ukuran Kertas</Label>
              <Select value={paperId} onValueChange={setPaperId}>
                <SelectTrigger className="h-9">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {PAPER_SIZES.map((p) => (
                    <SelectItem key={p.id} value={p.id}>
                      {p.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs">Orientasi</Label>
              <ToggleGroup
                type="single"
                value={orientation}
                onValueChange={(v) => v && setOrientation(v as Orientation)}
                className="justify-start"
              >
                <ToggleGroupItem value="portrait" className="text-xs">
                  Potret
                </ToggleGroupItem>
                <ToggleGroupItem value="landscape" className="text-xs">
                  Lanskap
                </ToggleGroupItem>
              </ToggleGroup>
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs">Mode Tampilan</Label>
              <ToggleGroup
                type="single"
                value={fitMode}
                onValueChange={(v) => v && setFitMode(v as "contain" | "actual")}
                className="justify-start"
              >
                <ToggleGroupItem value="contain" className="text-xs">
                  Pas di Kertas
                </ToggleGroupItem>
                <ToggleGroupItem value="actual" className="text-xs">
                  Ukuran Asli
                </ToggleGroupItem>
              </ToggleGroup>
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="flex flex-col gap-4">
        <Card className="bg-card/60 border-border/60 flex-1">
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between gap-2 flex-wrap">
              <CardTitle className="text-sm flex items-center gap-2">
                <FileText className="h-4 w-4 text-neon-cyan" />
                3. Preview Dokumen
              </CardTitle>
              <div className="flex items-center gap-2">
                <Badge variant="outline" className="text-[10px]">
                  {paper.id}
                </Badge>
                <Badge variant="outline" className="text-[10px]">
                  {orientation === "portrait" ? "Potret" : "Lanskap"}
                </Badge>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            {docs.length === 0 ? (
              <div className="flex flex-col items-center justify-center min-h-[500px] text-center">
                <div className="h-16 w-16 rounded-2xl bg-secondary/40 flex items-center justify-center mb-4">
                  <FileText className="h-8 w-8 text-muted-foreground" />
                </div>
                <p className="text-sm text-muted-foreground mb-1">
                  Unggah dokumen untuk preview
                </p>
                <p className="text-xs text-muted-foreground/70">
                  Mendukung JPG, PNG, dan PDF
                </p>
              </div>
            ) : (
              <div className="flex flex-col items-center gap-3">
                {/* Untuk image: render langsung ke canvas preview */}
                {docs[0].kind === "image" ? (
                  <div
                    className="bg-white rounded-sm shadow-2xl shadow-black/50 overflow-hidden"
                    style={{
                      width: finalPreviewWidth,
                      height: finalPreviewHeight,
                    }}
                  >
                    <ImagePreview
                      docs={docs.filter((d) => d.kind === "image")}
                      paperWidthMm={previewWidthMm}
                      paperHeightMm={previewHeightMm}
                      margin={margin}
                      fitMode={fitMode}
                    />
                  </div>
                ) : (
                  <div
                    className="bg-white rounded-sm shadow-2xl shadow-black/50 overflow-hidden"
                    style={{
                      width: finalPreviewWidth,
                      height: finalPreviewHeight,
                    }}
                  >
                    <embed
                      src={docs[0].url}
                      type="application/pdf"
                      className="w-full h-full"
                      aria-label={`Preview PDF ${docs[0].name}`}
                    />
                  </div>
                )}
                <div className="flex flex-wrap items-center justify-center gap-3 text-xs text-muted-foreground">
                  <span>
                    {docs.length} dokumen · {docs.filter((d) => d.kind === "image").length} gambar,{" "}
                    {docs.filter((d) => d.kind === "pdf-embed").length} PDF
                  </span>
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        <Card className="bg-card/60 border-border/60 no-print">
          <CardContent className="py-4 flex flex-wrap items-center justify-center gap-3">
            <Button
              variant="default"
              onClick={handlePrint}
              disabled={docs.length === 0 || printLoading}
              className="bg-neon-cyan text-background hover:bg-neon-cyan/90"
            >
              <Printer className="h-4 w-4 mr-2" />
              {printLoading ? "Menyiapkan..." : "Cetak Langsung"}
            </Button>
            <Button
              variant="outline"
              onClick={handleDownloadPdf}
              disabled={docs.length === 0 || pdfLoading}
              className="border-neon-magenta/50 text-neon-magenta hover:bg-neon-magenta/10"
            >
              <Download className="h-4 w-4 mr-2" />
              {pdfLoading ? "Membuat..." : "Download PDF"}
            </Button>
          </CardContent>
        </Card>
      </div>

      <div id="print-area-document" className="print-area hidden" aria-hidden="true" />
    </div>
  );
}

/** Helper: hitung ukuran gambar (mm) yang fit-contain di work area */
function fitImageMm(
  srcW: number,
  srcH: number,
  workWmm: number,
  workHmm: number,
): { w: number; h: number } {
  const srcRatio = srcW / srcH;
  const workRatio = workWmm / workHmm;
  if (srcRatio > workRatio) {
    // lebih lebar → fit by width
    const w = workWmm;
    const h = workWmm / srcRatio;
    return { w, h };
  } else {
    const h = workHmm;
    const w = workHmm * srcRatio;
    return { w, h };
  }
}

interface ImagePreviewProps {
  docs: DocItem[];
  paperWidthMm: number;
  paperHeightMm: number;
  margin: typeof DEFAULT_MARGIN;
  fitMode: "contain" | "actual";
}

function ImagePreview({ docs, paperWidthMm, paperHeightMm, margin, fitMode }: ImagePreviewProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  // Render preview
  useRenderPreview({
    canvasRef,
    docs,
    paperWidthMm,
    paperHeightMm,
    margin,
    fitMode,
  });

  return (
    <canvas
      ref={canvasRef}
      style={{
        width: "100%",
        height: "100%",
        display: "block",
      }}
    />
  );
}

function useRenderPreview({
  canvasRef,
  docs,
  paperWidthMm,
  paperHeightMm,
  margin,
  fitMode,
}: ImagePreviewProps & { canvasRef: React.RefObject<HTMLCanvasElement | null> }) {
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const dpi = 96;
    const widthPx = Math.round((paperWidthMm / 25.4) * dpi);
    const heightPx = Math.round((paperHeightMm / 25.4) * dpi);
    canvas.width = widthPx;
    canvas.height = heightPx;
    const ctx = canvas.getContext("2d")!;
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, widthPx, heightPx);

    docs.forEach((d, idx) => {
      if (!d.sourceCanvas) return;
      const workW = paperWidthMm - margin.left - margin.right;
      const workH = paperHeightMm - margin.top - margin.bottom;
      const fitted = fitImageMm(d.sourceCanvas.width, d.sourceCanvas.height, workW, workH);
      const itemX = (margin.left + (workW - fitted.w) / 2) / 25.4 * dpi;
      const itemY = (margin.top + (workH - fitted.h) / 2) / 25.4 * dpi;
      const itemW = fitted.w / 25.4 * dpi;
      const itemH = fitted.h / 25.4 * dpi;
      ctx.drawImage(d.sourceCanvas, itemX, itemY, itemW, itemH);
      // label number
      ctx.fillStyle = "rgba(0,0,0,0.5)";
      ctx.font = "10px system-ui";
      ctx.textAlign = "left";
      ctx.fillText(`#${idx + 1}`, itemX + 4, itemY + 14);
    });
  }, [canvasRef, docs, paperWidthMm, paperHeightMm, margin, fitMode]);
}
