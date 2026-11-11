"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Sparkles, Trash2, Download, Printer, X, Palette, Type } from "lucide-react";
import { UploadZone } from "@/components/upload/upload-zone";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Slider } from "@/components/ui/slider";
import { Switch } from "@/components/ui/switch";
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
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import {
  PAPER_SIZES,
  getPaperSize,
  calculatePolaroidLayout,
  type Orientation,
  DEFAULT_MARGIN,
  POLAROID_DEFAULT_WIDTH,
  mmToCssPx,
} from "@/lib/paper-sizes";
import { fitCover, loadImageFromFile } from "@/lib/image-processing";
import { downloadPdf, renderPageToCanvas } from "@/lib/pdf-utils";

interface PhotoItem {
  id: string;
  file: File;
  url: string;
}

interface CaptionItem {
  photoId: string;
  text: string;
}

const CAPTION_FONTS = [
  { id: "caveat", label: "Caveat (Tangan)", css: "'Caveat', cursive" },
  { id: "indie", label: "Indie Flower", css: "'Indie Flower', cursive" },
  { id: "kalam", label: "Kalam", css: "'Kalam', cursive" },
  { id: "patrick", label: "Patrick Hand", css: "'Patrick Hand', cursive" },
  { id: "system", label: "Sans (Sistem)", css: "system-ui, sans-serif" },
];

