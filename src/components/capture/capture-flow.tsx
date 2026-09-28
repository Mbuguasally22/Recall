"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import {
  Mic,
  Type,
  Clipboard,
  Sparkles,
  Loader2,
  Check,
  X,
  Users,
  Building2,
  CalendarClock,
  ListTodo,
  Tag as TagIcon,
  AlertTriangle,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import type { ExtractionResult, Note } from "@/lib/types";

type Stage = "idle" | "processing" | "review" | "saved" | "error";

// Minimal typing for the Web Speech API so we can offer real dictation
// without inventing a fake transcription backend. Falls back gracefully
// when unsupported (most non-Chromium browsers).
interface SpeechRecognitionResultLike {
  isFinal: boolean;
  0: { transcript: string };
}
interface SpeechRecognitionEventLike {
  resultIndex: number;
  results: ArrayLike<SpeechRecognitionResultLike>;
}
interface SpeechRecognitionLike extends EventTarget {
  continuous: boolean;
  interimResults: boolean;
  lang: string;
  start: () => void;
  stop: () => void;
  onresult: ((ev: SpeechRecognitionEventLike) => void) | null;
  onend: (() => void) | null;
  onerror: (() => void) | null;
}

function getSpeechRecognition(): (new () => SpeechRecognitionLike) | null {
  if (typeof window === "undefined") return null;
  const w = window as unknown as {
    SpeechRecognition?: new () => SpeechRecognitionLike;
    webkitSpeechRecognition?: new () => SpeechRecognitionLike;
  };
  return w.SpeechRecognition ?? w.webkitSpeechRecognition ?? null;
}

