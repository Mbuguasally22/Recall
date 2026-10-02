import { NextResponse } from "next/server";
import * as store from "@/lib/store";
import { buildTearsheet, type TearsheetItem } from "@/lib/images/colorway-tearsheet";

export const maxDuration = 60;

export async function POST(request: Request) {
  let body: { colorway_ids?: string[] };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid request body." }, { status: 400 });
  }

  const ids = Array.isArray(body.colorway_ids) ? body.colorway_ids : [];
  if (ids.length === 0) {
    return NextResponse.json({ error: "Pick at least one colorway first." }, { status: 400 });
  }

  try {
    const items: TearsheetItem[] = [];
    for (const id of ids) {
      const colorway = await store.getColorway(id);
      if (!colorway) continue;
      const photoPath = colorway.cutout_photo_path ?? colorway.original_photo_path;
      const imageBuffer = await store.downloadColorwayPhoto(photoPath);
      items.push({
        imageBuffer,
        name: colorway.name ?? "Unnamed",
        hexCodes: colorway.hex_codes,
      });
    }
    if (items.length === 0) {
      return NextResponse.json({ error: "None of those colorways could be found." }, { status: 404 });
    }

    const png = await buildTearsheet(items);
    return new Response(new Uint8Array(png), {
      status: 200,
      headers: {
        "Content-Type": "image/png",
        "Content-Disposition": "inline; filename=\"bumby-colorway-tearsheet.png\"",
      },
    });
  } catch {
    return NextResponse.json({ error: "Couldn't build the tearsheet.", detail: "Try again." }, { status: 502 });
  }
}
