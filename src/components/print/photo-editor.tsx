"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  Sparkles,
  Wand2,
  Sun,
  Contrast,
  Droplet,
  RotateCw,
  FlipHorizontal,
  FlipVertical,
  Download,
  Save,
  Trash2,
  Zap,
  Heart,
  Image as ImageIcon,
  RotateCcw,
} from "lucide-react";
import { UploadZone } from "@/components/upload/upload-zone";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Slider } from "@/components/ui/slider";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import {
  applyAdjustments,
  loadImageFromFile,
  canvasToJpeg,
  canvasToPng,
  type AdjustmentParams,
  type BeautyParams,
  type EnhanceParams,
  DEFAULT_ADJUSTMENT,
  DEFAULT_BEAUTY,
  DEFAULT_ENHANCE,
} from "@/lib/image-processing";

interface EditedPhoto {
  id: string;
  file: File;
  url: string;
  image: HTMLImageElement | null;
}

interface PresetAdjustment {
  id: string;
  label: string;
  apply: Partial<AdjustmentParams>;
}

const PRESETS: PresetAdjustment[] = [
  { id: "none", label: "Original", apply: {} },
  {
    id: "vivid",
    label: "Vivid",
    apply: { saturation: 25, contrast: 15, brightness: 5 },
  },
  {
    id: "soft",
    label: "Soft",
    apply: { brightness: 10, contrast: -10, saturation: -10 },
  },
  {
    id: "warm",
    label: "Warm",
    apply: { temperature: 30, brightness: 5 },
  },
  {
    id: "cold",
    label: "Cold",
    apply: { temperature: -30, saturation: -5 },
  },
  {
    id: "mono",
    label: "Mono",
    apply: { saturation: -100, contrast: 15 },
  },
  {
    id: "vintage",
    label: "Vintage",
    apply: { saturation: -20, temperature: 25, contrast: 10, brightness: 5 },
  },
];

