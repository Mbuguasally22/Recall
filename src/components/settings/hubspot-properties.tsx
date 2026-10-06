"use client";

import * as React from "react";
import { Loader2, ListChecks } from "lucide-react";
import { Button } from "@/components/ui/button";

interface HubSpotProperty {
  name: string;
  label: string;
  groupName: string;
  type: string;
}

/**
 * Fetches HubSpot's custom contact properties on demand, so Sally can confirm
 * which internal name (what the API needs) matches each label she typed when
 * creating a custom field (what she sees in HubSpot) — see the "Recall +
 * HubSpot" design doc, open question #1.
 */
export function HubSpotProperties() {
  const [loading, setLoading] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [properties, setProperties] = React.useState<HubSpotProperty[] | null>(null);

  async function fetchProperties() {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/integrations/hubspot/properties");
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "Couldn't fetch HubSpot's property list.");
        return;
      }
      setProperties(data.properties);
    } catch {
      setError("Couldn't reach HubSpot — check your connection and try again.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="flex flex-col gap-2">
      <Button size="sm" variant="secondary" onClick={fetchProperties} disabled={loading}>
        {loading ? <Loader2 className="animate-spin" /> : <ListChecks />}
        {loading ? "Fetching…" : "Fetch custom field names"}
      </Button>
      {error && <p className="text-xs text-danger">{error}</p>}
      {properties && properties.length === 0 && (
        <p className="text-xs text-muted">No custom contact properties found on this HubSpot account yet.</p>
      )}
      {properties && properties.length > 0 && (
        <div className="overflow-hidden rounded-lg border border-border-subtle">
          <table className="w-full text-xs">
            <thead className="bg-black/[0.02] dark:bg-white/[0.03]">
              <tr>
                <th className="px-3 py-2 text-left font-medium">Label (what you see)</th>
                <th className="px-3 py-2 text-left font-medium">Internal name (what the API uses)</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border-subtle">
              {properties.map((p) => (
                <tr key={p.name}>
                  <td className="px-3 py-2">{p.label}</td>
                  <td className="px-3 py-2 font-mono">{p.name}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
