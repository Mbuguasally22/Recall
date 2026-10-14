"use client";

import * as React from "react";
import { Loader2, Check, Settings2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

const FIELD_LABELS: Record<string, string> = {
  relationship_area: "Relationship area",
  relationship_type: "Relationship type",
  weconnect_status: "WEConnect status",
  priority_next_step: "Priority next step",
};

/**
 * Lets Sally correct Recall's guess at each custom field's HubSpot internal
 * name (see hubspot-properties.tsx's "Fetch custom field names" table for
 * what her account actually generated) without a code change. Saved
 * mapping is used by the Networking capture workflow when syncing a
 * contact's relationship fields to HubSpot.
 */
export function HubSpotFieldMap() {
  const [map, setMap] = React.useState<Record<string, string> | null>(null);
  const [loading, setLoading] = React.useState(true);
  const [saving, setSaving] = React.useState(false);
  const [saved, setSaved] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  React.useEffect(() => {
    fetch("/api/integrations/hubspot/field-map")
      .then((res) => res.json())
      .then((data) => setMap(data.field_map ?? {}))
      .catch(() => setError("Couldn't load the saved field mapping."))
      .finally(() => setLoading(false));
  }, []);

  async function save() {
    if (!map) return;
    setSaving(true);
    setSaved(false);
    setError(null);
    try {
      const res = await fetch("/api/integrations/hubspot/field-map", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ field_map: map }),
      });
      if (!res.ok) {
        const data = await res.json();
        setError(data.error ?? "Couldn't save that mapping.");
        return;
      }
      setSaved(true);
    } catch {
      setError("Couldn't reach the server — try again.");
    } finally {
      setSaving(false);
    }
  }

  if (loading) return <Loader2 className="h-4 w-4 animate-spin text-muted" />;
  if (!map) return null;

  return (
    <div className="flex flex-col gap-2 rounded-lg border border-border-subtle p-3">
      <p className="flex items-center gap-1.5 text-xs font-medium"><Settings2 className="h-3.5 w-3.5" /> Custom field mapping</p>
      <p className="text-xs text-muted">
        Internal name HubSpot uses for each field — defaults are a best guess; correct any that differ using the
        table above.
      </p>
      {Object.keys(FIELD_LABELS).map((key) => (
        <div key={key} className="flex items-center gap-2">
          <span className="w-40 shrink-0 text-xs text-muted">{FIELD_LABELS[key]}</span>
          <Input
            value={map[key] ?? ""}
            onChange={(e) => setMap((m) => ({ ...(m ?? {}), [key]: e.target.value }))}
            className="h-8 flex-1 font-mono text-xs"
          />
        </div>
      ))}
      <div className="flex items-center gap-2 pt-1">
        <Button type="button" size="sm" variant="secondary" onClick={save} disabled={saving}>
          {saving ? <Loader2 className="animate-spin" /> : saved ? <Check /> : null}
          {saving ? "Saving…" : saved ? "Saved" : "Save mapping"}
        </Button>
        {error && <span className="text-xs text-danger">{error}</span>}
      </div>
    </div>
  );
}
