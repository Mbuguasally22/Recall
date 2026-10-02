// remove.bg's REST API (https://www.remove.bg/api — a long-stable, publicly
// documented endpoint, not something guessed at): POST the photo as
// multipart/form-data, get a background-removed PNG back. SERVER-ONLY.

export class MissingBackgroundRemovalKeyError extends Error {
  constructor() {
    super("REMOVE_BG_API_KEY is not configured on the server.");
    this.name = "MissingBackgroundRemovalKeyError";
  }
}

export class BackgroundRemovalError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "BackgroundRemovalError";
  }
}

/** Sends a photo to remove.bg and returns the background-removed PNG bytes. */
export async function removeBackground(imageBuffer: Buffer, contentType: string): Promise<Buffer> {
  const apiKey = process.env.REMOVE_BG_API_KEY;
  if (!apiKey) throw new MissingBackgroundRemovalKeyError();

  const form = new FormData();
  form.append("image_file", new Blob([new Uint8Array(imageBuffer)], { type: contentType }), "photo");
  form.append("size", "auto");

  const res = await fetch("https://api.remove.bg/v1.0/removebg", {
    method: "POST",
    headers: { "X-Api-Key": apiKey },
    body: form,
  });

  if (!res.ok) {
    let detail = `remove.bg returned HTTP ${res.status}`;
    try {
      const body = await res.json();
      const first = body?.errors?.[0];
      if (first?.title) detail = first.title as string;
    } catch {
      // Non-JSON error body — stick with the status-code message.
    }
    throw new BackgroundRemovalError(detail);
  }

  const arrayBuffer = await res.arrayBuffer();
  return Buffer.from(arrayBuffer);
}
