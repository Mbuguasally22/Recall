"use client";

import * as React from "react";
import { Sparkles, Loader2, Check, AlertTriangle, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { RELATIONSHIP_AREAS } from "@/lib/relationship-area";
import type { RelationshipArea } from "@/lib/types";

/**
 * Lets Stephanie tag which side of her work a contact belongs to, right on
 * their profile. Click a pill to set it (click it again to clear), or hit
 * Suggest and let the AI read what's already on file and propose one —
 * handy for clearing a backlog of untagged contacts fast.
 */
export function RelationshipAreaEditor({
  personId,
  initialArea,
}: {
  personId: string;
  initialArea: RelationshipArea | null;
}) {
  const [area, setArea] = React.useState<RelationshipArea | null>(initialArea);
  const [saving, setSaving] = React.useState(false);
  const [justSaved, setJustSaved] = React.useState(false);
  const [suggesting, setSuggesting] = React.useState(false);
  const [suggestion, setSuggestion] = React.useState<{ area: RelationshipArea; reason: string } | null>(null);
  const [error, setError] = React.useState<string | null>(null);

  async function save(next: RelationshipArea | null) {
    const previous = area;
    setArea(next); // optimistic
    setSaving(true);
    setError(null);
    try {
      const res = await fetch(`/api/people/${personId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ relationship_area: next }),
      });
      if (!res.ok) throw new Error();
      setJustSaved(true);
      setTimeout(() => setJustSaved(false), 1500);
    } catch {
      setArea(previous); // roll back
      setError("Couldn't save that, try again.");
    } finally {
      setSaving(false);
    }
  }

  function handlePillClick(a: RelationshipArea) {
    save(area === a ? null : a);
  }

  async function suggest() {
    setSuggesting(true);
    setSuggestion(null);
    setError(null);
    try {
      const res = await fetch(`/api/people/${personId}/suggest-area`, { method: "POST" });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "Couldn't suggest one right now.");
        return;
      }
      setSuggestion(data);
    } catch {
      setError("Couldn't suggest one right now.");
    } finally {
      setSuggesting(false);
    }
  }

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap items-center gap-1.5">
        {RELATIONSHIP_AREAS.map((a) => (
          <button
            key={a}
            type="button"
            onClick={() => handlePillClick(a)}
            disabled={saving}
            className={cn(
              "rounded-full border px-3 py-1 text-xs font-medium transition-colors disabled:opacity-60",
              area === a ? "border-accent bg-accent-soft text-accent" : "border-border text-muted hover:text-foreground"
            )}
          >
            {a}
          </button>
        ))}
        {saving && <Loader2 className="h-3.5 w-3.5 animate-spin text-muted" />}
        {!saving && justSaved && <Check className="h-3.5 w-3.5 text-success" />}
        <Button size="sm" variant="ghost" onClick={suggest} disabled={suggesting} className="ml-auto">
          {suggesting ? <Loader2 className="animate-spin" /> : <Sparkles />} Suggest
        </Button>
      </div>

      {suggestion && (
        <div className="flex items-start gap-2 rounded-lg border border-accent/30 bg-accent-soft/60 px-3 py-2 text-xs animate-fade-in">
          <Sparkles className="mt-0.5 h-3.5 w-3.5 shrink-0 text-accent" />
          <div className="flex-1">
            <p>
              Suggested <span className="font-semibold text-accent">{suggestion.area}</span> — {suggestion.reason}
            </p>
          </div>
          {suggestion.area !== area && (
            <Button
              size="sm"
              variant="secondary"
              className="h-6 px-2 text-[11px]"
              onClick={() => {
                save(suggestion.area);
                setSuggestion(null);
              }}
            >
              Use this
            </Button>
          )}
          <button onClick={() => setSuggestion(null)} className="text-muted hover:text-foreground">
            <X className="h-3.5 w-3.5" />
          </button>
        </div>
      )}

      {error && (
        <div className="flex items-center gap-2 rounded-lg border border-warning/30 bg-warning-soft px-3 py-2 text-xs text-warning animate-fade-in">
          <AlertTriangle className="h-3.5 w-3.5 shrink-0" />
          {error}
        </div>
      )}
    </div>
  );
}