export function PolaroidMaker() {
  const [photos, setPhotos] = useState<PhotoItem[]>([]);
  const [captions, setCaptions] = useState<Record<string, string>>({});
  const [paperId, setPaperId] = useState("A4");
  const [orientation, setOrientation] = useState<Orientation>("portrait");
  const [polaroidWidth, setPolaroidWidth] = useState(POLAROID_DEFAULT_WIDTH);
  const [gap, setGap] = useState(4);
  const [margin] = useState(DEFAULT_MARGIN);
  const [repeatMode, setRepeatMode] = useState(true);
  const [showCaptions, setShowCaptions] = useState(true);
  const [captionFont, setCaptionFont] = useState("caveat");
  const [captionColor, setCaptionColor] = useState("#1c1c1c");
  const [vintage, setVintage] = useState(false);
  const [printLoading, setPrintLoading] = useState(false);
  const [pdfLoading, setPdfLoading] = useState(false);

  const previewCanvasRef = useRef<HTMLCanvasElement>(null);
  const photoCanvasesRef = useRef<Map<string, HTMLCanvasElement>>(new Map());

  const handleFiles = useCallback((files: File[]) => {
    const valid = files.filter((f) => f.type.startsWith("image/"));
    if (valid.length === 0) {
      toast.error("File tidak valid");
      return;
    }
    const newItems: PhotoItem[] = valid.map((file) => ({
      id: `${Date.now()}-${Math.random().toString(36).slice(2)}`,
      file,
      url: URL.createObjectURL(file),
    }));
    setPhotos((prev) => [...prev, ...newItems]);
    toast.success(`${valid.length} foto ditambahkan`);
  }, []);

  const removePhoto = (id: string) => {
    setPhotos((prev) => {
      const t = prev.find((p) => p.id === id);
      if (t) URL.revokeObjectURL(t.url);
      return prev.filter((p) => p.id !== id);
    });
  };

  const clearAll = () => {
    photos.forEach((p) => URL.revokeObjectURL(p.url));
    setPhotos([]);
    setCaptions({});
  };

  const paper = getPaperSize(paperId)!;
  const layout = useMemo(
    () =>
      calculatePolaroidLayout({
        paperSize: paper,
        orientation,
        polaroidWidthMm: polaroidWidth,
        margin,
        gap,
      }),
    [paper, orientation, polaroidWidth, margin, gap],
  );

  // Preload photos
  useEffect(() => {
    photos.forEach(async (p) => {
      if (photoCanvasesRef.current.has(p.id)) return;
      try {
        const img = await loadImageFromFile(p.file);
        const canvas = document.createElement("canvas");
        canvas.width = img.naturalWidth;
        canvas.height = img.naturalHeight;
        const ctx = canvas.getContext("2d")!;
        ctx.drawImage(img, 0, 0);
        photoCanvasesRef.current.set(p.id, canvas);
      } catch (e) {
        console.error(e);
      }
    });
  }, [photos]);

  const photoAssignments = useMemo(() => {
    if (photos.length === 0) return [];
    return layout.items.map((item, idx) => ({
      ...item,
      photoIndex: idx % photos.length,
    }));
  }, [layout.items, photos.length]);

  // Render preview
  const renderPreview = useCallback(() => {
    const canvas = previewCanvasRef.current;
    if (!canvas) return;
    const paperWidthMm =
      orientation === "portrait" ? paper.widthMm : paper.heightMm;
    const paperHeightMm =
      orientation === "portrait" ? paper.heightMm : paper.widthMm;
    const widthPx = mmToCssPx(paperWidthMm);
    const heightPx = mmToCssPx(paperHeightMm);
    canvas.width = widthPx;
    canvas.height = heightPx;
    const ctx = canvas.getContext("2d")!;
    // Soft background (kertas)
    ctx.fillStyle = "#fafaf7";
    ctx.fillRect(0, 0, widthPx, heightPx);

    if (photos.length === 0 || layout.items.length === 0) return;

    photoAssignments.forEach((item) => {
      const photo = photos[item.photoIndex];
      if (!photo) return;
      const sourceCanvas = photoCanvasesRef.current.get(photo.id);
      if (!sourceCanvas) return;

      const x = mmToCssPx(item.xMm);
      const y = mmToCssPx(item.yMm);
      const w = mmToCssPx(item.widthMm);
      const h = mmToCssPx(item.heightMm);
      const photoSidePx = mmToCssPx(item.photoWidthMm);

      // Draw polaroid card (white)
      ctx.fillStyle = "#ffffff";
      // subtle shadow
      ctx.shadowColor = "rgba(0,0,0,0.18)";
      ctx.shadowBlur = 4;
      ctx.shadowOffsetY = 2;
      ctx.fillRect(x, y, w, h);
      ctx.shadowColor = "transparent";
      ctx.shadowBlur = 0;
      ctx.shadowOffsetY = 0;

      // Photo area: 5mm margin top/left/right
      const padPx = mmToCssPx(5);
      const photoX = x + padPx;
      const photoY = y + padPx;
      const photoW = photoSidePx;
      const photoH = photoSidePx;

      const fitted = fitCover(
        sourceCanvas,
        Math.max(2, Math.round(photoW)),
        Math.max(2, Math.round(photoH)),
      );
      ctx.drawImage(fitted, photoX, photoY, photoW, photoH);

      // Optional vintage effect (overlay)
      if (vintage) {
        ctx.save();
        ctx.globalCompositeOperation = "multiply";
        ctx.fillStyle = "rgba(220, 180, 120, 0.18)";
        ctx.fillRect(photoX, photoY, photoW, photoH);
        ctx.globalCompositeOperation = "screen";
        ctx.fillStyle = "rgba(255, 240, 220, 0.1)";
        ctx.fillRect(photoX, photoY, photoW, photoH);
        ctx.restore();
      }

      // Caption (di area bawah polaroid)
      if (showCaptions) {
        const captionText = captions[photo.id] ?? "";
        const fontCss =
          CAPTION_FONTS.find((f) => f.id === captionFont)?.css ??
          "system-ui, sans-serif";
        // tinggi caption area = h - padPx - photoSidePx - padPx
        const captionAreaH = h - padPx - photoSidePx - padPx;
        const captionY = y + padPx + photoSidePx + captionAreaH / 2;
        // ukuran font adaptif
        const fontSize = Math.max(10, Math.round(w * 0.16));
        ctx.fillStyle = captionColor;
        ctx.font = `${fontSize}px ${fontCss}`;
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";
        ctx.fillText(captionText.slice(0, 30) || "", x + w / 2, captionY);
      }
    });
  }, [
    photos,
    layout.items,
    orientation,
    paper,
    photoAssignments,
    captions,
    showCaptions,
    captionFont,
    captionColor,
    vintage,
  ]);

  useEffect(() => {
    renderPreview();
  }, [renderPreview]);

  // Generate final canvas @ 300 DPI
  const generateFinalCanvas = useCallback(async (): Promise<HTMLCanvasElement | null> => {
    if (photos.length === 0) {
      toast.error("Belum ada foto");
      return null;
    }
    for (const p of photos) {
      if (!photoCanvasesRef.current.has(p.id)) {
        try {
          const img = await loadImageFromFile(p.file);
          const canvas = document.createElement("canvas");
          canvas.width = img.naturalWidth;
          canvas.height = img.naturalHeight;
          const ctx = canvas.getContext("2d")!;
          ctx.drawImage(img, 0, 0);
          photoCanvasesRef.current.set(p.id, canvas);
        } catch {
          /* ignore */
        }
      }
    }

    const dpi = 300;
    const paperWidthMm =
      orientation === "portrait" ? paper.widthMm : paper.heightMm;
    const paperHeightMm =
      orientation === "portrait" ? paper.heightMm : paper.widthMm;
    const widthPx = Math.round((paperWidthMm / 25.4) * dpi);
    const heightPx = Math.round((paperHeightMm / 25.4) * dpi);

    const canvas = document.createElement("canvas");
    canvas.width = widthPx;
    canvas.height = heightPx;
    const ctx = canvas.getContext("2d")!;
    ctx.fillStyle = "#fafaf7";
    ctx.fillRect(0, 0, widthPx, heightPx);

    photoAssignments.forEach((item) => {
      const photo = photos[item.photoIndex];
      if (!photo) return;
      const sourceCanvas = photoCanvasesRef.current.get(photo.id);
      if (!sourceCanvas) return;

      const x = (item.xMm / 25.4) * dpi;
      const y = (item.yMm / 25.4) * dpi;
      const w = (item.widthMm / 25.4) * dpi;
      const h = (item.heightMm / 25.4) * dpi;
      const photoSidePx = (item.photoWidthMm / 25.4) * dpi;

      // Shadow
      ctx.save();
      ctx.shadowColor = "rgba(0,0,0,0.22)";
      ctx.shadowBlur = 8;
      ctx.shadowOffsetY = 4;
      ctx.fillStyle = "#ffffff";
      ctx.fillRect(x, y, w, h);
      ctx.restore();

      // Photo
      const padPx = (5 / 25.4) * dpi;
      const photoX = x + padPx;
      const photoY = y + padPx;
      const fitted = fitCover(
        sourceCanvas,
        Math.round(photoSidePx),
        Math.round(photoSidePx),
      );
      ctx.drawImage(fitted, photoX, photoY, photoSidePx, photoSidePx);

      if (vintage) {
        ctx.save();
        ctx.globalCompositeOperation = "multiply";
        ctx.fillStyle = "rgba(220, 180, 120, 0.18)";
        ctx.fillRect(photoX, photoY, photoSidePx, photoSidePx);
        ctx.globalCompositeOperation = "screen";
        ctx.fillStyle = "rgba(255, 240, 220, 0.1)";
        ctx.fillRect(photoX, photoY, photoSidePx, photoSidePx);
        ctx.restore();
      }

      // Caption
      if (showCaptions) {
        const captionText = captions[photo.id] ?? "";
        const fontCss =
          CAPTION_FONTS.find((f) => f.id === captionFont)?.css ??
          "system-ui, sans-serif";
        const captionAreaH = h - padPx - photoSidePx - padPx;
        const captionY = y + padPx + photoSidePx + captionAreaH / 2;
        const fontSize = Math.max(20, Math.round(w * 0.16));
        ctx.fillStyle = captionColor;
        ctx.font = `${fontSize}px ${fontCss}`;
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";
        ctx.fillText(captionText.slice(0, 30) || "", x + w / 2, captionY);
      }
    });

    return canvas;
  }, [
    photos,
    photoAssignments,
    orientation,
    paper,
    captions,
    showCaptions,
    captionFont,
    captionColor,
    vintage,
  ]);

  const handleDownloadPdf = async () => {
    setPdfLoading(true);
    try {
      const canvas = await generateFinalCanvas();
      if (!canvas) return;
      downloadPdf(
        [{ canvas }],
        paper,
        orientation,
        `polaroid-${paperId}-${Date.now()}`,
      );
      toast.success("PDF polaroid berhasil diunduh");
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
      const canvas = await generateFinalCanvas();
      if (!canvas) return;
      const dataUrl = canvas.toDataURL("image/jpeg", 0.92);
      const printArea = document.getElementById("print-area-polaroid");
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
              <Sparkles className="h-4 w-4 text-neon-magenta" />
              1. Unggah Foto
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <UploadZone
              onFiles={handleFiles}
              multiple
              title="Tarik foto polaroid ke sini"
              subtitle="JPG/PNG · bisa banyak sekaligus"
              className="p-6"
            />
            {photos.length > 0 && (
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <Label className="text-xs">{photos.length} foto dimuat</Label>
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
                <div className="grid grid-cols-4 gap-2 max-h-40 overflow-y-auto scrollbar-studio p-1">
                  {photos.map((p, idx) => (
                    <div
                      key={p.id}
                      className="relative aspect-square rounded-md overflow-hidden border border-border bg-secondary/40 group"
                    >
                      <img
                        src={p.url}
                        alt={`Polaroid ${idx + 1}`}
                        className="w-full h-full object-cover"
                      />
                      <button
                        onClick={() => removePhoto(p.id)}
                        className="absolute top-1 right-1 h-5 w-5 rounded bg-black/70 hover:bg-destructive flex items-center justify-center text-white opacity-0 group-hover:opacity-100 transition-opacity"
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
              <Palette className="h-4 w-4 text-neon-magenta" />
              2. Atur Polaroid
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

            <div className="space-y-1">
              <Label className="text-xs flex items-center justify-between">
                <span>Ukuran Polaroid</span>
                <span className="text-neon-magenta">{polaroidWidth}mm</span>
              </Label>
              <Slider
                value={[polaroidWidth]}
                min={40}
                max={150}
                step={1}
                onValueChange={(v) => setPolaroidWidth(v[0])}
              />
              <p className="text-[10px] text-muted-foreground">
                Standar instax mini ~62mm, instax wide ~108mm
              </p>
            </div>

            <div className="space-y-1">
              <Label className="text-xs flex items-center justify-between">
                <span>Jarak Antar Polaroid</span>
                <span className="text-neon-magenta">{gap}mm</span>
              </Label>
              <Slider
                value={[gap]}
                min={0}
                max={15}
                step={0.5}
                onValueChange={(v) => setGap(v[0])}
              />
            </div>

            <div className="flex items-center justify-between gap-2 p-3 rounded-lg bg-secondary/30 border border-border/60">
              <div className="flex flex-col">
                <Label className="text-xs font-medium">Mode Ulang</Label>
                <span className="text-[10px] text-muted-foreground">
                  1 foto dipakai untuk semua slot
                </span>
              </div>
              <Switch checked={repeatMode} onCheckedChange={setRepeatMode} />
            </div>

            <div className="flex items-center justify-between gap-2 p-3 rounded-lg bg-secondary/30 border border-border/60">
              <div className="flex flex-col">
                <Label className="text-xs font-medium">Efek Vintage</Label>
                <span className="text-[10px] text-muted-foreground">
                  Tone hangat lembut
                </span>
              </div>
              <Switch checked={vintage} onCheckedChange={setVintage} />
            </div>

            <div className="flex items-center justify-between gap-2 p-3 rounded-lg bg-secondary/30 border border-border/60">
              <div className="flex flex-col">
                <Label className="text-xs font-medium flex items-center gap-1">
                  <Type className="h-3 w-3" /> Caption Tangan
                </Label>
                <span className="text-[10px] text-muted-foreground">
                  Tulisan di bawah foto
                </span>
              </div>
              <Switch checked={showCaptions} onCheckedChange={setShowCaptions} />
            </div>

            {showCaptions && (
              <div className="space-y-3 p-3 rounded-lg bg-secondary/20 border border-border/60">
                <div className="space-y-1.5">
                  <Label className="text-xs">Font Caption</Label>
                  <Select value={captionFont} onValueChange={setCaptionFont}>
                    <SelectTrigger className="h-9">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {CAPTION_FONTS.map((f) => (
                        <SelectItem key={f.id} value={f.id}>
                          {f.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs">Warna Caption</Label>
                  <div className="flex gap-2 items-center">
                    <Input
                      type="color"
                      value={captionColor}
                      onChange={(e) => setCaptionColor(e.target.value)}
                      className="w-10 h-9 p-1 cursor-pointer"
                    />
                    <Input
                      value={captionColor}
                      onChange={(e) => setCaptionColor(e.target.value)}
                      className="flex-1 h-9 font-mono text-xs"
                    />
                  </div>
                </div>
              </div>
            )}

            {showCaptions && photos.length > 0 && (
              <div className="space-y-2">
                <Label className="text-xs">Caption per foto</Label>
                <div className="space-y-1.5 max-h-40 overflow-y-auto scrollbar-studio p-1">
                  {photos.map((p, idx) => (
                    <Input
                      key={p.id}
                      placeholder={`Caption untuk foto #${idx + 1}`}
                      value={captions[p.id] ?? ""}
                      onChange={(e) =>
                        setCaptions((prev) => ({
                          ...prev,
                          [p.id]: e.target.value,
                        }))
                      }
                      className="h-8 text-xs"
                      maxLength={30}
                    />
                  ))}
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      <div className="flex flex-col gap-4">
        <Card className="bg-card/60 border-border/60 flex-1">
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between gap-2 flex-wrap">
              <CardTitle className="text-sm flex items-center gap-2">
                <Sparkles className="h-4 w-4 text-neon-magenta" />
                3. Preview Polaroid
              </CardTitle>
              <div className="flex items-center gap-2">
                <Badge variant="outline" className="text-[10px] gap-1">
                  {paper.id}
                </Badge>
                <Badge
                  variant="outline"
                  className="text-[10px] gap-1 text-neon-magenta border-neon-magenta/40"
                >
                  {layout.count} pcs polaroid
                </Badge>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            {photos.length === 0 ? (
              <div className="flex flex-col items-center justify-center min-h-[500px] text-center">
                <div className="h-16 w-16 rounded-2xl bg-secondary/40 flex items-center justify-center mb-4">
                  <Sparkles className="h-8 w-8 text-muted-foreground" />
                </div>
                <p className="text-sm text-muted-foreground mb-1">
                  Unggah foto untuk membuat polaroid
                </p>
                <p className="text-xs text-muted-foreground/70">
                  Setiap foto akan otomatis diberi bingkai polaroid klasik putih
                </p>
              </div>
            ) : layout.count === 0 ? (
              <div className="flex flex-col items-center justify-center min-h-[500px] text-center">
                <p className="text-sm text-muted-foreground">
                  Polaroid terlalu besar untuk kertas {paper.id}
                </p>
                <p className="text-xs text-muted-foreground/70 mt-1">
                  Kurangi ukuran polaroid atau pilih kertas lebih besar
                </p>
              </div>
            ) : (
              <div className="flex flex-col items-center gap-3">
                <div
                  className="bg-white rounded-sm shadow-2xl shadow-black/50 overflow-hidden"
                  style={{
                    width: finalPreviewWidth,
                    height: finalPreviewHeight,
                  }}
                >
                  <canvas
                    ref={previewCanvasRef}
                    style={{
                      width: finalPreviewWidth,
                      height: finalPreviewHeight,
                      display: "block",
                    }}
                  />
                </div>
                <div className="flex flex-wrap items-center justify-center gap-3 text-xs text-muted-foreground">
                  <span>
                    Grid: <strong className="text-foreground">{layout.cols}</strong>×
                    <strong className="text-foreground">{layout.rows}</strong>
                  </span>
                  <span>·</span>
                  <span>
                    Ukuran: <strong className="text-neon-magenta">{polaroidWidth}×
                    {Math.round(polaroidWidth * 1.35)}mm</strong>
                  </span>
                  {showCaptions && (
                    <>
                      <span>·</span>
                      <span className="text-neon-magenta">+ Caption</span>
                    </>
                  )}
                  {vintage && (
                    <>
                      <span>·</span>
                      <span className="text-neon-magenta">+ Vintage</span>
                    </>
                  )}
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
              disabled={photos.length === 0 || printLoading}
              className="bg-neon-magenta text-background hover:bg-neon-magenta/90"
            >
              <Printer className="h-4 w-4 mr-2" />
              {printLoading ? "Menyiapkan..." : "Cetak Langsung"}
            </Button>
            <Button
              variant="outline"
              onClick={handleDownloadPdf}
              disabled={photos.length === 0 || pdfLoading}
              className="border-neon-cyan/50 text-neon-cyan hover:bg-neon-cyan/10"
            >
              <Download className="h-4 w-4 mr-2" />
              {pdfLoading ? "Membuat..." : "Download PDF"}
            </Button>
          </CardContent>
        </Card>
      </div>

      <div id="print-area-polaroid" className="print-area hidden" aria-hidden="true" />
    </div>
  );
}
