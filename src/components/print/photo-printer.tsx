"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Upload, Trash2, Download, Printer, Image as ImageIcon, RotateCw, X, Plus, Ruler } from "lucide-react";
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
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogTrigger,
} from "@/components/ui/dialog";
import { toast } from "sonner";
import {
  PHOTO_SIZES,
  getPhotoSize,
  PAS_PHOTO_SIZES,
  R_PHOTO_SIZES,
  type PhotoSize,
  type CustomPhotoTemplate,
  type SizeUnit,
  createCustomTemplate,
  customTemplateToPhotoSize,
  loadCustomTemplates,
  saveCustomTemplates,
  TEMPLATE_PRESETS,
  UNIT_TO_MM,
} from "@/lib/photo-sizes";
import {
  PAPER_SIZES,
  getPaperSize,
  calculateLayout,
  type Orientation,
  DEFAULT_MARGIN,
  DEFAULT_GAP,
} from "@/lib/paper-sizes";
import { fitCover, loadImageFromFile } from "@/lib/image-processing";
import { downloadPdf, renderPageToCanvas } from "@/lib/pdf-utils";
import { mmToCssPx } from "@/lib/paper-sizes";

interface PhotoItem {
  id: string;
  file: File;
  url: string;
  /** canvas source asli (untuk caching) */
  sourceCanvas?: HTMLCanvasElement;
}

interface PhotoPrinterProps {
  /** shared photo library dari Editor (opsional) */
  initialPhotos?: PhotoItem[];
}

