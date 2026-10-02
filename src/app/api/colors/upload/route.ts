import { NextResponse } from "next/server";
import { randomUUID } from "crypto";
import * as store from "@/lib/store";
import { MissingApiKeyError } from "@/lib/ai/client";
import { suggestColorwayNames } from "@/lib/ai/colorway-naming";
import { extractDominantHexColors } from "@/lib/images/colorway-hex";
import {
  removeBackground,
  MissingBackgroundRemovalKeyError,
  BackgroundRemovalError,
} from "@/lib/integrations/background-removal";

export const maxDuration = 60;

const SUPPORTED_MEDIA_TYPES = new Set(["image/png", "image/jpeg", "image/webp", "image/gif"]);
const MAX_BYTES = 15_000_000;

function extensionFor(contentType: string): string {
  return contentType.split("/")[1]?.split("+")[0] || "jpg";
}

export async function POST(request: Request) {
  let form: FormData;
  try {
    form = await request.formData();
  } catch {
    return NextResponse.json({ error: "Invalid upload — expected multipart form data." }, { status: 400 });
  }

  const file = form.get("photo");
  if (!(file instanceof File)) {
    return NextResponse.json({ error: "No photo was attached." }, { status: 400 });
  }
  const contentType = file.type || "image/jpeg";
  if (!SUPPORTED_MEDIA_TYPES.has(contentType)) {
    return NextResponse.json({ error: `Unsupported image type "${contentType}".` }, { status: 400 });
  }
  if (file.size > MAX_BYTES) {
    return NextResponse.json({ error: "That photo is too large — try a smaller one." }, { status: 400 });
  }

  const originalBuffer = Buffer.from(await file.arrayBuffer());
  const filePrefix = randomUUID();
  const notes: string[] = [];

  // 1. Upload the original photo first — this always succeeds regardless of
  // what happens below, so the photo is never lost even if the AI steps fail.
  let originalPath: string;
  try {
    originalPath = await store.uploadColorwayPhoto(
      `${filePrefix}-original.${extensionFor(contentType)}`,
      originalBuffer,
      contentType
    );
  } catch {
    return NextResponse.json(
      { error: "Couldn't save that photo.", detail: "Check your Supabase storage connection and try again." },
      { status: 502 }
    );
  }

  // 2. Remove the background, if configured. Falls back to the original
  // photo for hex-sampling and naming if this isn't set up yet or fails.
  let cutoutBuffer: Buffer | null = null;
  let cutoutPath: string | null = null;
  try {
    cutoutBuffer = await removeBackground(originalBuffer, contentType);
    cutoutPath = await store.uploadColorwayPhoto(`${filePrefix}-cutout.png`, cutoutBuffer, "image/png");
  } catch (err) {
    if (err instanceof MissingBackgroundRemovalKeyError) {
      notes.push("Background removal isn't set up yet — using the original photo as-is.");
    } else if (err instanceof BackgroundRemovalError) {
      notes.push(`Background removal failed (${err.message}) — using the original photo as-is.`);
    } else {
      notes.push("Background removal failed — using the original photo as-is.");
    }
  }

  const analysisBuffer = cutoutBuffer ?? originalBuffer;
  const analysisMediaType = cutoutBuffer ? "image/png" : (contentType as "image/png" | "image/jpeg" | "image/webp" | "image/gif");

  // 3. Dominant hex code(s) — plain pixel math, always available.
  const hexCodes = await extractDominantHexColors(analysisBuffer).catch(() => []);

  // 4. AI name suggestions, matched to Bumby's existing voice.
  let aiNameSuggestions: string[] = [];
  try {
    aiNameSuggestions = await suggestColorwayNames(analysisBuffer, analysisMediaType, hexCodes);
    if (aiNameSuggestions.length === 0) {
      notes.push("AI didn't return name suggestions this time — you can still type your own.");
    }
  } catch (err) {
    if (err instanceof MissingApiKeyError) {
      notes.push("AI naming isn't configured yet — you can still type your own name.");
    } else {
      notes.push("AI naming wasn't available this time — you can still type your own name.");
    }
  }

  try {
    const colorway = await store.createColorwayDraft({
      original_photo_path: originalPath,
      cutout_photo_path: cutoutPath,
      hex_codes: hexCodes,
      ai_name_suggestions: aiNameSuggestions,
    });
    const [originalUrl, cutoutUrl] = await Promise.all([
      store.getColorwayPhotoUrl(colorway.original_photo_path),
      colorway.cutout_photo_path ? store.getColorwayPhotoUrl(colorway.cutout_photo_path) : Promise.resolve(null),
    ]);
    return NextResponse.json({
      colorway,
      original_photo_url: originalUrl,
      cutout_photo_url: cutoutUrl,
      notes,
    });
  } catch {
    return NextResponse.json(
      { error: "Couldn't save that colorway.", detail: "The photo uploaded, but saving the record failed — try again." },
      { status: 502 }
    );
  }
}
