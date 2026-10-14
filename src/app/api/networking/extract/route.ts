import { NextResponse } from "next/server";
import { MissingApiKeyError } from "@/lib/ai/client";
import { extractBusinessCard, type BusinessCardExtraction } from "@/lib/ai/business-card-extraction";
import { structureContactNote, type ContactNoteStructure } from "@/lib/ai/contact-note-structuring";
import * as store from "@/lib/store";

export interface NetworkingExtractRequest {
  image_base64?: string;
  media_type?: "image/png" | "image/jpeg" | "image/webp" | "image/gif";
  note_text?: string;
}

export interface NetworkingExtractResponse {
  card: BusinessCardExtraction | null;
  card_error: string | null;
  matched_person_id: string | null;
  note: ContactNoteStructure | null;
  note_error: string | null;
}

const SUPPORTED_MEDIA_TYPES = new Set(["image/png", "image/jpeg", "image/webp", "image/gif"]);

// Step 2 of the Networking capture workflow: runs the business-card photo
// and the dictated/typed note through AI in parallel. Each half degrades
// independently — a failure on one (missing key, bad photo, AI hiccup)
// never blocks the other, and the raw inputs are never lost since this
// route only reads them; nothing is saved here (see networking/save).
export async function POST(request: Request) {
  let body: NetworkingExtractRequest;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid request body." }, { status: 400 });
  }

  const hasImage = !!body.image_base64 && !!body.media_type;
  const hasNote = !!body.note_text?.trim();
  if (!hasImage && !hasNote) {
    return NextResponse.json({ error: "Nothing to extract — add a business card photo or a note." }, { status: 400 });
  }
  if (hasImage && !SUPPORTED_MEDIA_TYPES.has(body.media_type!)) {
    return NextResponse.json({ error: `Unsupported image type "${body.media_type}".` }, { status: 400 });
  }

  let card: BusinessCardExtraction | null = null;
  let cardError: string | null = null;
  let matchedPersonId: string | null = null;

  if (hasImage) {
    try {
      card = await extractBusinessCard(Buffer.from(body.image_base64!, "base64"), body.media_type!);
      if (card.name) {
        const existing = await store.findPersonByName(card.name);
        matchedPersonId = existing?.id ?? null;
      }
    } catch (err) {
      cardError =
        err instanceof MissingApiKeyError
          ? "AI processing isn't configured yet — type the contact's details in by hand."
          : "Couldn't read that business card — type the contact's details in by hand.";
      console.error("networking/extract card failed", err);
    }
  }

  let note: ContactNoteStructure | null = null;
  let noteError: string | null = null;

  if (hasNote) {
    try {
      note = await structureContactNote(body.note_text!);
    } catch (err) {
      noteError =
        err instanceof MissingApiKeyError
          ? "AI processing isn't configured yet — your note will still be saved as-is."
          : "Couldn't process that note with AI — it'll still be saved as-is.";
      console.error("networking/extract note failed", err);
    }
  }

  const response: NetworkingExtractResponse = { card, card_error: cardError, matched_person_id: matchedPersonId, note, note_error: noteError };
  return NextResponse.json(response);
}
