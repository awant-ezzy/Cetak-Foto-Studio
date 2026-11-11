/**
 * Image processing utilities
 * - Brightness, contrast, saturation, exposure
 * - Sharpen (HD enhance)
 * - Beauty retouch (simple skin smoothing)
 * - All done on canvas client-side
 */

export interface AdjustmentParams {
  brightness: number; // -100 .. 100
  contrast: number; // -100 .. 100
  saturation: number; // -100 .. 100
  exposure: number; // -100 .. 100
  temperature: number; // -100 .. 100 (warna hangat/keras)
  rotation: number; // 0, 90, 180, 270
  mirrorH: boolean;
  mirrorV: boolean;
}

export const DEFAULT_ADJUSTMENT: AdjustmentParams = {
  brightness: 0,
  contrast: 0,
  saturation: 0,
  exposure: 0,
  temperature: 0,
  rotation: 0,
  mirrorH: false,
  mirrorV: false,
};

export interface BeautyParams {
  enabled: boolean;
  /** smoothing intensity 0..100 */
  smooth: number;
  /** brightness of skin 0..100 */
  brighten: number;
}

export const DEFAULT_BEAUTY: BeautyParams = {
  enabled: false,
  smooth: 40,
  brighten: 20,
};

export interface EnhanceParams {
  enabled: boolean;
  /** target width px (HD = 1920, 2K = 2560) */
  targetWidth: number;
  /** sharpen intensity 0..100 */
  sharpen: number;
}

export const DEFAULT_ENHANCE: EnhanceParams = {
  enabled: false,
  targetWidth: 1920,
  sharpen: 50,
};

/** Muat gambar dari File menjadi HTMLImageElement */
export function loadImageFromFile(file: File): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      // jangan revoke dulu karena mungkin dipakai; biarkan pemanggil
      resolve(img);
    };
    img.onerror = (e) => {
      URL.revokeObjectURL(url);
      reject(e);
    };
    img.src = url;
  });
}

/** Muat gambar dari data URL / blob URL */
export function loadImageFromSrc(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = () => resolve(img);
    img.onerror = (e) => reject(e);
    img.src = src;
  });
}

/**
 * Apply adjustment + beauty ke source canvas.
 * Mengembalikan canvas baru (atau in-place).
 */
export function applyAdjustments(
  source: HTMLCanvasElement | HTMLImageElement,
  adjustment: AdjustmentParams,
  beauty: BeautyParams = DEFAULT_BEAUTY,
  enhance: EnhanceParams = DEFAULT_ENHANCE,
): HTMLCanvasElement {
  // Tentukan dimensi output (resolusi asli atau di-upscale untuk HD)
  const srcW =
    source instanceof HTMLImageElement ? source.naturalWidth : source.width;
  const srcH =
    source instanceof HTMLImageElement ? source.naturalHeight : source.height;

  let outW = srcW;
  let outH = srcH;
  if (enhance.enabled && srcW < enhance.targetWidth) {
    const scale = enhance.targetWidth / srcW;
    outW = Math.round(srcW * scale);
    outH = Math.round(srcH * scale);
  }

  // Handle rotasi 90/270 → tukar dimensi
  const rotate90 = adjustment.rotation === 90 || adjustment.rotation === 270;
  const finalW = rotate90 ? outH : outW;
  const finalH = rotate90 ? outW : outH;

  // Step 1: gambar source (di-scale bila enhance) ke canvas A
  const canvasA = document.createElement("canvas");
  canvasA.width = outW;
  canvasA.height = outH;
  const ctxA = canvasA.getContext("2d")!;
  ctxA.imageSmoothingEnabled = true;
  ctxA.imageSmoothingQuality = "high";
  ctxA.drawImage(source, 0, 0, outW, outH);

  // Step 2: apply pixel adjustments via ImageData
  applyPixelAdjustments(canvasA, adjustment);

  // Step 3: apply beauty retouch (skin smoothing)
  if (beauty.enabled) {
    applyBeautyRetouch(canvasA, beauty);
  }

  // Step 4: apply HD sharpen (unsharp mask sederhana)
  if (enhance.enabled && enhance.sharpen > 0) {
    applySharpen(canvasA, enhance.sharpen / 100);
  }

  // Step 5: rotation & mirror
  const canvasB = document.createElement("canvas");
  canvasB.width = finalW;
  canvasB.height = finalH;
  const ctxB = canvasB.getContext("2d")!;
  ctxB.imageSmoothingEnabled = true;
  ctxB.imageSmoothingQuality = "high";

  ctxB.translate(finalW / 2, finalH / 2);
  ctxB.rotate((adjustment.rotation * Math.PI) / 180);
  ctxB.scale(adjustment.mirrorH ? -1 : 1, adjustment.mirrorV ? -1 : 1);
  ctxB.drawImage(canvasA, -outW / 2, -outH / 2);

  return canvasB;
}

