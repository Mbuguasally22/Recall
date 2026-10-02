"use client";

import * as React from "react";
import { Upload, Loader2, Check, Trash2, ImageIcon, Palette, Download, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import type { Colorway } from "@/lib/types";

export interface ColorwayWithUrl {
  colorway: Colorway;
  photoUrl: string | null;
}

export function ColorsExplorer({ initialColorways }: { initialColorways: ColorwayWithUrl[] }) {
  const [items, setItems] = React.useState<ColorwayWithUrl[]>(initialColorways);
  const [uploading, setUploading] = React.useState(false);
  const [uploadNotes, setUploadNotes] = React.useState<string[]>([]);
  const [selectedIds, setSelectedIds] = React.useState<Set<string>>(new Set());
  const [tearsheetUrl, setTearsheetUrl] = React.useState<string | null>(null);
  const [buildingTearsheet, setBuildingTearsheet] = React.useState(false);
  const fileInputRef = React.useRef<HTMLInputElement>(null);

  async function uploadFile(file: File) {
    setUploading(true);
    setUploadNotes([]);
    try {
      const form = new FormData();
      form.append("photo", file);
      const res = await fetch("/api/colors/upload", { method: "POST", body: form });
      const data = await res.json();
      if (!res.ok) {
        setUploadNotes([data.error ?? "Couldn't upload that photo."]);
        return;
      }
      setItems((prev) => [
        { colorway: data.colorway, photoUrl: data.cutout_photo_url ?? data.original_photo_url },
        ...prev,
      ]);
      if (data.notes?.length) setUploadNotes(data.notes);
    } catch {
      setUploadNotes(["Couldn't upload that photo — check your connection and try again."]);
    } finally {
      setUploading(false);
    }
  }

  function handleFileSelect(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (file) void uploadFile(file);
    e.target.value = "";
  }

  function handleDropzonePaste(e: React.ClipboardEvent<HTMLDivElement>) {
    const clipboardItems = e.clipboardData?.items;
    if (!clipboardItems) return;
    for (let i = 0; i < clipboardItems.length; i++) {
      const item = clipboardItems[i];
      if (item.type.startsWith("image/")) {
        e.preventDefault();
        const file = item.getAsFile();
        if (file) void uploadFile(file);
        return;
      }
    }
  }

  async function saveName(id: string, name: string) {
    if (!name.trim()) return;
    const res = await fetch(`/api/colors/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name }),
    });
    if (!res.ok) return;
    const data = await res.json();
    setItems((prev) => prev.map((it) => (it.colorway.id === id ? { ...it, colorway: data.colorway } : it)));
  }

  async function deleteColorway(id: string) {
    const res = await fetch(`/api/colors/${id}`, { method: "DELETE" });
    if (!res.ok) return;
    setItems((prev) => prev.filter((it) => it.colorway.id !== id));
    setSelectedIds((prev) => {
      const next = new Set(prev);
      next.delete(id);
      return next;
    });
  }

  function toggleSelected(id: string) {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  async function generateTearsheet() {
    if (selectedIds.size === 0) return;
    setBuildingTearsheet(true);
    setTearsheetUrl(null);
    try {
      const res = await fetch("/api/colors/tearsheet", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ colorway_ids: [...selectedIds] }),
      });
      if (!res.ok) return;
      const blob = await res.blob();
      setTearsheetUrl(URL.createObjectURL(blob));
    } finally {
      setBuildingTearsheet(false);
    }
  }

  const namedCount = items.filter((it) => it.colorway.name).length;

  return (
    <div className="flex flex-col gap-6">
      <div
        onPaste={handleDropzonePaste}
        tabIndex={0}
        className="flex flex-col items-center justify-center gap-3 rounded-xl border border-dashed border-border px-6 py-10 text-center focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/30"
      >
        <div className="flex h-10 w-10 items-center justify-center rounded-full bg-accent-soft text-accent">
          {uploading ? <Loader2 className="h-5 w-5 animate-spin" /> : <ImageIcon className="h-5 w-5" />}
        </div>
        <p className="text-sm font-medium">{uploading ? "Processing photo…" : "Add a new colorway photo"}</p>
        <p className="max-w-sm text-sm text-muted">
          Choose a photo, or click here and paste one (Ctrl+V) straight from your clipboard.
        </p>
        <Button size="sm" variant="secondary" onClick={() => fileInputRef.current?.click()} disabled={uploading}>
          <Upload /> Choose photo
        </Button>
        <input ref={fileInputRef} type="file" accept="image/*" className="hidden" onChange={handleFileSelect} />
      </div>

      {uploadNotes.length > 0 && (
        <div className="rounded-lg border border-warning/30 bg-warning-soft px-3 py-2 text-xs text-warning">
          {uploadNotes.map((n, i) => (
            <p key={i}>{n}</p>
          ))}
        </div>
      )}

      {namedCount > 0 && (
        <div className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-border-subtle bg-black/[0.015] px-4 py-3 dark:bg-white/[0.02]">
          <p className="text-sm text-muted">
            {selectedIds.size === 0
              ? "Pick named colorways below to build a batch tearsheet."
              : `${selectedIds.size} selected`}
          </p>
          <Button size="sm" onClick={generateTearsheet} disabled={selectedIds.size === 0 || buildingTearsheet}>
            {buildingTearsheet ? <Loader2 className="animate-spin" /> : <Palette />}
            {buildingTearsheet ? "Building…" : "Generate tearsheet"}
          </Button>
        </div>
      )}

      {tearsheetUrl && (
        <div className="flex flex-col items-center gap-3 rounded-lg border border-border-subtle p-4">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={tearsheetUrl} alt="Colorway tearsheet" className="max-w-full rounded-md border border-border" />
          <div className="flex gap-2">
            <a href={tearsheetUrl} download="bumby-colorway-tearsheet.png">
              <Button size="sm" variant="secondary">
                <Download /> Download
              </Button>
            </a>
            <Button size="sm" variant="ghost" onClick={() => setTearsheetUrl(null)}>
              <X /> Close
            </Button>
          </div>
        </div>
      )}

      {items.length === 0 ? (
        <EmptyState
          icon={Palette}
          title="No colorways yet"
          description="Upload your first photo above to get started."
        />
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {items.map((item) => (
            <ColorwayCard
              key={item.colorway.id}
              item={item}
              selected={selectedIds.has(item.colorway.id)}
              onToggleSelect={() => toggleSelected(item.colorway.id)}
              onSaveName={(name) => saveName(item.colorway.id, name)}
              onDelete={() => deleteColorway(item.colorway.id)}
            />
          ))}
        </div>
      )}
    </div>
  );
}

function ColorwayCard({
  item,
  selected,
  onToggleSelect,
  onSaveName,
  onDelete,
}: {
  item: ColorwayWithUrl;
  selected: boolean;
  onToggleSelect: () => void;
  onSaveName: (name: string) => void;
  onDelete: () => void;
}) {
  const { colorway, photoUrl } = item;
  const [customName, setCustomName] = React.useState("");
  const [saving, setSaving] = React.useState(false);

  async function handleSave(name: string) {
    setSaving(true);
    try {
      await onSaveName(name);
    } finally {
      setSaving(false);
    }
  }

  return (
    <Card className="overflow-hidden">
      <div className="relative flex aspect-square items-center justify-center bg-black/[0.03] dark:bg-white/[0.04]">
        {photoUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={photoUrl} alt={colorway.name ?? "Unnamed colorway"} className="h-full w-full object-contain" />
        ) : (
          <span className="text-xs text-muted">No preview</span>
        )}
        {colorway.name && (
          <button
            type="button"
            onClick={onToggleSelect}
            title="Select for tearsheet"
            className={`absolute left-2 top-2 flex h-6 w-6 items-center justify-center rounded-full border ${
              selected ? "border-accent bg-accent text-accent-foreground" : "border-border bg-surface/80"
            }`}
          >
            {selected && <Check className="h-3.5 w-3.5" />}
          </button>
        )}
        <button
          type="button"
          onClick={onDelete}
          title="Delete"
          className="absolute right-2 top-2 flex h-6 w-6 items-center justify-center rounded-full border border-border bg-surface/80 text-muted hover:text-danger"
        >
          <Trash2 className="h-3.5 w-3.5" />
        </button>
      </div>
      <CardContent className="flex flex-col gap-3 pt-4">
        {colorway.hex_codes.length > 0 && (
          <div className="flex flex-wrap items-center gap-1.5">
            {colorway.hex_codes.map((hex) => (
              <span
                key={hex}
                className="flex items-center gap-1 rounded-md border border-border px-1.5 py-0.5 text-[11px] text-muted"
              >
                <span className="h-3 w-3 rounded-sm border border-border" style={{ backgroundColor: hex }} />
                {hex}
              </span>
            ))}
          </div>
        )}

        {colorway.name ? (
          <p className="text-sm font-semibold">{colorway.name}</p>
        ) : (
          <div className="flex flex-col gap-2">
            {colorway.ai_name_suggestions.length > 0 && (
              <div className="flex flex-wrap gap-1.5">
                {colorway.ai_name_suggestions.map((suggestion) => (
                  <button
                    key={suggestion}
                    type="button"
                    disabled={saving}
                    onClick={() => handleSave(suggestion)}
                    className="rounded-md border border-border px-2 py-1 text-xs hover:border-accent hover:text-accent disabled:opacity-50"
                  >
                    {suggestion}
                  </button>
                ))}
              </div>
            )}
            <div className="flex gap-1.5">
              <Input
                value={customName}
                onChange={(e) => setCustomName(e.target.value)}
                placeholder="Or type your own name"
                className="h-8 text-xs"
              />
              <Button size="sm" disabled={saving || !customName.trim()} onClick={() => handleSave(customName)}>
                Save
              </Button>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
