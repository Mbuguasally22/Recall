import { NextResponse } from "next/server";
import { getAnthropicClient, MissingApiKeyError, CLAUDE_MODEL } from "@/lib/ai/client";

// Pasting a screenshot (Ctrl+V straight into the Capture box) sends the
// image here so Claude can read it, since a note is stored as text — the
// image itself is never kept. This is a real vision call (transcribes any
// text verbatim, or briefly describes the image if there's none), not a
// stub: what comes back is inserted into the textarea exactly like pasted
// text would be, then flows through the same capture pipeline unchanged.

const SUPPORTED_MEDIA_TYPES = new Set(["image/png", "image/jpeg", "image/webp", "image/gif"]);
const MAX_BASE64_LENGTH = 5_000_000; // ~3.75MB decoded — comfortably under Claude's per-image limit

export async function POST(request: Request) {
  let body: { image_base64?: string; media_type?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid request body." }, { status: 400 });
  }

  const { image_base64: imageBase64, media_type: mediaType } = body;
  if (!imageBase64 || !mediaType) {
    return NextResponse.json({ error: "Missing image data." }, { status: 400 });
  }
  if (!SUPPORTED_MEDIA_TYPES.has(mediaType)) {
    return NextResponse.json({ error: `Unsupported image type "${mediaType}".` }, { status: 400 });
  }
  if (imageBase64.length > MAX_BASE64_LENGTH) {
    return NextResponse.json({ error: "That image is too large to paste directly — try a smaller screenshot." }, { status: 400 });
  }

  try {
    const client = getAnthropicClient();
    const message = await client.messages.create({
      model: CLAUDE_MODEL,
      max_tokens: 1024,
      messages: [
        {
          role: "user",
          content: [
            {
              type: "image",
              source: { type: "base64", media_type: mediaType as "image/png" | "image/jpeg" | "image/webp" | "image/gif", data: imageBase64 },
            },
            {
              type: "text",
              text: "Transcribe any text in this image verbatim, preserving line breaks. If there's no readable text, briefly describe what's shown instead (e.g. \"Screenshot of a calendar invite for...\"). Plain text only, no preamble like \"Here's the text:\".",
            },
          ],
        },
      ],
    });
    const textBlock = message.content.find((b) => b.type === "text");
    const text = textBlock && textBlock.type === "text" ? textBlock.text.trim() : "";
    if (!text) {
      return NextResponse.json({ error: "Couldn't read anything from that image." }, { status: 502 });
    }
    return NextResponse.json({ text });
  } catch (err) {
    if (err instanceof MissingApiKeyError) {
      return NextResponse.json(
        { error: "AI processing isn't configured yet.", detail: "ANTHROPIC_API_KEY is missing on the server.", code: "missing_api_key" },
        { status: 503 }
      );
    }
    console.error("capture/paste-image failed", err);
    return NextResponse.json({ error: "I couldn't read that image right now.", detail: "Try again, or type/paste the text instead." }, { status: 502 });
  }
}