export function PhotoPrinter({ initialPhotos }: PhotoPrinterProps) {
  const [photos, setPhotos] = useState<PhotoItem[]>(initialPhotos ?? []);
  const [paperId, setPaperId] = useState("A4");
  const [orientation, setOrientation] = useState<Orientation>("portrait");
  const [photoSizeId, setPhotoSizeId] = useState("3x4");
  const [margin, setMargin] = useState(DEFAULT_MARGIN);
  const [gap, setGap] = useState(DEFAULT_GAP);
  const [allowRotatePhoto, setAllowRotatePhoto] = useState(true);
  /** repeat mode: 1 foto dipakai untuk semua slot */
  const [repeatMode, setRepeatMode] = useState(true);
  const [printLoading, setPrintLoading] = useState(false);
  const [pdfLoading, setPdfLoading] = useState(false);

  // Custom templates state
  const [customTemplates, setCustomTemplates] = useState<CustomPhotoTemplate[]>([]);
  const [showTemplateDialog, setShowTemplateDialog] = useState(false);
  // form state for new template
  const [tplName, setTplName] = useState("");
  const [tplWidth, setTplWidth] = useState("35");
  const [tplHeight, setTplHeight] = useState("45");
  const [tplUnit, setTplUnit] = useState<SizeUnit>("mm");

  // Load custom templates on mount
  useEffect(() => {
    setCustomTemplates(loadCustomTemplates());
  }, []);

  // Persist custom templates whenever they change
  useEffect(() => {
    saveCustomTemplates(customTemplates);
  }, [customTemplates]);

  const previewCanvasRef = useRef<HTMLCanvasElement>(null);

  const handleAddTemplate = () => {
    const w = parseFloat(tplWidth);
    const h = parseFloat(tplHeight);
    if (Number.isNaN(w) || Number.isNaN(h) || w <= 0 || h <= 0) {
      toast.error("Ukuran tidak valid", {
        description: "Lebar dan tinggi harus angka positif.",
      });
      return;
    }
    if (w > 1000 || h > 1000) {
      toast.error("Ukuran terlalu besar", {
        description: "Maksimal 1000 unit (mm/cm/inci).",
      });
      return;
    }
    const tpl = createCustomTemplate(tplName, w, h, tplUnit);
    setCustomTemplates((prev) => [...prev, tpl]);
    setPhotoSizeId(tpl.id);
    setShowTemplateDialog(false);
    setTplName("");
    setTplWidth("35");
    setTplHeight("45");
    setTplUnit("mm");
    toast.success(`Template "${tpl.name}" dibuat`, {
      description: `${w}×${h} ${tplUnit} = ${tpl.widthMm}×${tpl.heightMm} mm`,
    });
  };

  const handleDeleteTemplate = (id: string) => {
    setCustomTemplates((prev) => prev.filter((t) => t.id !== id));
    if (photoSizeId === id) setPhotoSizeId("3x4");
    toast.success("Template dihapus");
  };

  const handleApplyPreset = (preset: (typeof TEMPLATE_PRESETS)[number]) => {
    setTplName(preset.name);
    setTplWidth(String(preset.widthValue));
    setTplHeight(String(preset.heightValue));
    setTplUnit(preset.unit);
  };

  const handleFiles = useCallback((files: File[]) => {
    const valid = files.filter((f) => f.type.startsWith("image/"));
    if (valid.length === 0) {
      toast.error("File tidak valid", {
        description: "Hanya file gambar yang didukung.",
      });
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
      const target = prev.find((p) => p.id === id);
      if (target) URL.revokeObjectURL(target.url);
      return prev.filter((p) => p.id !== id);
    });
  };

  const clearAll = () => {
    photos.forEach((p) => URL.revokeObjectURL(p.url));
    setPhotos([]);
  };

  // Compute layout
  const paper = getPaperSize(paperId)!;
  // Cari photoSize dari standar atau custom templates
  const photoSize: PhotoSize = useMemo(() => {
    const std = getPhotoSize(photoSizeId);
    if (std) return std;
    const custom = customTemplates.find((t) => t.id === photoSizeId);
    if (custom) return customTemplateToPhotoSize(custom);
    // fallback ke 3x4
    return getPhotoSize("3x4")!;
  }, [photoSizeId, customTemplates]);

  const layout = useMemo(
    () =>
      calculateLayout({
        paperSize: paper,
        orientation,
        photoWidthMm: photoSize.widthMm,
        photoHeightMm: photoSize.heightMm,
        margin,
        gap,
        allowRotatePhoto,
      }),
    [paper, orientation, photoSize, margin, gap, allowRotatePhoto],
  );

  /** Map photo ke slot (cycling bila photos.length < layout.count) */
  const photoAssignments = useMemo(() => {
    if (photos.length === 0) return [];
    return layout.items.map((item, idx) => ({
      ...item,
      photoIndex: repeatMode ? idx % photos.length : idx % photos.length,
    }));
  }, [layout.items, photos.length, repeatMode]);

  // Pre-render each photo to a canvas matching photo slot dimensions (px @ 300 DPI)
  const photoCanvasesRef = useRef<Map<string, HTMLCanvasElement>>(new Map());

  useEffect(() => {
    // preload photos to source canvases
    photos.forEach(async (p) => {
      if (photoCanvasesRef.current.has(p.id)) return;
      try {
        const img = await loadImageFromFile(p.file);
        // Simpan canvas asli untuk dipakai saat render
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

  // Render preview
  const renderPreview = useCallback(() => {
    const canvas = previewCanvasRef.current;
    if (!canvas) return;
    const previewDpi = 96; // CSS preview
    const paperWidthMm =
      orientation === "portrait" ? paper.widthMm : paper.heightMm;
    const paperHeightMm =
      orientation === "portrait" ? paper.heightMm : paper.widthMm;
    const widthPx = mmToCssPx(paperWidthMm);
    const heightPx = mmToCssPx(paperHeightMm);
    canvas.width = widthPx;
    canvas.height = heightPx;
    const ctx = canvas.getContext("2d")!;
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, widthPx, heightPx);

    if (photos.length === 0 || layout.items.length === 0) return;

    // Draw each item
    photoAssignments.forEach((item) => {
      const photo = photos[item.photoIndex];
      if (!photo) return;
      const sourceCanvas = photoCanvasesRef.current.get(photo.id);
      if (!sourceCanvas) return;
      const itemX = mmToCssPx(item.xMm);
      const itemY = mmToCssPx(item.yMm);
      const itemW = mmToCssPx(item.widthMm);
      const itemH = mmToCssPx(item.heightMm);

      // cover-fit
      const tmp = fitCover(
        sourceCanvas,
        Math.max(2, Math.round(itemW)),
        Math.max(2, Math.round(itemH)),
      );
      ctx.drawImage(tmp, itemX, itemY, itemW, itemH);

      // border tipis
      ctx.strokeStyle = "rgba(0,0,0,0.12)";
      ctx.lineWidth = 1;
      ctx.strokeRect(itemX + 0.5, itemY + 0.5, itemW - 1, itemH - 1);
    });
  }, [photos, layout.items, orientation, paper, photoAssignments]);

  useEffect(() => {
    renderPreview();
  }, [renderPreview]);

  // Generate final canvases (DPI 300) for PDF & print
  const generateFinalCanvas = useCallback(async (): Promise<HTMLCanvasElement | null> => {
    if (photos.length === 0) {
      toast.error("Belum ada foto", {
        description: "Unggah minimal 1 foto untuk membuat cetakan.",
      });
      return null;
    }
    // pastikan semua foto sudah pre-loaded
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

    const items: Array<{
      xMm: number;
      yMm: number;
      widthMm: number;
      heightMm: number;
      canvas: HTMLCanvasElement;
    }> = [];
    for (const item of photoAssignments) {
      const photo = photos[item.photoIndex];
      if (!photo) continue;
      const sourceCanvas = photoCanvasesRef.current.get(photo.id);
      if (!sourceCanvas) continue;
      // Render foto ke dimensi item @ DPI
      const itemWPx = Math.max(2, Math.round((item.widthMm / 25.4) * dpi));
      const itemHPx = Math.max(2, Math.round((item.heightMm / 25.4) * dpi));
      const fitted = fitCover(sourceCanvas, itemWPx, itemHPx);
      items.push({
        xMm: item.xMm,
        yMm: item.yMm,
        widthMm: item.widthMm,
        heightMm: item.heightMm,
        canvas: fitted,
      });
    }

    return renderPageToCanvas({
      paperWidthMm,
      paperHeightMm,
      items,
      dpi,
    });
  }, [photos, photoAssignments, orientation, paper]);

  const handleDownloadPdf = async () => {
    setPdfLoading(true);
    try {
      const canvas = await generateFinalCanvas();
      if (!canvas) return;
      downloadPdf(
        [{ canvas }],
        paper,
        orientation,
        `cetak-foto-${photoSizeId}-${paperId}-${Date.now()}`,
      );
      toast.success("PDF berhasil diunduh", {
        description: "Buka PDF dan cetak dari aplikasi pembaca.",
      });
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
      // Render ke elemen print-area yang terpisah
      const dataUrl = canvas.toDataURL("image/jpeg", 0.92);
      const printArea = document.getElementById("print-area-photo");
      if (printArea) {
        printArea.innerHTML = `<img src="${dataUrl}" style="width:100%;height:100%;object-fit:contain" />`;
        // Trigger print
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

  // Scale preview to fit container (max 700px)
  const maxPreviewWidth = 700;
  const previewScale = Math.min(1, maxPreviewWidth / previewWidthPx);
  const finalPreviewWidth = previewWidthPx * previewScale;
  const finalPreviewHeight = previewHeightPx * previewScale;

  return (
    <div className="grid lg:grid-cols-[380px_1fr] gap-6">
      {/* LEFT: Settings panel */}
      <div className="flex flex-col gap-4">
        <Card className="bg-card/60 border-border/60">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm flex items-center gap-2">
              <Upload className="h-4 w-4 text-neon-cyan" />
              1. Unggah Foto
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <UploadZone
              onFiles={handleFiles}
              multiple
              title="Tarik foto ke sini"
              subtitle="JPG/PNG · bisa banyak sekaligus"
              className="p-6"
            />
            {photos.length > 0 && (
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <Label className="text-xs">
                    {photos.length} foto dimuat
                  </Label>
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
                        alt={`Foto ${idx + 1}`}
                        className="w-full h-full object-cover"
                      />
                      <button
                        onClick={() => removePhoto(p.id)}
                        className="absolute top-1 right-1 h-5 w-5 rounded bg-black/70 hover:bg-destructive flex items-center justify-center text-white opacity-0 group-hover:opacity-100 transition-opacity"
                        aria-label="Hapus foto"
                      >
                        <X className="h-3 w-3" />
                      </button>
                      {repeatMode && (
                        <span className="absolute bottom-0 left-0 right-0 text-[9px] text-center bg-black/70 text-white py-0.5">
                          #{idx + 1}
                        </span>
                      )}
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
              <ImageIcon className="h-4 w-4 text-neon-cyan" />
              2. Atur Layout
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* Paper size */}
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

            {/* Orientation */}
            <div className="space-y-1.5">
              <Label className="text-xs">Orientasi</Label>
              <ToggleGroup
                type="single"
                value={orientation}
                onValueChange={(v) => v && setOrientation(v as Orientation)}
                className="justify-start"
              >
                <ToggleGroupItem value="portrait" className="text-xs">
                  <RotateCw className="h-3 w-3 mr-1 -rotate-90" />
                  Potret
                </ToggleGroupItem>
                <ToggleGroupItem value="landscape" className="text-xs">
                  <RotateCw className="h-3 w-3 mr-1" />
                  Lanskap
                </ToggleGroupItem>
              </ToggleGroup>
            </div>

            {/* Photo size - Pas Foto */}
            <div className="space-y-1.5">
              <Label className="text-xs">Ukuran Foto — Pas Foto (cm)</Label>
              <div className="flex flex-wrap gap-1.5">
                {PAS_PHOTO_SIZES.map((s) => (
                  <button
                    key={s.id}
                    onClick={() => setPhotoSizeId(s.id)}
                    className={`px-2.5 py-1.5 rounded-md text-xs font-medium border transition-all ${
                      photoSizeId === s.id
                        ? "bg-neon-cyan/20 border-neon-cyan text-neon-cyan glow-cyan"
                        : "bg-secondary/40 border-border hover:border-neon-cyan/50"
                    }`}
                  >
                    {s.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Photo size - Standar R */}
            <div className="space-y-1.5">
              <Label className="text-xs">Ukuran Foto — Standar R</Label>
              <div className="flex flex-wrap gap-1.5 max-h-28 overflow-y-auto scrollbar-studio p-1">
                {R_PHOTO_SIZES.map((s) => (
                  <button
                    key={s.id}
                    onClick={() => setPhotoSizeId(s.id)}
                    className={`px-2.5 py-1.5 rounded-md text-xs font-medium border transition-all ${
                      photoSizeId === s.id
                        ? "bg-neon-magenta/20 border-neon-magenta text-neon-magenta glow-magenta"
                        : "bg-secondary/40 border-border hover:border-neon-magenta/50"
                    }`}
                  >
                    {s.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Custom Template (Ukuran Bebas) */}
            <div className="space-y-2 p-3 rounded-lg bg-neon-cyan/5 border border-neon-cyan/30">
              <div className="flex items-center justify-between">
                <Label className="text-xs flex items-center gap-1">
                  <Ruler className="h-3 w-3 text-neon-cyan" />
                  Template Custom (Ukuran Bebas)
                </Label>
                <Dialog open={showTemplateDialog} onOpenChange={setShowTemplateDialog}>
                  <DialogTrigger asChild>
                    <Button
                      size="sm"
                      className="h-7 text-xs bg-neon-cyan text-background hover:bg-neon-cyan/90"
                    >
                      <Plus className="h-3 w-3 mr-1" />
                      Buat
                    </Button>
                  </DialogTrigger>
                  <DialogContent className="max-w-md bg-card border-border">
                    <DialogHeader>
                      <DialogTitle className="flex items-center gap-2">
                        <Ruler className="h-4 w-4 text-neon-cyan" />
                        Buat Template Baru
                      </DialogTitle>
                    </DialogHeader>
                    <div className="space-y-3 py-2">
                      {/* Quick presets */}
                      <div className="space-y-1.5">
                        <Label className="text-xs">Preset Cepat</Label>
                        <div className="flex flex-wrap gap-1.5 max-h-32 overflow-y-auto scrollbar-studio p-1">
                          {TEMPLATE_PRESETS.map((p) => (
                            <button
                              key={p.name}
                              onClick={() => handleApplyPreset(p)}
                              className="px-2 py-1 rounded text-[10px] bg-secondary/40 border border-border hover:border-neon-cyan/50 text-left"
                              title={p.note}
                            >
                              <div className="font-medium">{p.name}</div>
                              <div className="text-muted-foreground">
                                {p.widthValue}×{p.heightValue} {p.unit}
                              </div>
                            </button>
                          ))}
                        </div>
                      </div>

                      <div className="space-y-1.5">
                        <Label className="text-xs" htmlFor="tpl-name">
                          Nama Template
                        </Label>
                        <Input
                          id="tpl-name"
                          value={tplName}
                          onChange={(e) => setTplName(e.target.value)}
                          placeholder="mis. Paspor Custom 35×45"
                          className="h-9"
                        />
                      </div>

                      <div className="grid grid-cols-3 gap-2">
                        <div className="space-y-1.5">
                          <Label className="text-xs" htmlFor="tpl-w">Lebar</Label>
                          <Input
                            id="tpl-w"
                            type="number"
                            value={tplWidth}
                            onChange={(e) => setTplWidth(e.target.value)}
                            className="h-9"
                            step="0.1"
                            min="0.1"
                          />
                        </div>
                        <div className="space-y-1.5">
                          <Label className="text-xs" htmlFor="tpl-h">Tinggi</Label>
                          <Input
                            id="tpl-h"
                            type="number"
                            value={tplHeight}
                            onChange={(e) => setTplHeight(e.target.value)}
                            className="h-9"
                            step="0.1"
                            min="0.1"
                          />
                        </div>
                        <div className="space-y-1.5">
                          <Label className="text-xs">Satuan</Label>
                          <Select value={tplUnit} onValueChange={(v) => setTplUnit(v as SizeUnit)}>
                            <SelectTrigger className="h-9">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="mm">mm</SelectItem>
                              <SelectItem value="cm">cm</SelectItem>
                              <SelectItem value="inch">inci</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>
                      </div>

                      {/* Preview konversi */}
                      <div className="text-[11px] text-muted-foreground p-2 rounded bg-secondary/30 border border-border/60">
                        <div className="flex items-center justify-between">
                          <span>Konversi ke mm:</span>
                          <span className="font-mono text-neon-cyan">
                            {(parseFloat(tplWidth || "0") * UNIT_TO_MM[tplUnit]).toFixed(1)} × {(parseFloat(tplHeight || "0") * UNIT_TO_MM[tplUnit]).toFixed(1)} mm
                          </span>
                        </div>
                      </div>
                    </div>
                    <DialogFooter>
                      <Button
                        variant="outline"
                        onClick={() => setShowTemplateDialog(false)}
                        className="h-9"
                      >
                        Batal
                      </Button>
                      <Button
                        onClick={handleAddTemplate}
                        className="h-9 bg-neon-cyan text-background hover:bg-neon-cyan/90"
                      >
                        <Plus className="h-4 w-4 mr-1" />
                        Simpan Template
                      </Button>
                    </DialogFooter>
                  </DialogContent>
                </Dialog>
              </div>

              {customTemplates.length === 0 ? (
                <p className="text-[10px] text-muted-foreground px-1">
                  Belum ada template custom. Klik <strong className="text-neon-cyan">Buat</strong> untuk membuat ukuran bebas (mis. Paspor 35×45mm, ID Card, dll).
                </p>
              ) : (
                <div className="flex flex-wrap gap-1.5 max-h-28 overflow-y-auto scrollbar-studio p-1">
                  {customTemplates.map((t) => (
                    <div
                      key={t.id}
                      className={`group relative inline-flex items-center gap-1 pl-2.5 pr-6 py-1.5 rounded-md text-xs font-medium border transition-all ${
                        photoSizeId === t.id
                          ? "bg-neon-cyan/20 border-neon-cyan text-neon-cyan glow-cyan"
                          : "bg-secondary/40 border-border hover:border-neon-cyan/50"
                      }`}
                    >
                      <button
                        onClick={() => setPhotoSizeId(t.id)}
                        className="text-left"
                        title={`${t.name} — ${t.widthMm}×${t.heightMm} mm`}
                      >
                        {t.name}
                        <span className="ml-1 text-[10px] text-muted-foreground">
                          {t.widthValue}×{t.heightValue} {t.unit}
                        </span>
                      </button>
                      <button
                        onClick={() => handleDeleteTemplate(t.id)}
                        className="absolute right-0.5 top-1/2 -translate-y-1/2 h-5 w-5 rounded bg-black/30 hover:bg-destructive flex items-center justify-center text-white opacity-0 group-hover:opacity-100 transition-opacity"
                        aria-label="Hapus template"
                      >
                        <X className="h-3 w-3" />
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Repeat mode */}
            <div className="flex items-center justify-between gap-2 p-3 rounded-lg bg-secondary/30 border border-border/60">
              <div className="flex flex-col">
                <Label className="text-xs font-medium">Mode Ulang Foto</Label>
                <span className="text-[10px] text-muted-foreground">
                  1 foto dipakai untuk semua slot
                </span>
              </div>
              <Switch
                checked={repeatMode}
                onCheckedChange={setRepeatMode}
              />
            </div>

            {/* Allow rotate photo */}
            <div className="flex items-center justify-between gap-2 p-3 rounded-lg bg-secondary/30 border border-border/60">
              <div className="flex flex-col">
                <Label className="text-xs font-medium">
                  Rotasi Foto Auto
                </Label>
                <span className="text-[10px] text-muted-foreground">
                  Putar foto 90° untuk hemat ruang
                </span>
              </div>
              <Switch
                checked={allowRotatePhoto}
                onCheckedChange={setAllowRotatePhoto}
              />
            </div>

            {/* Gap & margin */}
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label className="text-xs flex items-center justify-between">
                  <span>Jarak</span>
                  <span className="text-neon-cyan">{gap}mm</span>
                </Label>
                <Slider
                  value={[gap]}
                  min={0}
                  max={10}
                  step={0.5}
                  onValueChange={(v) => setGap(v[0])}
                />
              </div>
              <div className="space-y-1">
                <Label className="text-xs flex items-center justify-between">
                  <span>Margin</span>
                  <span className="text-neon-cyan">{margin.top}mm</span>
                </Label>
                <Slider
                  value={[margin.top]}
                  min={0}
                  max={20}
                  step={1}
                  onValueChange={(v) =>
                    setMargin({ top: v[0], right: v[0], bottom: v[0], left: v[0] })
                  }
                />
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* RIGHT: Preview & actions */}
      <div className="flex flex-col gap-4">
        <Card className="bg-card/60 border-border/60 flex-1">
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between gap-2 flex-wrap">
              <CardTitle className="text-sm flex items-center gap-2">
                <ImageIcon className="h-4 w-4 text-neon-cyan" />
                3. Preview
              </CardTitle>
              <div className="flex items-center gap-2">
                <Badge variant="outline" className="text-[10px] gap-1">
                  {paper.id} · {orientation === "portrait" ? "Potret" : "Lanskap"}
                </Badge>
                <Badge variant="outline" className="text-[10px] gap-1 text-neon-cyan border-neon-cyan/40">
                  {photoSize.label}
                </Badge>
                <Badge
                  variant="outline"
                  className="text-[10px] gap-1 text-neon-magenta border-neon-magenta/40"
                >
                  {layout.count} pcs
                </Badge>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            {photos.length === 0 ? (
              <div className="flex flex-col items-center justify-center min-h-[500px] text-center">
                <div className="h-16 w-16 rounded-2xl bg-secondary/40 flex items-center justify-center mb-4">
                  <ImageIcon className="h-8 w-8 text-muted-foreground" />
                </div>
                <p className="text-sm text-muted-foreground mb-1">
                  Unggah foto untuk melihat preview
                </p>
                <p className="text-xs text-muted-foreground/70">
                  Layout akan otomatis dihitung saat foto dimuat
                </p>
              </div>
            ) : layout.count === 0 ? (
              <div className="flex flex-col items-center justify-center min-h-[500px] text-center">
                <p className="text-sm text-muted-foreground">
                  Ukuran foto terlalu besar untuk kertas {paper.id}
                </p>
                <p className="text-xs text-muted-foreground/70 mt-1">
                  Pilih ukuran kertas lebih besar atau ukuran foto lebih kecil
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
                    Total: <strong className="text-neon-cyan">{layout.count}</strong> pcs
                  </span>
                  <span>·</span>
                  <span>
                    Sisa: {Math.round(layout.remainingHorizontalMm)}×
                    {Math.round(layout.remainingVerticalMm)}mm
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
              disabled={photos.length === 0 || printLoading}
              className="bg-neon-cyan text-background hover:bg-neon-cyan/90"
            >
              <Printer className="h-4 w-4 mr-2" />
              {printLoading ? "Menyiapkan..." : "Cetak Langsung"}
            </Button>
            <Button
              variant="outline"
              onClick={handleDownloadPdf}
              disabled={photos.length === 0 || pdfLoading}
              className="border-neon-magenta/50 text-neon-magenta hover:bg-neon-magenta/10"
            >
              <Download className="h-4 w-4 mr-2" />
              {pdfLoading ? "Membuat..." : "Download PDF"}
            </Button>
          </CardContent>
        </Card>
      </div>

      {/* Print-only area */}
      <div
        id="print-area-photo"
        className="print-area hidden"
        aria-hidden="true"
      />
    </div>
  );
}
