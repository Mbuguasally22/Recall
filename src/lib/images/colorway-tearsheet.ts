// Composites a batch of named colorway photos into one grid image (a
// "tearsheet") with each one's name + hex code(s) labeled underneath, ready
// to post. Pure image compositing via sharp — no AI call involved.

import sharp, { type OverlayOptions } from "sharp";

export interface TearsheetItem {
  imageBuffer: Buffer;
  name: string;
  hexCodes: string[];
}

const CELL_WIDTH = 320;
const IMAGE_HEIGHT = 300;
const LABEL_HEIGHT = 90;
const CELL_HEIGHT = IMAGE_HEIGHT + LABEL_HEIGHT;
const PADDING = 16;
const MAX_COLUMNS = 4;

function escapeXml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

function labelSvg(item: TearsheetItem): Buffer {
  const swatchSize = 16;
  const swatchGap = 6;
  const totalSwatchWidth = item.hexCodes.length * swatchSize + Math.max(0, item.hexCodes.length - 1) * swatchGap;
  const startX = CELL_WIDTH / 2 - totalSwatchWidth / 2;
  const swatches = item.hexCodes
    .map(
      (hex, i) =>
        `<rect x="${startX + i * (swatchSize + swatchGap)}" y="34" width="${swatchSize}" height="${swatchSize}" rx="3" fill="${escapeXml(
          hex
        )}" stroke="#d1d5db" stroke-width="1"/>`
    )
    .join("");

  const svg = `
    <svg width="${CELL_WIDTH}" height="${LABEL_HEIGHT}" xmlns="http://www.w3.org/2000/svg">
      <rect width="100%" height="100%" fill="#ffffff"/>
      <text x="50%" y="22" font-size="18" font-family="Georgia, serif" text-anchor="middle" fill="#1F3A5F" font-weight="bold">${escapeXml(
        item.name
      )}</text>
      ${swatches}
      <text x="50%" y="75" font-size="11" font-family="monospace" text-anchor="middle" fill="#6b7280">${escapeXml(
        item.hexCodes.join("  ·  ")
      )}</text>
    </svg>`;
  return Buffer.from(svg);
}

/** Builds one PNG grid image (max 4 columns) from a batch of named colorways. */
export async function buildTearsheet(items: TearsheetItem[]): Promise<Buffer> {
  if (items.length === 0) {
    throw new Error("Can't build a tearsheet with no colorways.");
  }

  const columns = Math.min(items.length, MAX_COLUMNS);
  const rows = Math.ceil(items.length / columns);
  const width = columns * CELL_WIDTH;
  const height = rows * CELL_HEIGHT;

  const composites: OverlayOptions[] = [];

  for (let i = 0; i < items.length; i++) {
    const item = items[i];
    const col = i % columns;
    const row = Math.floor(i / columns);
    const cellX = col * CELL_WIDTH;
    const cellY = row * CELL_HEIGHT;

    const resizedImage = await sharp(item.imageBuffer)
      .resize(CELL_WIDTH - PADDING * 2, IMAGE_HEIGHT - PADDING, {
        fit: "contain",
        background: { r: 255, g: 255, b: 255, alpha: 0 },
      })
      .png()
      .toBuffer();

    composites.push({ input: resizedImage, left: cellX + PADDING, top: cellY + PADDING / 2 });
    composites.push({ input: labelSvg(item), left: cellX, top: cellY + IMAGE_HEIGHT });
  }

  return sharp({
    create: { width, height, channels: 4, background: { r: 255, g: 255, b: 255, alpha: 1 } },
  })
    .composite(composites)
    .png()
    .toBuffer();
}
