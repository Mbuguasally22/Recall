"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Plus, Loader2 } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { EmptyState } from "@/components/ui/empty-state";
import { Target } from "lucide-react";
import { cn } from "@/lib/utils";
import type { Goal, GoalTerm } from "@/lib/types";

const statusVariant: Record<Goal["status"], "success" | "warning" | "default" | "secondary"> = {
  on_track: "success",
  at_risk: "warning",
  achieved: "default",
  abandoned: "secondary",
};

function GoalCard({ goal }: { goal: Goal }) {
  return (
    <Card>
      <CardContent className="pt-5">
        <div className="flex items-start justify-between gap-2">
          <p className="text-sm font-semibold">{goal.name}</p>
          <Badge variant={statusVariant[goal.status]}>{goal.status.replace("_", " ")}</Badge>
        </div>
        {goal.description && <p className="mt-1 text-sm text-muted-foreground">{goal.description}</p>}
        <div className="mt-3 h-1.5 w-full overflow-hidden rounded-full bg-black/[0.06] dark:bg-white/[0.08]">
          <div
            className={cn("h-full rounded-full", goal.status === "at_risk" ? "bg-warning" : "bg-accent")}
            style={{ width: `${goal.progress}%` }}
          />
        </div>
        <div className="mt-2 flex items-center justify-between text-xs text-muted">
          <span>{goal.progress}% complete</span>
          {goal.target_date && (
            <span>Target {new Date(goal.target_date).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}</span>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

function AddGoalForm({ term, onDone }: { term: GoalTerm; onDone: () => void }) {
  const router = useRouter();
  const [name, setName] = React.useState("");
  const [saving, setSaving] = React.useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim()) return;
    setSaving(true);
    await fetch("/api/goals", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name, term }),
    });
    setSaving(false);
    setName("");
    onDone();
    router.refresh();
  }

  return (
    <form onSubmit={submit} className="flex gap-2 rounded-lg border border-border p-2.5">
      <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="New goal name..." className="flex-1" autoFocus />
      <Button size="sm" type="submit" disabled={saving}>
        {saving ? <Loader2 className="animate-spin" /> : "Add"}
      </Button>
    </form>
  );
}

export function GoalsView({ shortGoals, longGoals }: { shortGoals: Goal[]; longGoals: Goal[] }) {
  const [addingTerm, setAddingTerm] = React.useState<GoalTerm | null>(null);

  return (
    <div className="flex flex-col gap-8">
      <section>
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-muted">Short-term goals</h2>
          <Button size="sm" variant="ghost" onClick={() => setAddingTerm(addingTerm === "short_term" ? null : "short_term")}>
            <Plus /> Add
          </Button>
        </div>
        {addingTerm === "short_term" && (
          <div className="mb-3">
            <AddGoalForm term="short_term" onDone={() => setAddingTerm(null)} />
          </div>
        )}
        {shortGoals.length === 0 ? (
          <EmptyState icon={Target} title="No short-term goals yet" />
        ) : (
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {shortGoals.map((g) => <GoalCard key={g.id} goal={g} />)}
          </div>
        )}
      </section>

      <section>
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-muted">Long-term goals</h2>
          <Button size="sm" variant="ghost" onClick={() => setAddingTerm(addingTerm === "long_term" ? null : "long_term")}>
            <Plus /> Add
          </Button>
        </div>
        {addingTerm === "long_term" && (
          <div className="mb-3">
            <AddGoalForm term="long_term" onDone={() => setAddingTerm(null)} />
          </div>
        )}
        {longGoals.length === 0 ? (
          <EmptyState icon={Target} title="No long-term goals yet" />
        ) : (
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {longGoals.map((g) => <GoalCard key={g.id} goal={g} />)}
          </div>
        )}
      </section>
    </div>
  );
}
