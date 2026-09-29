import * as store from "@/lib/store";
import { ReflectionsView } from "@/components/reflections/reflections-view";

export const dynamic = "force-dynamic";

export default async function ReflectionsPage() {
  const reflections = await store.getReflections();
  return (
    <div className="flex flex-col gap-6 animate-fade-in">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Reflections</h1>
        <p className="mt-1 text-sm text-muted">Successes, failures, and lessons — in your own words.</p>
      </div>
      <ReflectionsView reflections={reflections} />
    </div>
  );
}