/**
 * Apply adjustment pixel per pixel menggunakan ImageData.
 */
function applyPixelAdjustments(
  canvas: HTMLCanvasElement,
  adj: AdjustmentParams,
): void {
  const ctx = canvas.getContext("2d")!;
  const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
  const data = imageData.data;

  // Faktor adjustment
  const brightnessFactor = 1 + adj.brightness / 100; // 0..2
  const exposureFactor = Math.pow(2, adj.exposure / 50); // ~0.25..4
  const contrastFactor = 1 + adj.contrast / 100; // 0..2
  const saturationFactor = 1 + adj.saturation / 100; // 0..2
  const tempFactor = adj.temperature / 100; // -1..1

  for (let i = 0; i < data.length; i += 4) {
    let r = data[i];
    let g = data[i + 1];
    let b = data[i + 2];

    // exposure
    r *= exposureFactor;
    g *= exposureFactor;
    b *= exposureFactor;

    // brightness
    r *= brightnessFactor;
    g *= brightnessFactor;
    b *= brightnessFactor;

    // contrast (sekitar 128)
    r = (r - 128) * contrastFactor + 128;
    g = (g - 128) * contrastFactor + 128;
    b = (b - 128) * contrastFactor + 128;

    // saturation
    const gray = 0.2989 * r + 0.587 * g + 0.114 * b;
    r = gray + (r - gray) * saturationFactor;
    g = gray + (g - gray) * saturationFactor;
    b = gray + (b - gray) * saturationFactor;

    // temperature (warm = +R -B, cold = -R +B)
    r += tempFactor * 20;
    b -= tempFactor * 20;

    data[i] = clamp255(r);
    data[i + 1] = clamp255(g);
    data[i + 2] = clamp255(b);
  }

  ctx.putImageData(imageData, 0, 0);
}

/**
 * Beauty retouch: skin smoothing dengan bilateral-style box blur + mask
 * Versi sederhana: gaussian blur + blend mode untuk soft glow
 */
function applyBeautyRetouch(
  canvas: HTMLCanvasElement,
  beauty: BeautyParams,
): void {
  const ctx = canvas.getContext("2d")!;
  const w = canvas.width;
  const h = canvas.height;
  const imageData = ctx.getImageData(0, 0, w, h);

  // Buat versi blurred untuk smoothing
  const blurred = boxBlur(imageData, 3);

  // Blend: original * (1 - alpha) + blurred * alpha
  const alpha = beauty.smooth / 100; // 0..1
  const brightenBoost = beauty.brighten / 100 * 15; // 0..15

  const out = ctx.createImageData(w, h);
  const dst = out.data;
  const src = imageData.data;
  const blr = blurred.data;

  for (let i = 0; i < src.length; i += 4) {
    // Deteksi skin area kasar: R > 95 && G > 40 && B > 20 && R > G > B
    const r = src[i];
    const g = src[i + 1];
    const b = src[i + 2];
    const isSkin =
      r > 95 &&
      g > 40 &&
      b > 20 &&
      r > g &&
      g > b &&
      r - Math.min(g, b) > 15 &&
      Math.abs(r - g) > 15;

    if (isSkin) {
      dst[i] = clamp255(src[i] * (1 - alpha) + blr[i] * alpha + brightenBoost);
      dst[i + 1] = clamp255(
        src[i + 1] * (1 - alpha) + blr[i + 1] * alpha + brightenBoost * 0.85,
      );
      dst[i + 2] = clamp255(
        src[i + 2] * (1 - alpha) + blr[i + 2] * alpha + brightenBoost * 0.7,
      );
    } else {
      dst[i] = src[i];
      dst[i + 1] = src[i + 1];
      dst[i + 2] = src[i + 2];
    }
    dst[i + 3] = src[i + 3];
  }

  ctx.putImageData(out, 0, 0);
}

