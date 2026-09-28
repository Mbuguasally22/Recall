import * as store from "@/lib/store";
import { GoalsView } from "@/components/goals/goals-view";

export const dynamic = "force-dynamic";

export default function GoalsPage() {
  const goals = store.getGoals();
  return (
    <div className="flex flex-col gap-6 animate-fade-in">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Goals</h1>
        <p className="mt-1 text-sm text-muted">Progress is only ever set by you — never invented.</p>
      </div>
      <GoalsView
        shortGoals={goals.filter((g) => g.term === "short_term")}
        longGoals={goals.filter((g) => g.term === "long_term")}
      />
    </div>
  );
}