export function CaptureFlow({
  compact = false,
  onSaved,
}: {
  compact?: boolean;
  onSaved?: (note: Note) => void;
}) {
  const router = useRouter();
  const [text, setText] = React.useState("");
  const [stage, setStage] = React.useState<Stage>("idle");
  const [extraction, setExtraction] = React.useState<ExtractionResult | null>(null);
  const [confirmedTasks, setConfirmedTasks] = React.useState<Set<string>>(new Set());
  const [errorMsg, setErrorMsg] = React.useState<{ title: string; detail: string } | null>(null);
  const [listening, setListening] = React.useState(false);
  const [savedNote, setSavedNote] = React.useState<Note | null>(null);
  const recognitionRef = React.useRef<SpeechRecognitionLike | null>(null);
  const speechSupported = React.useMemo(() => !!getSpeechRecognition(), []);

  function toggleDictate() {
    const Ctor = getSpeechRecognition();
    if (!Ctor) return;
    if (listening) {
      recognitionRef.current?.stop();
      setListening(false);
      return;
    }
    const rec = new Ctor();
    rec.continuous = true;
    rec.interimResults = true;
    rec.lang = "en-US";
    let base = text ? text + " " : "";
    rec.onresult = (ev) => {
      let interim = "";
      for (let i = ev.resultIndex; i < ev.results.length; i++) {
        const r = ev.results[i];
        if (r.isFinal) {
          base += r[0].transcript + " ";
        } else {
          interim += r[0].transcript;
        }
      }
      setText((base + interim).trim());
    };
    rec.onend = () => setListening(false);
    rec.onerror = () => setListening(false);
    recognitionRef.current = rec;
    rec.start();
    setListening(true);
  }

  async function handlePaste() {
    try {
      const clip = await navigator.clipboard.readText();
      if (clip) setText((t) => (t ? t + "\n" + clip : clip));
    } catch {
      // Clipboard permission denied — silently ignore, user can paste manually.
    }
  }

  async function processWithAI() {
    if (!text.trim()) return;
    setStage("processing");
    setErrorMsg(null);
    try {
      const res = await fetch("/api/capture/extract", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text }),
      });
      const data = await res.json();
      if (!res.ok) {
        setErrorMsg({
          title: data.error ?? "I couldn't process that note right now.",
          detail: data.detail ?? "Your original note has not been lost.",
        });
        setStage("error");
        return;
      }
      const result: ExtractionResult = data.extraction;
      setExtraction(result);
      setConfirmedTasks(new Set(result.tasks.map((t) => t.title)));
      setStage("review");
    } catch {
      setErrorMsg({
        title: "I couldn't process that note right now.",
        detail: "Your original note has not been lost — you can save it as-is or try again.",
      });
      setStage("error");
    }
  }

  async function saveNote(withExtraction: boolean) {
    const res = await fetch("/api/capture/save", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        raw_content: text,
        source_type: "text",
        extraction: withExtraction ? extraction : null,
        confirmed_task_titles: Array.from(confirmedTasks),
      }),
    });
    const data = await res.json();
    if (res.ok) {
      setSavedNote(data.note);
      setStage("saved");
      onSaved?.(data.note);
      router.refresh();
    }
  }

  function reset() {
    setText("");
    setStage("idle");
    setExtraction(null);
    setConfirmedTasks(new Set());
    setErrorMsg(null);
    setSavedNote(null);
  }

  function toggleTask(title: string) {
    setConfirmedTasks((prev) => {
      const next = new Set(prev);
      if (next.has(title)) next.delete(title);
      else next.add(title);
      return next;
    });
  }

  if (stage === "saved" && savedNote) {
    return (
      <div className="flex flex-col items-center gap-3 py-8 text-center animate-fade-in">
        <div className="flex h-11 w-11 items-center justify-center rounded-full bg-success-soft text-success">
          <Check className="h-5 w-5" />
        </div>
        <p className="text-sm font-medium">Saved to memory</p>
        <p className="max-w-xs text-sm text-muted">
          Your note is preserved, and structured records are linked back to it.
        </p>
        <div className="mt-2 flex gap-2">
          <Button size="sm" variant="secondary" onClick={reset}>
            Capture another thought
          </Button>
          <Button size="sm" variant="ghost" onClick={() => router.push(`/notes/${savedNote.id}`)}>
            View note
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      {stage !== "review" && (
        <>
          <Textarea
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder="Tell me what happened, what you're thinking, or what you need to remember..."
            className={cn("text-sm", compact ? "min-h-[110px]" : "min-h-[160px]")}
            disabled={stage === "processing"}
          />
          {stage === "error" && errorMsg && (
            <div className="flex items-start gap-2 rounded-lg border border-warning/30 bg-warning-soft px-3 py-2 text-xs text-warning">
              <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
              <div>
                <p className="font-medium">{errorMsg.title}</p>
                <p className="mt-0.5 opacity-90">{errorMsg.detail}</p>
              </div>
            </div>
          )}
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="flex flex-wrap gap-1.5">
              <Button type="button" size="sm" variant="secondary" onClick={handlePaste}>
                <Clipboard /> Paste
              </Button>
              <Button
                type="button"
                size="sm"
                variant={listening ? "default" : "secondary"}
                onClick={toggleDictate}
                disabled={!speechSupported}
                title={speechSupported ? undefined : "Voice dictation isn't supported in this browser"}
              >
                <Mic /> {listening ? "Listening…" : "Dictate"}
              </Button>
              <Button type="button" size="sm" variant="secondary" onClick={() => document.getElementById("capture-textarea-focus-noop")}>
                <Type /> Type
              </Button>
            </div>
            <div className="flex gap-2">
              {stage === "error" && (
                <Button size="sm" variant="secondary" onClick={() => saveNote(false)}>
                  Save as-is
                </Button>
              )}
              <Button size="sm" onClick={processWithAI} disabled={!text.trim() || stage === "processing"}>
                {stage === "processing" ? <Loader2 className="animate-spin" /> : <Sparkles />}
                {stage === "processing" ? "Processing…" : "Process with AI"}
              </Button>
            </div>
          </div>
        </>
      )}

      {stage === "review" && extraction && (
        <div className="flex flex-col gap-4 animate-fade-in">
          <div className="rounded-lg border border-border-subtle bg-black/[0.015] p-3 dark:bg-white/[0.02]">
            <p className="text-xs font-medium text-muted">Your original note (never modified)</p>
            <p className="mt-1 whitespace-pre-wrap text-sm">{text}</p>
          </div>

          {extraction.summary && (
            <p className="text-sm text-muted-foreground">{extraction.summary}</p>
          )}

          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
            <ExtractionGroup icon={Users} label="People">
              {extraction.people.length === 0 ? (
                <EmptyBit />
              ) : (
                extraction.people.map((p) => (
                  <Badge key={p.name} variant={p.is_new ? "default" : "secondary"}>
                    {p.name}
                    {p.is_new ? " · new" : ""}
                  </Badge>
                ))
              )}
            </ExtractionGroup>
            <ExtractionGroup icon={Building2} label="Companies">
              {extraction.companies.length === 0 ? (
                <EmptyBit />
              ) : (
                extraction.companies.map((c) => <Badge key={c} variant="secondary">{c}</Badge>)
              )}
            </ExtractionGroup>
            <ExtractionGroup icon={CalendarClock} label="Dates mentioned">
              {extraction.dates.length === 0 ? (
                <EmptyBit />
              ) : (
                extraction.dates.map((d) => <Badge key={d} variant="secondary">{d}</Badge>)
              )}
            </ExtractionGroup>
            <ExtractionGroup icon={TagIcon} label="Tags">
              {extraction.tags.length === 0 ? (
                <EmptyBit />
              ) : (
                extraction.tags.map((t) => <Badge key={t} variant="outline">{t}</Badge>)
              )}
            </ExtractionGroup>
          </div>

          {extraction.relationships.length > 0 && (
            <div>
              <p className="mb-1.5 text-xs font-medium text-muted">Relationships</p>
              <ul className="space-y-1 text-sm">
                {extraction.relationships.map((r, i) => (
                  <li key={i} className="text-muted-foreground">
                    <span className="font-medium text-foreground">{r.from}</span> → {r.description} →{" "}
                    <span className="font-medium text-foreground">{r.to}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {extraction.tasks.length > 0 && (
            <div>
              <p className="mb-1.5 flex items-center gap-1.5 text-xs font-medium text-muted">
                <ListTodo className="h-3.5 w-3.5" /> Suggested tasks — confirm before saving
              </p>
              <div className="space-y-1.5">
                {extraction.tasks.map((t) => (
                  <label
                    key={t.title}
                    className="flex cursor-pointer items-start gap-2 rounded-lg border border-border px-3 py-2 text-sm hover:bg-black/[0.02] dark:hover:bg-white/[0.03]"
                  >
                    <input
                      type="checkbox"
                      className="mt-0.5"
                      checked={confirmedTasks.has(t.title)}
                      onChange={() => toggleTask(t.title)}
                    />
                    <span>
                      {t.title}
                      {t.due_hint && <span className="ml-1.5 text-xs text-muted">· {t.due_hint}</span>}
                    </span>
                  </label>
                ))}
              </div>
            </div>
          )}

          {extraction.suggested_actions.length > 0 && (
            <div>
              <p className="mb-1.5 text-xs font-medium text-muted">AI suggestions (not saved automatically)</p>
              <ul className="space-y-1 text-sm text-muted-foreground">
                {extraction.suggested_actions.map((a, i) => (
                  <li key={i}>· {a}</li>
                ))}
              </ul>
            </div>
          )}

          <div className="flex flex-wrap justify-end gap-2 border-t border-border-subtle pt-3">
            <Button size="sm" variant="ghost" onClick={reset}>
              <X /> Discard
            </Button>
            <Button size="sm" variant="secondary" onClick={() => setStage("idle")}>
              Edit note
            </Button>
            <Button size="sm" onClick={() => saveNote(true)}>
              <Check /> Save everything
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}

function ExtractionGroup({
  icon: Icon,
  label,
  children,
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div>
      <p className="mb-1.5 flex items-center gap-1.5 text-xs font-medium text-muted">
        <Icon className="h-3.5 w-3.5" /> {label}
      </p>
      <div className="flex flex-wrap gap-1.5">{children}</div>
    </div>
  );
}

function EmptyBit() {
  return <span className="text-xs text-muted">—</span>;
}