/**
 * Box blur separable untuk performance.
 */
function boxBlur(
  src: ImageData,
  radius: number,
): ImageData {
  const w = src.width;
  const h = src.height;
  const data = src.data;
  const out = new Uint8ClampedArray(data.length);

  // Horizontal pass
  const temp = new Uint8ClampedArray(data.length);
  const window = radius * 2 + 1;
  for (let y = 0; y < h; y++) {
    let rSum = 0,
      gSum = 0,
      bSum = 0,
      aSum = 0;
    // init window
    for (let x = -radius; x <= radius; x++) {
      const xi = Math.min(w - 1, Math.max(0, x));
      const idx = (y * w + xi) * 4;
      rSum += data[idx];
      gSum += data[idx + 1];
      bSum += data[idx + 2];
      aSum += data[idx + 3];
    }
    for (let x = 0; x < w; x++) {
      const idx = (y * w + x) * 4;
      temp[idx] = rSum / window;
      temp[idx + 1] = gSum / window;
      temp[idx + 2] = bSum / window;
      temp[idx + 3] = aSum / window;
      // slide window
      const xRemove = Math.min(w - 1, Math.max(0, x - radius));
      const xAdd = Math.min(w - 1, Math.max(0, x + radius + 1));
      const idxR = (y * w + xRemove) * 4;
      const idxA = (y * w + xAdd) * 4;
      rSum += data[idxA] - data[idxR];
      gSum += data[idxA + 1] - data[idxR + 1];
      bSum += data[idxA + 2] - data[idxR + 2];
      aSum += data[idxA + 3] - data[idxR + 3];
    }
  }
  // Vertical pass
  for (let x = 0; x < w; x++) {
    let rSum = 0,
      gSum = 0,
      bSum = 0,
      aSum = 0;
    for (let y = -radius; y <= radius; y++) {
      const yi = Math.min(h - 1, Math.max(0, y));
      const idx = (yi * w + x) * 4;
      rSum += temp[idx];
      gSum += temp[idx + 1];
      bSum += temp[idx + 2];
      aSum += temp[idx + 3];
    }
    for (let y = 0; y < h; y++) {
      const idx = (y * w + x) * 4;
      out[idx] = rSum / window;
      out[idx + 1] = gSum / window;
      out[idx + 2] = bSum / window;
      out[idx + 3] = aSum / window;
      const yRemove = Math.min(h - 1, Math.max(0, y - radius));
      const yAdd = Math.min(h - 1, Math.max(0, y + radius + 1));
      const idxR = (yRemove * w + x) * 4;
      const idxA = (yAdd * w + x) * 4;
      rSum += temp[idxA] - temp[idxR];
      gSum += temp[idxA + 1] - temp[idxR + 1];
      bSum += temp[idxA + 2] - temp[idxR + 2];
      aSum += temp[idxA + 3] - temp[idxR + 3];
    }
  }

  const result = new ImageData(w, h);
  result.data.set(out);
  return result;
}

/**
 * Sharpen menggunakan kernel sederhana (unsharp mask approximate).
 * amount: 0..1
 */
function applySharpen(canvas: HTMLCanvasElement, amount: number): void {
  const ctx = canvas.getContext("2d")!;
  const w = canvas.width;
  const h = canvas.height;
  const imageData = ctx.getImageData(0, 0, w, h);
  const src = imageData.data;
  const out = new Uint8ClampedArray(src.length);

  // Kernel sharpen
  // [ 0, -1,  0 ]
  // [-1,  5, -1 ]
  // [ 0, -1,  0 ]
  const center = 5;
  const neighbor = -1;

  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const idx = (y * w + x) * 4;
      for (let c = 0; c < 3; c++) {
        const i = idx + c;
        if (x === 0 || x === w - 1 || y === 0 || y === h - 1) {
          out[i] = src[i];
        } else {
          const top = src[((y - 1) * w + x) * 4 + c];
          const bottom = src[((y + 1) * w + x) * 4 + c];
          const left = src[(y * w + (x - 1)) * 4 + c];
          const right = src[(y * w + (x + 1)) * 4 + c];
          const centerVal = src[i];
          const sharpened =
            centerVal * center +
            (top + bottom + left + right) * neighbor;
          // blend dengan original sesuai amount
          out[i] = clamp255(centerVal * (1 - amount) + sharpened * amount);
        }
      }
      out[idx + 3] = src[idx + 3];
    }
  }

  const result = new ImageData(w, h);
  result.data.set(out);
  ctx.putImageData(result, 0, 0);
}

