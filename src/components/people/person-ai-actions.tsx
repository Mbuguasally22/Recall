"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { MessageCircleQuestion, PenLine, ListPlus, Loader2, AlertTriangle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

export function PersonAiActions({ personId, personName }: { personId: string; personName: string }) {
  const router = useRouter();
  const [draft, setDraft] = React.useState<string | null>(null);
  const [draftError, setDraftError] = React.useState<string | null>(null);
  const [drafting, setDrafting] = React.useState(false);
  const [showTaskForm, setShowTaskForm] = React.useState(false);
  const [taskTitle, setTaskTitle] = React.useState(`Follow up with ${personName}`);
  const [savingTask, setSavingTask] = React.useState(false);

  async function draftFollowUp() {
    setDrafting(true);
    setDraft(null);
    setDraftError(null);
    const res = await fetch(`/api/people/${personId}/draft-followup`, { method: "POST" });
    const data = await res.json();
    setDrafting(false);
    if (!res.ok) {
      setDraftError(data.error ?? "Couldn't draft that right now.");
      return;
    }
    setDraft(data.draft);
  }

  async function createTask() {
    if (!taskTitle.trim()) return;
    setSavingTask(true);
    await fetch("/api/tasks", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ title: taskTitle, related_person_id: personId }),
    });
    setSavingTask(false);
    setShowTaskForm(false);
    router.refresh();
  }

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap gap-2">
        <Button
          size="sm"
          variant="secondary"
          onClick={() => router.push(`/assistant?q=${encodeURIComponent(`What do I know about ${personName}?`)}`)}
        >
          <MessageCircleQuestion /> Ask about {personName.split(" ")[0]}
        </Button>
        <Button size="sm" variant="secondary" onClick={draftFollowUp} disabled={drafting}>
          {drafting ? <Loader2 className="animate-spin" /> : <PenLine />} Draft follow-up
        </Button>
        <Button size="sm" variant="secondary" onClick={() => setShowTaskForm((s) => !s)}>
          <ListPlus /> Create task
        </Button>
      </div>

      {showTaskForm && (
        <div className="flex gap-2 rounded-lg border border-border p-2.5 animate-fade-in">
          <Input value={taskTitle} onChange={(e) => setTaskTitle(e.target.value)} className="flex-1" />
          <Button size="sm" onClick={createTask} disabled={savingTask}>
            {savingTask ? <Loader2 className="animate-spin" /> : "Add"}
          </Button>
        </div>
      )}

      {draftError && (
        <div className="flex items-start gap-2 rounded-lg border border-warning/30 bg-warning-soft px-3 py-2 text-xs text-warning animate-fade-in">
          <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
          {draftError}
        </div>
      )}

      {draft && (
        <div className="rounded-lg border border-border-subtle bg-black/[0.015] p-3 text-sm animate-fade-in dark:bg-white/[0.02]">
          <p className="mb-1 text-xs font-medium text-muted">Drafted follow-up</p>
          <p className="whitespace-pre-wrap">{draft}</p>
        </div>
      )}
    </div>
  );
}
