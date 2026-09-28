"use client";

import * as React from "react";
import { Search } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { EmptyState } from "@/components/ui/empty-state";
import { PersonRow } from "@/components/shared/person-row";
import { Users2 } from "lucide-react";
import { cn } from "@/lib/utils";
import type { Company, Person } from "@/lib/types";

type FilterKind = "all" | "follow_up" | "recent";

// Computed once at module load (not during render) so filtering stays a
// pure function of props/state, as required by the React Compiler's
// purity rules. A few hours of staleness is irrelevant for a "within the
// last 7 days" filter.
const NOW_MS = Date.now();

export function PeopleExplorer({
  people,
  companies,
}: {
  people: Person[];
  companies: Company[];
}) {
  const [query, setQuery] = React.useState("");
  const [companyId, setCompanyId] = React.useState<string | null>(null);
  const [tag, setTag] = React.useState<string | null>(null);
  const [filter, setFilter] = React.useState<FilterKind>("all");

  const allTags = React.useMemo(() => {
    const set = new Set<string>();
    people.forEach((p) => p.tags.forEach((t) => set.add(t)));
    return Array.from(set).slice(0, 12);
  }, [people]);

  const companyById = React.useMemo(() => new Map(companies.map((c) => [c.id, c])), [companies]);

  const filtered = people.filter((p) => {
    if (query) {
      const q = query.toLowerCase();
      const hay = [p.name, p.location, p.industry, ...p.tags].filter(Boolean).join(" ").toLowerCase();
      if (!hay.includes(q)) return false;
    }
    if (companyId && p.company_id !== companyId) return false;
    if (tag && !p.tags.includes(tag)) return false;
    if (filter === "follow_up" && !(p.next_follow_up_at && new Date(p.next_follow_up_at).getTime() <= NOW_MS)) return false;
    if (filter === "recent") {
      if (!p.last_interaction_at) return false;
      const days = (NOW_MS - new Date(p.last_interaction_at).getTime()) / 86400000;
      if (days > 7) return false;
    }
    return true;
  });

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
        <div className="relative flex-1">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted" />
          <Input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search people..."
            className="pl-9"
          />
        </div>
        <select
          value={companyId ?? ""}
          onChange={(e) => setCompanyId(e.target.value || null)}
          className="h-9 rounded-lg border border-border bg-surface px-3 text-sm"
        >
          <option value="">All companies</option>
          {companies.map((c) => (
            <option key={c.id} value={c.id}>{c.name}</option>
          ))}
        </select>
      </div>

      <div className="flex flex-wrap gap-1.5">
        {(
          [
            ["all", "All"],
            ["follow_up", "Follow-up needed"],
            ["recent", "Recently contacted"],
          ] as [FilterKind, string][]
        ).map(([key, label]) => (
          <button
            key={key}
            onClick={() => setFilter(key)}
            className={cn(
              "rounded-full border px-3 py-1 text-xs font-medium transition-colors",
              filter === key ? "border-accent bg-accent-soft text-accent" : "border-border text-muted hover:text-foreground"
            )}
          >
            {label}
          </button>
        ))}
        <span className="mx-1 self-center text-border">|</span>
        {allTags.map((t) => (
          <button key={t} onClick={() => setTag(tag === t ? null : t)}>
            <Badge variant={tag === t ? "default" : "secondary"}>{t}</Badge>
          </button>
        ))}
      </div>

      {filtered.length === 0 ? (
        <EmptyState icon={Users2} title="No one matches those filters" description="Try clearing a filter or searching a different term." />
      ) : (
        <div className="divide-y divide-border-subtle rounded-xl border border-border bg-surface px-4">
          {filtered.map((p) => (
            <PersonRow key={p.id} person={p} company={p.company_id ? companyById.get(p.company_id) : null} />
          ))}
        </div>
      )}
    </div>
  );
}
