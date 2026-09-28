"use client";

import * as React from "react";
import Link from "next/link";
import { Search, StickyNote, Users2, CheckSquare, Target, Sparkles as SparklesIcon } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { EmptyState } from "@/components/ui/empty-state";
import { cn, timeAgo } from "@/lib/utils";
import type { Goal, Note, Person, Reflection, Task } from "@/lib/types";

type ItemKind = "note" | "person" | "task" | "goal" | "reflection";

interface MemoryItem {
  kind: ItemKind;
  id: string;
  title: string;
  detail: string;
  href: string;
  timestamp: string;
}

const kindMeta: Record<ItemKind, { label: string; icon: typeof StickyNote; color: string }> = {
  note: { label: "Note", icon: StickyNote, color: "text-accent" },
  person: { label: "Person", icon: Users2, color: "text-emerald-600" },
  task: { label: "Task", icon: CheckSquare, color: "text-amber-600" },
  goal: { label: "Goal", icon: Target, color: "text-indigo-600" },
  reflection: { label: "Reflection", icon: SparklesIcon, color: "text-pink-600" },
};

export function MemoryExplorer({
  notes,
  people,
  tasks,
  goals,
  reflections,
}: {
  notes: Note[];
  people: Person[];
  tasks: Task[];
  goals: Goal[];
  reflections: Reflection[];
}) {
  const [query, setQuery] = React.useState("");
  const [activeKind, setActiveKind] = React.useState<ItemKind | "all">("all");

  const items: MemoryItem[] = React.useMemo(() => {
    const noteItems: MemoryItem[] = notes.map((n) => ({
      kind: "note",
      id: n.id,
      title: n.title,
      detail: n.ai_summary ?? n.raw_content,
      href: `/notes/${n.id}`,
      timestamp: n.created_at,
    }));
    const personItems: MemoryItem[] = people.map((p) => ({
      kind: "person",
      id: p.id,
      title: p.name,
      detail: [p.industry, p.location].filter(Boolean).join(" · ") || "—",
      href: `/people/${p.id}`,
      timestamp: p.created_at,
    }));
    const taskItems: MemoryItem[] = tasks.map((t) => ({
      kind: "task",
      id: t.id,
      title: t.title,
      detail: t.description ?? t.status.replace("_", " "),
      href: "/tasks",
      timestamp: t.created_at,
    }));
    const goalItems: MemoryItem[] = goals.map((g) => ({
      kind: "goal",
      id: g.id,
      title: g.name,
      detail: g.description ?? "",
      href: "/goals",
      timestamp: g.created_at,
    }));
    const reflectionItems: MemoryItem[] = reflections.map((r) => ({
      kind: "reflection",
      id: r.id,
      title: r.content.slice(0, 60),
      detail: r.type,
      href: "/reflections",
      timestamp: r.created_at,
    }));
    return [...noteItems, ...personItems, ...taskItems, ...goalItems, ...reflectionItems].sort(
      (a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
    );
  }, [notes, people, tasks, goals, reflections]);

  const filtered = items.filter((item) => {
    if (activeKind !== "all" && item.kind !== activeKind) return false;
    if (!query) return true;
    const q = query.toLowerCase();
    return item.title.toLowerCase().includes(q) || item.detail.toLowerCase().includes(q);
  });

  const counts = items.reduce<Record<string, number>>((acc, i) => {
    acc[i.kind] = (acc[i.kind] ?? 0) + 1;
    return acc;
  }, {});

  return (
    <div className="flex flex-col gap-4">
      <div className="relative">
        <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted" />
        <Input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search everything you've captured..."
          className="pl-9"
        />
      </div>

      <div className="flex flex-wrap gap-1.5">
        <button
          onClick={() => setActiveKind("all")}
          className={cn(
            "rounded-full border px-3 py-1 text-xs font-medium",
            activeKind === "all" ? "border-accent bg-accent-soft text-accent" : "border-border text-muted hover:text-foreground"
          )}
        >
          All ({items.length})
        </button>
        {(Object.keys(kindMeta) as ItemKind[]).map((k) => (
          <button
            key={k}
            onClick={() => setActiveKind(k)}
            className={cn(
              "rounded-full border px-3 py-1 text-xs font-medium",
              activeKind === k ? "border-accent bg-accent-soft text-accent" : "border-border text-muted hover:text-foreground"
            )}
          >
            {kindMeta[k].label}s ({counts[k] ?? 0})
          </button>
        ))}
      </div>

      {filtered.length === 0 ? (
        <EmptyState icon={StickyNote} title="Nothing matches" description="Try a different search term or filter." />
      ) : (
        <div className="divide-y divide-border-subtle rounded-xl border border-border bg-surface px-4">
          {filtered.slice(0, 60).map((item) => {
            const meta = kindMeta[item.kind];
            const Icon = meta.icon;
            return (
              <Link key={`${item.kind}-${item.id}`} href={item.href} className="flex items-start gap-3 py-3 hover:opacity-80">
                <Icon className={cn("mt-0.5 h-4 w-4 shrink-0", meta.color)} />
                <div className="min-w-0 flex-1">
                  <div className="flex items-center justify-between gap-2">
                    <p className="truncate text-sm font-medium">{item.title}</p>
                    <span className="shrink-0 text-xs text-muted">{timeAgo(item.timestamp)}</span>
                  </div>
                  <p className="line-clamp-1 text-xs text-muted-foreground">{item.detail}</p>
                </div>
                <Badge variant="secondary" className="shrink-0">{meta.label}</Badge>
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}
