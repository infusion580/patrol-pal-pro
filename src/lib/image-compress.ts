/**
 * Client-side image compression.
 *
 * Why
 * ---
 * Field photos (rondín evidence, INE, pendientes) come straight from phone
 * cameras at 4–8 MB each. Uploading them raw burns the guard's mobile data
 * and fills storage fast. Compressing to a bounded resolution + JPEG quality
 * typically reduces size by 85–95% with no loss of legibility for evidence.
 *
 * Behaviour
 * ---------
 * - Resizes so the longest side is at most `maxSide` (default 1600px).
 * - Re-encodes as JPEG at `quality` (default 0.72).
 * - Never throws: on any failure (unsupported format, no canvas) the original
 *   file is returned so the capture flow keeps working.
 */

export interface CompressOptions {
  /** Longest side in pixels after resize. */
  maxSide?: number;
  /** JPEG quality between 0 and 1. */
  quality?: number;
  /** Skip compression when the file is already smaller than this (bytes). */
  skipUnderBytes?: number;
}

const DEFAULTS: Required<CompressOptions> = {
  maxSide: 1600,
  quality: 0.72,
  skipUnderBytes: 200 * 1024,
};

function loadBitmap(file: Blob): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      URL.revokeObjectURL(url);
      resolve(img);
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error('No se pudo leer la imagen'));
    };
    img.src = url;
  });
}

/**
 * Compress an image blob. Always resolves — returns the original on failure.
 */
export async function compressImage(file: Blob, options: CompressOptions = {}): Promise<Blob> {
  const { maxSide, quality, skipUnderBytes } = { ...DEFAULTS, ...options };

  const type = (file as File).type || '';
  if (!type.startsWith('image/') || type === 'image/gif') return file;
  if (file.size <= skipUnderBytes) return file;

  try {
    const img = await loadBitmap(file);
    const scale = Math.min(1, maxSide / Math.max(img.naturalWidth, img.naturalHeight));
    const width = Math.round(img.naturalWidth * scale);
    const height = Math.round(img.naturalHeight * scale);

    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext('2d');
    if (!ctx) return file;
    ctx.drawImage(img, 0, 0, width, height);

    const blob = await new Promise<Blob | null>((resolve) =>
      canvas.toBlob((b) => resolve(b), 'image/jpeg', quality),
    );

    // Only keep the compressed version if it actually saves space.
    if (blob && blob.size > 0 && blob.size < file.size) return blob;
    return file;
  } catch {
    return file;
  }
}

/** Human-readable size, for logs and UI hints. */
export function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}
