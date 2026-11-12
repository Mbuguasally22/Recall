"use client";

import { cn } from "@/lib/utils";
import { RELATIONSHIP_AREAS } from "@/lib/relationship-area";
import type { RelationshipArea } from "@/lib/types";

/**
 * Pill-row filter for "which hat does this belong to" — reused across
 * People, Tasks and Notes so Bumby/WEConnect/Both/Other filtering looks and
 * behaves the same everywhere. Only renders pills for areas actually present
 * in the current data, so an account with no networking contacts yet
 * doesn't show four dead buttons.
 */
export function RelationshipAreaFilter({
  value,
  onChange,
  available,
}: {
  value: RelationshipArea | "all";
  onChange: (value: RelationshipArea | "all") => void;
  available: RelationshipArea[];
}) {
  if (available.length === 0) return null;

  const ordered = RELATIONSHIP_AREAS.filter((a) => available.includes(a));
  const options: (RelationshipArea | "all")[] = ["all", ...ordered];

  return (
    <div className="flex flex-wrap gap-1.5">
      {options.map((opt) => (
        <button
          key={opt}
          type="button"
          onClick={() => onChange(opt)}
          className={cn(
            "rounded-full border px-3 py-1 text-xs font-medium transition-colors",
            value === opt ? "border-accent bg-accent-soft text-accent" : "border-border text-muted hover:text-foreground"
          )}
        >
          {opt === "all" ? "All areas" : opt}
        </button>
      ))}
    </div>
  );
}
