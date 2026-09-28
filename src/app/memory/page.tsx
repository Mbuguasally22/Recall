import * as store from "@/lib/store";
import { MemoryExplorer } from "@/components/memory/memory-explorer";

export const dynamic = "force-dynamic";

export default function MemoryPage() {
  return (
    <div className="flex flex-col gap-6 animate-fade-in">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Memory</h1>
        <p className="mt-1 text-sm text-muted">Everything you&apos;ve told this system, in one searchable place.</p>
      </div>
      <MemoryExplorer
        notes={store.getNotes()}
        people={store.getPeople()}
        tasks={store.getTasks()}
        goals={store.getGoals()}
        reflections={store.getReflections()}
      />
    </div>
  );
}
