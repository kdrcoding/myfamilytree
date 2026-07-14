/**
 * Downscale an uploaded photo to a small JPEG data-URL before it is stored.
 * Phone camera photos are 3–8 MB; stored raw they make every page load pull
 * megabytes of base64 for each person. 800px JPEG keeps cards and the
 * details modal sharp at ~100–250 KB.
 */
export async function downscalePhoto(
  file: File,
  maxDim = 800,
  quality = 0.85,
): Promise<string> {
  const dataUrl = await new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result ?? ''));
    reader.onerror = () => reject(reader.error ?? new Error('Could not read file'));
    reader.readAsDataURL(file);
  });

  const image = await new Promise<HTMLImageElement>((resolve, reject) => {
    const el = new Image();
    el.onload = () => resolve(el);
    el.onerror = () => reject(new Error('Not a readable image'));
    el.src = dataUrl;
  });

  const scale = Math.min(1, maxDim / Math.max(image.width, image.height));
  const canvas = document.createElement('canvas');
  canvas.width = Math.max(1, Math.round(image.width * scale));
  canvas.height = Math.max(1, Math.round(image.height * scale));
  const ctx = canvas.getContext('2d');
  if (!ctx) return dataUrl; // canvas unavailable — store as-is
  // JPEG has no transparency; paint white behind transparent PNGs.
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.drawImage(image, 0, 0, canvas.width, canvas.height);
  const compressed = canvas.toDataURL('image/jpeg', quality);
  // Tiny originals (small PNG logos etc.) can compress larger — keep the smaller one.
  return compressed.length < dataUrl.length ? compressed : dataUrl;
}
