"use client";

import * as React from "react";
import Link from "next/link";
import { Search, Sparkles, Archive } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { EmptyState } from "@/components/ui/empty-state";
import { StickyNote } from "lucide-react";
import { cn, timeAgo } from "@/lib/utils";
import type { Note } from "@/lib/types";

export function NotesExplorer({ notes }: { notes: Note[] }) {
  const [query, setQuery] = React.useState("");
  const [showArchived, setShowArchived] = React.useState(false);

  const filtered = notes.filter((n) => {
    if (!showArchived && n.archived) return false;
    if (!query) return true;
    const q = query.toLowerCase();
    return (
      n.title.toLowerCase().includes(q) ||
      n.raw_content.toLowerCase().includes(q) ||
      (n.ai_summary ?? "").toLowerCase().includes(q) ||
      n.tags.some((t) => t.toLowerCase().includes(q))
    );
  });

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
        <div className="relative flex-1">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted" />
          <Input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search notes..." className="pl-9" />
        </div>
        <button
          onClick={() => setShowArchived((s) => !s)}
          className={cn(
            "flex h-9 items-center gap-1.5 rounded-lg border px-3 text-sm font-medium transition-colors",
            showArchived ? "border-accent bg-accent-soft text-accent" : "border-border text-muted hover:text-foreground"
          )}
        >
          <Archive className="h-3.5 w-3.5" /> Archived
        </button>
      </div>

      {filtered.length === 0 ? (
        <EmptyState icon={StickyNote} title="No notes found" description="Capture a thought from the home page to get started." />
      ) : (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          {filtered.map((n) => (
            <Link
              key={n.id}
              href={`/notes/${n.id}`}
              className="flex flex-col gap-2 rounded-xl border border-border bg-surface p-4 transition-colors hover:border-accent/30"
            >
              <div className="flex items-start justify-between gap-2">
                <p className="text-sm font-medium">{n.title}</p>
                <span className="shrink-0 text-xs text-muted">{timeAgo(n.created_at)}</span>
              </div>
              <p className="line-clamp-2 text-xs text-muted-foreground">{n.ai_summary ?? n.raw_content}</p>
              <div className="flex flex-wrap items-center gap-1.5">
                {n.ai_processed && (
                  <Badge variant="secondary" className="gap-0.5">
                    <Sparkles className="h-2.5 w-2.5" /> Processed
                  </Badge>
                )}
                {n.archived && <Badge variant="secondary">Archived</Badge>}
                {n.tags.slice(0, 3).map((t) => <Badge key={t} variant="outline">{t}</Badge>)}
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
