import * as store from "@/lib/store";
import { ColorsExplorer, type ColorwayWithUrl } from "@/components/colors/colors-explorer";

export const dynamic = "force-dynamic";

export default async function ColorsPage() {
  const colorways = await store.getColorways();

  const withUrls: ColorwayWithUrl[] = await Promise.all(
    colorways.map(async (colorway) => {
      const path = colorway.cutout_photo_path ?? colorway.original_photo_path;
      const photoUrl = await store.getColorwayPhotoUrl(path);
      return { colorway, photoUrl };
    })
  );

  return (
    <div className="flex flex-col gap-6 animate-fade-in">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Colors</h1>
        <p className="mt-1 text-sm text-muted">
          Upload a new wool colorway photo — background removed, a name suggested in Bumby&apos;s voice, and the hex
          code pulled automatically.
        </p>
      </div>
      <ColorsExplorer initialColorways={withUrls} />
    </div>
  );
}