export function PhotoEditor() {
  const [photo, setPhoto] = useState<EditedPhoto | null>(null);
  const [adjustment, setAdjustment] = useState<AdjustmentParams>(DEFAULT_ADJUSTMENT);
  const [beauty, setBeauty] = useState<BeautyParams>(DEFAULT_BEAUTY);
  const [enhance, setEnhance] = useState<EnhanceParams>(DEFAULT_ENHANCE);
  const [processing, setProcessing] = useState(false);
  const [activePreset, setActivePreset] = useState("none");

  const canvasRef = useRef<HTMLCanvasElement>(null);
  const sourceCanvasRef = useRef<HTMLCanvasElement | null>(null);

  const handleFiles = useCallback((files: File[]) => {
    const valid = files.filter((f) => f.type.startsWith("image/"));
    if (valid.length === 0) {
      toast.error("File tidak valid");
      return;
    }
    const file = valid[0]; // single photo mode
    const item: EditedPhoto = {
      id: `${Date.now()}`,
      file,
      url: URL.createObjectURL(file),
      image: null,
    };
    // revoke previous URL
    if (photo) URL.revokeObjectURL(photo.url);
    setPhoto(item);
    setAdjustment(DEFAULT_ADJUSTMENT);
    setBeauty(DEFAULT_BEAUTY);
    setEnhance(DEFAULT_ENHANCE);
    setActivePreset("none");
    toast.success("Foto dimuat");

    // Load image to source canvas
    loadImageFromFile(file)
      .then((img) => {
        const canvas = document.createElement("canvas");
        canvas.width = img.naturalWidth;
        canvas.height = img.naturalHeight;
        const ctx = canvas.getContext("2d")!;
        ctx.drawImage(img, 0, 0);
        sourceCanvasRef.current = canvas;
        setPhoto((prev) => (prev ? { ...prev, image: img } : prev));
      })
      .catch((e) => {
        console.error(e);
        toast.error("Gagal memuat gambar");
      });
  }, [photo]);

  const clearPhoto = () => {
    if (photo) URL.revokeObjectURL(photo.url);
    setPhoto(null);
    sourceCanvasRef.current = null;
    setAdjustment(DEFAULT_ADJUSTMENT);
    setBeauty(DEFAULT_BEAUTY);
    setEnhance(DEFAULT_ENHANCE);
    setActivePreset("none");
  };

  // Re-render canvas when adjustment changes (debounced via rAF)
  useEffect(() => {
    if (!photo || !sourceCanvasRef.current) return;
    const source = sourceCanvasRef.current;
    let raf = 0;
    const run = () => {
      setProcessing(true);
      try {
        const result = applyAdjustments(source, adjustment, beauty, enhance);
        const canvas = canvasRef.current;
        if (canvas) {
          canvas.width = result.width;
          canvas.height = result.height;
          const ctx = canvas.getContext("2d")!;
          ctx.drawImage(result, 0, 0);
        }
      } catch (e) {
        console.error(e);
      } finally {
        setProcessing(false);
      }
    };
    raf = requestAnimationFrame(run);
    return () => cancelAnimationFrame(raf);
  }, [photo, adjustment, beauty, enhance]);

  const applyPreset = (preset: PresetAdjustment) => {
    setActivePreset(preset.id);
    setAdjustment({ ...DEFAULT_ADJUSTMENT, ...preset.apply });
  };

  const resetAll = () => {
    setAdjustment(DEFAULT_ADJUSTMENT);
    setBeauty(DEFAULT_BEAUTY);
    setEnhance(DEFAULT_ENHANCE);
    setActivePreset("none");
    toast.success("Reset ke original");
  };

  const handleDownload = (format: "jpeg" | "png") => {
    const canvas = canvasRef.current;
    if (!canvas) {
      toast.error("Tidak ada hasil untuk diunduh");
      return;
    }
    const dataUrl = format === "jpeg" ? canvasToJpeg(canvas, 0.95) : canvasToPng(canvas);
    const a = document.createElement("a");
    a.href = dataUrl;
    a.download = `edited-${Date.now()}.${format === "jpeg" ? "jpg" : "png"}`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    toast.success(`Gambar ${format.toUpperCase()} berhasil diunduh`);
  };

  // Bila sourceCanvas ada, hitung dimensi preview yang sesuai
  const previewMaxWidth = 700;
  const previewMaxHeight = 500;
  const sourceDims = useMemo(() => {
    if (!photo?.image) return { w: 0, h: 0 };
    const rotate90 =
      adjustment.rotation === 90 || adjustment.rotation === 270;
    const srcW = rotate90 ? photo.image.naturalHeight : photo.image.naturalWidth;
    const srcH = rotate90 ? photo.image.naturalWidth : photo.image.naturalHeight;
    const scale = Math.min(
      previewMaxWidth / srcW,
      previewMaxHeight / srcH,
      1,
    );
    return { w: srcW * scale, h: srcH * scale };
  }, [photo?.image, adjustment.rotation]);

  return (
    <div className="grid lg:grid-cols-[1fr_360px] gap-6">
      {/* LEFT: Preview */}
      <div className="flex flex-col gap-4">
        <Card className="bg-card/60 border-border/60 flex-1">
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between gap-2 flex-wrap">
              <CardTitle className="text-sm flex items-center gap-2">
                <Wand2 className="h-4 w-4 text-neon-cyan" />
                Preview Editor
              </CardTitle>
              {photo?.image && (
                <div className="flex items-center gap-2">
                  <Badge variant="outline" className="text-[10px]">
                    {photo.image.naturalWidth}×{photo.image.naturalHeight}px
                  </Badge>
                  {enhance.enabled && (
                    <Badge
                      variant="outline"
                      className="text-[10px] text-neon-cyan border-neon-cyan/40"
                    >
                      HD → {enhance.targetWidth}px
                    </Badge>
                  )}
                  {processing && (
                    <Badge variant="outline" className="text-[10px] text-neon-lime border-neon-lime/40 animate-pulse">
                      Memproses...
                    </Badge>
                  )}
                </div>
              )}
            </div>
          </CardHeader>
          <CardContent>
            {!photo ? (
              <UploadZone
                onFiles={handleFiles}
                title="Tarik foto untuk diedit"
                subtitle="JPG/PNG · satu foto untuk diedit"
                className="min-h-[500px]"
              />
            ) : (
              <div className="flex flex-col items-center gap-3">
                <div
                  className="relative bg-black/40 rounded-lg overflow-hidden checkerboard border border-border/60"
                  style={{
                    width: sourceDims.w || "auto",
                    height: sourceDims.h || "auto",
                    minHeight: 300,
                  }}
                >
                  <canvas
                    ref={canvasRef}
                    style={{
                      maxWidth: "100%",
                      maxHeight: "100%",
                      display: "block",
                    }}
                    className="object-contain"
                  />
                </div>
                <div className="flex flex-wrap gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => handleFiles([photo.file])}
                    className="text-xs"
                  >
                    <RotateCcw className="h-3 w-3 mr-1" />
                    Muat Ulang
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={clearPhoto}
                    className="text-xs text-destructive hover:text-destructive"
                  >
                    <Trash2 className="h-3 w-3 mr-1" />
                    Hapus
                  </Button>
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        {photo && (
          <Card className="bg-card/60 border-border/60 no-print">
            <CardContent className="py-4 flex flex-wrap items-center justify-center gap-3">
              <Button
                variant="default"
                onClick={() => handleDownload("jpeg")}
                className="bg-neon-cyan text-background hover:bg-neon-cyan/90"
              >
                <Download className="h-4 w-4 mr-2" />
                Download JPG
              </Button>
              <Button
                variant="outline"
                onClick={() => handleDownload("png")}
                className="border-neon-magenta/50 text-neon-magenta hover:bg-neon-magenta/10"
              >
                <Download className="h-4 w-4 mr-2" />
                Download PNG
              </Button>
              <Button variant="ghost" onClick={resetAll}>
                <RotateCcw className="h-4 w-4 mr-2" />
                Reset
              </Button>
            </CardContent>
          </Card>
        )}
      </div>

      {/* RIGHT: Controls */}
      {photo && (
        <div className="flex flex-col gap-4">
          {/* Presets */}
          <Card className="bg-card/60 border-border/60">
            <CardHeader className="pb-3">
              <CardTitle className="text-sm flex items-center gap-2">
                <Sparkles className="h-4 w-4 text-neon-cyan" />
                Preset Cepat
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-3 gap-2">
                {PRESETS.map((p) => (
                  <button
                    key={p.id}
                    onClick={() => applyPreset(p)}
                    className={`px-2 py-2 rounded-lg text-xs font-medium border transition-all ${
                      activePreset === p.id
                        ? "bg-neon-cyan/20 border-neon-cyan text-neon-cyan"
                        : "bg-secondary/40 border-border hover:border-neon-cyan/50"
                    }`}
                  >
                    {p.label}
                  </button>
                ))}
              </div>
            </CardContent>
          </Card>

          <Tabs defaultValue="basic" className="w-full">
            <TabsList className="grid w-full grid-cols-3 bg-card/60 border border-border/60">
              <TabsTrigger value="basic" className="text-xs">
                <Sun className="h-3 w-3 mr-1" /> Basic
              </TabsTrigger>
              <TabsTrigger value="beauty" className="text-xs">
                <Heart className="h-3 w-3 mr-1" /> Beauty
              </TabsTrigger>
              <TabsTrigger value="hd" className="text-xs">
                <Zap className="h-3 w-3 mr-1" /> HD
              </TabsTrigger>
            </TabsList>

            {/* Basic adjustments */}
            <TabsContent value="basic" className="mt-3">
              <Card className="bg-card/60 border-border/60">
                <CardContent className="py-4 space-y-3">
                  <AdjustSlider
                    label="Brightness"
                    icon={<Sun className="h-3 w-3" />}
                    value={adjustment.brightness}
                    onChange={(v) =>
                      setAdjustment((p) => ({ ...p, brightness: v }))
                    }
                  />
                  <AdjustSlider
                    label="Contrast"
                    icon={<Contrast className="h-3 w-3" />}
                    value={adjustment.contrast}
                    onChange={(v) =>
                      setAdjustment((p) => ({ ...p, contrast: v }))
                    }
                  />
                  <AdjustSlider
                    label="Saturation"
                    icon={<Droplet className="h-3 w-3" />}
                    value={adjustment.saturation}
                    onChange={(v) =>
                      setAdjustment((p) => ({ ...p, saturation: v }))
                    }
                  />
                  <AdjustSlider
                    label="Exposure"
                    icon={<Sun className="h-3 w-3" />}
                    value={adjustment.exposure}
                    onChange={(v) =>
                      setAdjustment((p) => ({ ...p, exposure: v }))
                    }
                  />
                  <AdjustSlider
                    label="Temperature"
                    icon={<Droplet className="h-3 w-3" />}
                    value={adjustment.temperature}
                    onChange={(v) =>
                      setAdjustment((p) => ({ ...p, temperature: v }))
                    }
                  />

                  <div className="border-t border-border/60 pt-3 space-y-2">
                    <Label className="text-xs">Rotasi & Mirror</Label>
                    <div className="grid grid-cols-4 gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() =>
                          setAdjustment((p) => ({
                            ...p,
                            rotation: (p.rotation + 90) % 360,
                          }))
                        }
                        className="text-xs h-9"
                      >
                        <RotateCw className="h-3 w-3" />
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() =>
                          setAdjustment((p) => ({ ...p, rotation: 0 }))
                        }
                        className="text-xs h-9"
                      >
                        0°
                      </Button>
                      <Button
                        variant={adjustment.mirrorH ? "default" : "outline"}
                        size="sm"
                        onClick={() =>
                          setAdjustment((p) => ({ ...p, mirrorH: !p.mirrorH }))
                        }
                        className="text-xs h-9"
                      >
                        <FlipHorizontal className="h-3 w-3" />
                      </Button>
                      <Button
                        variant={adjustment.mirrorV ? "default" : "outline"}
                        size="sm"
                        onClick={() =>
                          setAdjustment((p) => ({ ...p, mirrorV: !p.mirrorV }))
                        }
                        className="text-xs h-9"
                      >
                        <FlipVertical className="h-3 w-3" />
                      </Button>
                    </div>
                    <div className="flex items-center justify-between text-xs">
                      <span className="text-muted-foreground">Rotasi:</span>
                      <span className="text-neon-cyan">{adjustment.rotation}°</span>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </TabsContent>

            {/* Beauty */}
            <TabsContent value="beauty" className="mt-3">
              <Card className="bg-card/60 border-border/60">
                <CardContent className="py-4 space-y-3">
                  <div className="flex items-center justify-between gap-2 p-3 rounded-lg bg-secondary/30 border border-border/60">
                    <div className="flex flex-col">
                      <Label className="text-xs font-medium flex items-center gap-1">
                        <Heart className="h-3 w-3 text-neon-magenta" /> Beauty Retouch
                      </Label>
                      <span className="text-[10px] text-muted-foreground">
                        Smooth skin + brighten wajah
                      </span>
                    </div>
                    <Switch
                      checked={beauty.enabled}
                      onCheckedChange={(v) =>
                        setBeauty((p) => ({ ...p, enabled: v }))
                      }
                    />
                  </div>

                  <AdjustSlider
                    label="Skin Smooth"
                    value={beauty.smooth}
                    onChange={(v) =>
                      setBeauty((p) => ({ ...p, smooth: v }))
                    }
                    disabled={!beauty.enabled}
                  />
                  <AdjustSlider
                    label="Skin Brighten"
                    value={beauty.brighten}
                    onChange={(v) =>
                      setBeauty((p) => ({ ...p, brighten: v }))
                    }
                    disabled={!beauty.enabled}
                  />
                  {!beauty.enabled && (
                    <p className="text-[10px] text-muted-foreground text-center">
                      Aktifkan Beauty Retouch untuk smooth & brighten otomatis
                      pada area wajah
                    </p>
                  )}
                </CardContent>
              </Card>
            </TabsContent>

            {/* HD Enhance */}
            <TabsContent value="hd" className="mt-3">
              <Card className="bg-card/60 border-border/60">
                <CardContent className="py-4 space-y-3">
                  <div className="flex items-center justify-between gap-2 p-3 rounded-lg bg-secondary/30 border border-border/60">
                    <div className="flex flex-col">
                      <Label className="text-xs font-medium flex items-center gap-1">
                        <Zap className="h-3 w-3 text-neon-cyan" /> HD Enhance
                      </Label>
                      <span className="text-[10px] text-muted-foreground">
                        Upscale + sharpen untuk Full HD
                      </span>
                    </div>
                    <Switch
                      checked={enhance.enabled}
                      onCheckedChange={(v) =>
                        setEnhance((p) => ({ ...p, enabled: v }))
                      }
                    />
                  </div>

                  <div className="space-y-1">
                    <Label className="text-xs">Target Resolusi</Label>
                    <div className="grid grid-cols-3 gap-2">
                      <Button
                        variant={enhance.targetWidth === 1280 ? "default" : "outline"}
                        size="sm"
                        disabled={!enhance.enabled}
                        onClick={() =>
                          setEnhance((p) => ({ ...p, targetWidth: 1280 }))
                        }
                        className="text-xs h-8"
                      >
                        HD 720p
                      </Button>
                      <Button
                        variant={enhance.targetWidth === 1920 ? "default" : "outline"}
                        size="sm"
                        disabled={!enhance.enabled}
                        onClick={() =>
                          setEnhance((p) => ({ ...p, targetWidth: 1920 }))
                        }
                        className="text-xs h-8"
                      >
                        Full HD
                      </Button>
                      <Button
                        variant={enhance.targetWidth === 2560 ? "default" : "outline"}
                        size="sm"
                        disabled={!enhance.enabled}
                        onClick={() =>
                          setEnhance((p) => ({ ...p, targetWidth: 2560 }))
                        }
                        className="text-xs h-8"
                      >
                        2K QHD
                      </Button>
                    </div>
                  </div>

                  <AdjustSlider
                    label="Sharpen"
                    icon={<Sparkles className="h-3 w-3" />}
                    value={enhance.sharpen}
                    onChange={(v) =>
                      setEnhance((p) => ({ ...p, sharpen: v }))
                    }
                    disabled={!enhance.enabled}
                  />

                  {!enhance.enabled && (
                    <p className="text-[10px] text-muted-foreground text-center">
                      Aktifkan HD Enhance untuk upscale gambar ke Full HD / 2K
                      dengan sharpening
                    </p>
                  )}
                  {enhance.enabled && photo?.image && (
                    <div className="text-[10px] text-muted-foreground space-y-1 p-2 rounded bg-secondary/30 border border-border/60">
                      <div className="flex justify-between">
                        <span>Original:</span>
                        <span className="text-foreground">
                          {photo.image.naturalWidth}×{photo.image.naturalHeight}px
                        </span>
                      </div>
                      <div className="flex justify-between">
                        <span>Output:</span>
                        <span className="text-neon-cyan">
                          {enhance.targetWidth}×
                          {Math.round(
                            enhance.targetWidth *
                              (photo.image.naturalHeight / photo.image.naturalWidth),
                          )}
                          px
                        </span>
                      </div>
                    </div>
                  )}
                </CardContent>
              </Card>
            </TabsContent>
          </Tabs>
        </div>
      )}
    </div>
  );
}

interface AdjustSliderProps {
  label: string;
  icon?: React.ReactNode;
  value: number;
  onChange: (v: number) => void;
  min?: number;
  max?: number;
  step?: number;
  disabled?: boolean;
}

function AdjustSlider({
  label,
  icon,
  value,
  onChange,
  min = -100,
  max = 100,
  step = 1,
  disabled,
}: AdjustSliderProps) {
  return (
    <div className={`space-y-1 ${disabled ? "opacity-40 pointer-events-none" : ""}`}>
      <Label className="text-xs flex items-center justify-between">
        <span className="flex items-center gap-1">
          {icon}
          {label}
        </span>
        <span className="text-neon-cyan font-mono">{value > 0 ? `+${value}` : value}</span>
      </Label>
      <Slider
        value={[value]}
        min={min}
        max={max}
        step={step}
        onValueChange={(v) => onChange(v[0])}
      />
    </div>
  );
}
