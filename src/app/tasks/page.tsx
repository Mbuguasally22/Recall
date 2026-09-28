import * as store from "@/lib/store";
import { TasksBoard } from "@/components/tasks/tasks-board";

export const dynamic = "force-dynamic";

export default function TasksPage() {
  const tasks = store.getTasks();
  const peopleById = new Map(store.getPeople().map((p) => [p.id, p]));

  return (
    <div className="flex flex-col gap-6 animate-fade-in">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Tasks</h1>
        <p className="mt-1 text-sm text-muted">{tasks.length} tasks tracked</p>
      </div>
      <TasksBoard tasks={tasks} peopleById={peopleById} />
    </div>
  );
}