function clamp255(v: number): number {
  return v < 0 ? 0 : v > 255 ? 255 : v;
}

/**
 * Resize gambar dengan rasio objek (object-fit: contain) ke dimensi target.
 * Mengembalikan canvas berisi gambar yang sudah di-scale (sisa area transparan).
 */
export function fitContain(
  source: HTMLCanvasElement | HTMLImageElement,
  targetW: number,
  targetH: number,
  background: string = "#ffffff",
): HTMLCanvasElement {
  const srcW =
    source instanceof HTMLImageElement ? source.naturalWidth : source.width;
  const srcH =
    source instanceof HTMLImageElement ? source.naturalHeight : source.height;

  const srcRatio = srcW / srcH;
  const dstRatio = targetW / targetH;

  let drawW: number;
  let drawH: number;
  let dx: number;
  let dy: number;

  if (srcRatio > dstRatio) {
    // source lebih lebar → fit by width
    drawW = targetW;
    drawH = targetW / srcRatio;
    dx = 0;
    dy = (targetH - drawH) / 2;
  } else {
    drawH = targetH;
    drawW = targetH * srcRatio;
    dx = (targetW - drawW) / 2;
    dy = 0;
  }

  const canvas = document.createElement("canvas");
  canvas.width = targetW;
  canvas.height = targetH;
  const ctx = canvas.getContext("2d")!;
  ctx.fillStyle = background;
  ctx.fillRect(0, 0, targetW, targetH);
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = "high";
  ctx.drawImage(source, dx, dy, drawW, drawH);
  return canvas;
}

/**
 * Crop gambar dengan rasio tertentu (object-fit: cover)
 */
export function fitCover(
  source: HTMLCanvasElement | HTMLImageElement,
  targetW: number,
  targetH: number,
): HTMLCanvasElement {
  const srcW =
    source instanceof HTMLImageElement ? source.naturalWidth : source.width;
  const srcH =
    source instanceof HTMLImageElement ? source.naturalHeight : source.height;

  const srcRatio = srcW / srcH;
  const dstRatio = targetW / targetH;

  let sx: number;
  let sy: number;
  let sw: number;
  let sh: number;

  if (srcRatio > dstRatio) {
    // source lebih lebar → crop sisi kiri/kanan
    sh = srcH;
    sw = srcH * dstRatio;
    sx = (srcW - sw) / 2;
    sy = 0;
  } else {
    sw = srcW;
    sh = srcW / dstRatio;
    sx = 0;
    sy = (srcH - sh) / 2;
  }

  const canvas = document.createElement("canvas");
  canvas.width = targetW;
  canvas.height = targetH;
  const ctx = canvas.getContext("2d")!;
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = "high";
  ctx.drawImage(source, sx, sy, sw, sh, 0, 0, targetW, targetH);
  return canvas;
}

/**
 * Konversi canvas → JPEG data URL dengan kualitas tertentu.
 */
export function canvasToJpeg(
  canvas: HTMLCanvasElement,
  quality = 0.92,
): string {
  return canvas.toDataURL("image/jpeg", quality);
}

/**
 * Konversi canvas → PNG data URL (lossless)
 */
export function canvasToPng(canvas: HTMLCanvasElement): string {
  return canvas.toDataURL("image/png");
}

/**
 * Resize gambar ke dimensi tertentu dengan preserve aspect ratio (contain).
 * Returns canvas baru.
 */
export function resizeContain(
  source: HTMLCanvasElement | HTMLImageElement,
  targetW: number,
  targetH: number,
): HTMLCanvasElement {
  return fitContain(source, targetW, targetH, "rgba(0,0,0,0)");
}
