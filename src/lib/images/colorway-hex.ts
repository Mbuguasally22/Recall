// Pulls the dominant color(s) out of a colorway photo as plain hex codes —
// no AI call needed, just pixel math. Run this against the background-removed
// cutout when there is one, so the (transparent) background never counts.

import sharp from "sharp";

function rgbToHex(r: number, g: number, b: number): string {
  const clamp = (v: number) => Math.max(0, Math.min(255, Math.round(v)));
  return (
    "#" +
    [clamp(r), clamp(g), clamp(b)]
      .map((v) => v.toString(16).padStart(2, "0"))
      .join("")
  );
}

/** Returns up to `maxColors` dominant hex codes, most common first. */
export async function extractDominantHexColors(
  imageBuffer: Buffer,
  maxColors = 3
): Promise<string[]> {
  const { data, info } = await sharp(imageBuffer)
    .resize(64, 64, { fit: "inside" })
    .ensureAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });

  const channels = info.channels; // 4 (RGBA) since ensureAlpha()
  const bucketSize = 24; // quantize so near-identical shades count together
  const counts = new Map<string, { count: number; r: number; g: number; b: number }>();

  for (let i = 0; i + channels <= data.length; i += channels) {
    const r = data[i];
    const g = data[i + 1];
    const b = data[i + 2];
    const a = data[i + 3];
    if (a < 128) continue; // transparent (removed background) — skip

    const qr = Math.round(r / bucketSize) * bucketSize;
    const qg = Math.round(g / bucketSize) * bucketSize;
    const qb = Math.round(b / bucketSize) * bucketSize;
    const key = `${qr},${qg},${qb}`;
    const existing = counts.get(key);
    if (existing) {
      existing.count += 1;
    } else {
      counts.set(key, { count: 1, r: qr, g: qg, b: qb });
    }
  }

  const sorted = [...counts.values()].sort((a, b) => b.count - a.count);
  return sorted.slice(0, maxColors).map((c) => rgbToHex(c.r, c.g, c.b));
}
