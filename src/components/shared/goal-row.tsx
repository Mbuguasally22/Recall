import { cn } from "@/lib/utils";
import type { Goal } from "@/lib/types";

const statusStyle: Record<Goal["status"], string> = {
  on_track: "bg-success",
  at_risk: "bg-warning",
  achieved: "bg-accent",
  abandoned: "bg-muted",
};

export function GoalRow({ goal }: { goal: Goal }) {
  return (
    <div className="py-2.5">
      <div className="flex items-center justify-between gap-2">
        <p className="text-sm font-medium">{goal.name}</p>
        <span className="shrink-0 text-xs text-muted">{goal.progress}%</span>
      </div>
      <div className="mt-2 h-1.5 w-full overflow-hidden rounded-full bg-black/[0.06] dark:bg-white/[0.08]">
        <div
          className={cn("h-full rounded-full transition-all", statusStyle[goal.status])}
          style={{ width: `${goal.progress}%` }}
        />
      </div>
      {goal.target_date && (
        <p className="mt-1 text-xs text-muted">
          Target {new Date(goal.target_date).toLocaleDateString("en-US", { month: "short", day: "numeric" })}
        </p>
      )}
    </div>
  );
}
