"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Trophy, XCircle, Lightbulb, Plus, Loader2 } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { EmptyState } from "@/components/ui/empty-state";
import { formatDate } from "@/lib/utils";
import type { Reflection, ReflectionType } from "@/lib/types";

const config: Record<ReflectionType, { label: string; icon: typeof Trophy; color: string }> = {
  success: { label: "Success", icon: Trophy, color: "text-success" },
  failure: { label: "Failure", icon: XCircle, color: "text-danger" },
  lesson: { label: "Lesson", icon: Lightbulb, color: "text-accent" },
};

function ReflectionCard({ r }: { r: Reflection }) {
  const c = config[r.type];
  const Icon = c.icon;
  return (
    <Card>
      <CardContent className="flex items-start gap-3 pt-5">
        <Icon className={`mt-0.5 h-4 w-4 shrink-0 ${c.color}`} />
        <div>
          <p className="text-sm">{r.content}</p>
          <p className="mt-1 text-xs text-muted">{formatDate(r.created_at)}</p>
        </div>
      </CardContent>
    </Card>
  );
}

function AddReflectionForm({ type, onDone }: { type: ReflectionType; onDone: () => void }) {
  const router = useRouter();
  const [content, setContent] = React.useState("");
  const [saving, setSaving] = React.useState(false);

  async function submit() {
    if (!content.trim()) return;
    setSaving(true);
    await fetch("/api/reflections", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ type, content }),
    });
    setSaving(false);
    setContent("");
    onDone();
    router.refresh();
  }

  return (
    <div className="flex flex-col gap-2 rounded-lg border border-border p-3">
      <Textarea value={content} onChange={(e) => setContent(e.target.value)} placeholder={`What ${config[type].label.toLowerCase()} do you want to record?`} className="min-h-[70px]" autoFocus />
      <div className="flex justify-end">
        <Button size="sm" onClick={submit} disabled={saving}>
          {saving ? <Loader2 className="animate-spin" /> : "Save"}
        </Button>
      </div>
    </div>
  );
}

export function ReflectionsView({ reflections }: { reflections: Reflection[] }) {
  const [adding, setAdding] = React.useState<ReflectionType | null>(null);

  const groups: Record<ReflectionType, Reflection[]> = {
    success: reflections.filter((r) => r.type === "success"),
    failure: reflections.filter((r) => r.type === "failure"),
    lesson: reflections.filter((r) => r.type === "lesson"),
  };

  return (
    <Tabs defaultValue="all">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
        <TabsList>
          <TabsTrigger value="all">All ({reflections.length})</TabsTrigger>
          <TabsTrigger value="success">Successes ({groups.success.length})</TabsTrigger>
          <TabsTrigger value="failure">Failures ({groups.failure.length})</TabsTrigger>
          <TabsTrigger value="lesson">Lessons ({groups.lesson.length})</TabsTrigger>
        </TabsList>
        <div className="flex gap-1.5">
          {(Object.keys(config) as ReflectionType[]).map((t) => (
            <Button key={t} size="sm" variant="ghost" onClick={() => setAdding(adding === t ? null : t)}>
              <Plus /> {config[t].label}
            </Button>
          ))}
        </div>
      </div>

      {adding && (
        <div className="mb-4">
          <AddReflectionForm type={adding} onDone={() => setAdding(null)} />
        </div>
      )}

      {(["all", "success", "failure", "lesson"] as const).map((key) => {
        const list = key === "all" ? reflections : groups[key];
        return (
          <TabsContent key={key} value={key}>
            {list.length === 0 ? (
              <EmptyState icon={Lightbulb} title="Nothing recorded yet" />
            ) : (
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                {list.map((r) => <ReflectionCard key={r.id} r={r} />)}
              </div>
            )}
          </TabsContent>
        );
      })}
    </Tabs>
  );
}
