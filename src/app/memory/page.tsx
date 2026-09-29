import * as store from "@/lib/store";
import { MemoryExplorer } from "@/components/memory/memory-explorer";

export const dynamic = "force-dynamic";

export default async function MemoryPage() {
  const [notes, people, tasks, goals, reflections] = await Promise.all([
    store.getNotes(),
    store.getPeople(),
    store.getTasks(),
    store.getGoals(),
    store.getReflections(),
  ]);
  return (
    <div className="flex flex-col gap-6 animate-fade-in">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Memory</h1>
        <p className="mt-1 text-sm text-muted">Everything you&apos;ve told this system, in one searchable place.</p>
      </div>
      <MemoryExplorer notes={notes} people={people} tasks={tasks} goals={goals} reflections={reflections} />
    </div>
  );
}
