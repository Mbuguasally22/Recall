"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Circle, CheckCircle2, Sparkles } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { cn, formatDateShort, isOverdue } from "@/lib/utils";
import type { Task } from "@/lib/types";

export function TaskRow({
  task,
  personName,
}: {
  task: Task;
  personName?: string | null;
}) {
  const router = useRouter();
  const [pending, setPending] = React.useState(false);
  const completed = task.status === "completed";
  const overdue = !completed && isOverdue(task.due_date);

  async function toggle() {
    setPending(true);
    await fetch(`/api/tasks/${task.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status: completed ? "todo" : "completed" }),
    });
    setPending(false);
    router.refresh();
  }

  return (
    <div className="flex items-start gap-3 py-2.5">
      <button
        onClick={toggle}
        disabled={pending}
        className="mt-0.5 shrink-0 text-muted transition-colors hover:text-accent disabled:opacity-50"
        aria-label={completed ? "Mark as not done" : "Mark as done"}
      >
        {completed ? <CheckCircle2 className="h-[18px] w-[18px] text-success" /> : <Circle className="h-[18px] w-[18px]" />}
      </button>
      <div className="min-w-0 flex-1">
        <p className={cn("text-sm font-medium", completed && "text-muted line-through")}>{task.title}</p>
        <div className="mt-0.5 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-muted">
          {personName && <span>{personName}</span>}
          {task.due_date && (
            <span className={cn(overdue && "font-medium text-danger")}>
              {overdue ? "Overdue · " : "Due "}
              {formatDateShort(task.due_date)}
            </span>
          )}
          {task.ai_generated && (
            <Badge variant="secondary" className="gap-0.5 px-1.5 py-0">
              <Sparkles className="h-2.5 w-2.5" /> AI
            </Badge>
          )}
        </div>
      </div>
      {task.related_note_id && (
        <Link href={`/notes/${task.related_note_id}`} className="shrink-0 text-xs text-muted hover:text-accent">
          Source
        </Link>
      )}
    </div>
  );
}
