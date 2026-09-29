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
  Users,
  Building2,
  ListTodo,
  AlertTriangle,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import type { ExtractionResult, Note } from "@/lib/types";

type Stage = "idle" | "processing" | "saved" | "error";

function blobToBase64(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => {
      const result = reader.result as string; // "data:image/png;base64,AAAA..."
      resolve(result.split(",")[1] ?? "");
    };
    reader.onerror = reject;
    reader.readAsDataURL(blob);
  });
}

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
  const [taskCount, setTaskCount] = React.useState(0);
  const [errorMsg, setErrorMsg] = React.useState<{ title: string; detail: string } | null>(null);
  const [aiNote, setAiNote] = React.useState<string | null>(null);
  const [listening, setListening] = React.useState(false);
  const [savedNote, setSavedNote] = React.useState<Note | null>(null);
  const [readingImage, setReadingImage] = React.useState(false);
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

  // Reads whatever's on the clipboard. An image (e.g. a screenshot,
  // Ctrl+V'd straight in) gets sent to Claude to transcribe/describe, and
  // that text is inserted just like pasted text would be — plain text is
  // still the fast path and is tried first where supported.
  async function handlePaste() {
    setErrorMsg(null);
    try {
      if (navigator.clipboard.read) {
        const items = await navigator.clipboard.read();
        for (const item of items) {
          const imageType = item.types.find((t) => t.startsWith("image/"));
          if (imageType) {
            const blob = await item.getType(imageType);
            await handleImagePaste(blob, imageType);
            return;
          }
        }
      }
    } catch {
      // navigator.clipboard.read() unsupported, or only text permission was
      // granted — fall through to plain text paste below.
    }
    try {
      const clip = await navigator.clipboard.readText();
      if (clip) setText((t) => (t ? t + "\n" + clip : clip));
    } catch {
      // Clipboard permission denied — silently ignore, user can paste manually (Ctrl+V still works natively on the textarea).
    }
  }

  async function handleImagePaste(blob: Blob, mediaType: string) {
    setReadingImage(true);
    try {
      const base64 = await blobToBase64(blob);
      const res = await fetch("/api/capture/paste-image", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ image_base64: base64, media_type: mediaType }),
      });
      const data = await res.json();
      if (!res.ok) {
        setErrorMsg({
          title: data.error ?? "Couldn't read that image.",
          detail: data.detail ?? "Try again, or type/paste the text instead.",
        });
        return;
      }
      setText((t) => (t ? t + "\n" + data.text : data.text));
    } catch {
      setErrorMsg({ title: "Couldn't read that image.", detail: "Try again, or type/paste the text instead." });
    } finally {
      setReadingImage(false);
    }
  }

  // One action: process with AI and save immediately — no manual review
  // step. Every extracted task is confirmed automatically (people/companies
  // it mentions were already being created without a per-item confirmation;
  // now tasks work the same way). If AI processing fails for any reason,
  // the raw note is still saved as-is so nothing is ever lost, and a small
  // note says AI didn't run this time rather than blocking the capture.
  async function captureNote() {
    if (!text.trim()) return;
    setStage("processing");
    setErrorMsg(null);
    setAiNote(null);

    let result: ExtractionResult | null = null;
    try {
      const res = await fetch("/api/capture/extract", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text }),
      });
      const data = await res.json();
      if (res.ok) {
        result = data.extraction as ExtractionResult;
      } else {
        setAiNote(data.error ?? "AI processing wasn't available this time — saved as-is.");
      }
    } catch {
      setAiNote("AI processing wasn't available this time — saved as-is.");
    }

    const taskTitles = result?.tasks.map((t) => t.title) ?? [];
    setExtraction(result);
    setTaskCount(taskTitles.length);

    try {
      const res = await fetch("/api/capture/save", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          raw_content: text,
          source_type: "text",
          extraction: result,
          confirmed_task_titles: taskTitles,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setErrorMsg({ title: data.error ?? "Couldn't save that note.", detail: data.detail ?? "Your text is still in the box — try again." });
        setStage("error");
        return;
      }
      setSavedNote(data.note);
      setStage("saved");
      onSaved?.(data.note);
      router.refresh();
    } catch {
      setErrorMsg({ title: "Couldn't save that note.", detail: "Your text is still in the box — try again." });
      setStage("error");
    }
  }

  async function saveAsIs() {
    if (!text.trim()) return;
    setStage("processing");
    setErrorMsg(null);
    try {
      const res = await fetch("/api/capture/save", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ raw_content: text, source_type: "text", extraction: null, confirmed_task_titles: [] }),
      });
      const data = await res.json();
      if (!res.ok) {
        setErrorMsg({ title: data.error ?? "Couldn't save that note.", detail: data.detail ?? "Try again." });
        setStage("error");
        return;
      }
      setExtraction(null);
      setTaskCount(0);
      setSavedNote(data.note);
      setStage("saved");
      onSaved?.(data.note);
      router.refresh();
    } catch {
      setErrorMsg({ title: "Couldn't save that note.", detail: "Try again." });
      setStage("error");
    }
  }

  function reset() {
    setText("");
    setStage("idle");
    setExtraction(null);
    setTaskCount(0);
    setErrorMsg(null);
    setAiNote(null);
    setSavedNote(null);
  }

  if (stage === "saved" && savedNote) {
    const peopleCount = extraction?.people.length ?? 0;
    const companyCount = extraction?.companies.length ?? 0;
    const hasSummary = peopleCount > 0 || companyCount > 0 || taskCount > 0;

    return (
      <div className="flex flex-col items-center gap-3 py-8 text-center animate-fade-in">
        <div className="flex h-11 w-11 items-center justify-center rounded-full bg-success-soft text-success">
          <Check className="h-5 w-5" />
        </div>
        <p className="text-sm font-medium">Saved to memory</p>
        <p className="max-w-xs text-sm text-muted">
          {hasSummary
            ? "Captured and filed automatically:"
            : "Your note is preserved as-is."}
        </p>
        {hasSummary && (
          <div className="flex flex-wrap items-center justify-center gap-1.5">
            {peopleCount > 0 && (
              <Badge variant="secondary">
                <Users className="h-3 w-3" /> {peopleCount} {peopleCount === 1 ? "person" : "people"}
              </Badge>
            )}
            {companyCount > 0 && (
              <Badge variant="secondary">
                <Building2 className="h-3 w-3" /> {companyCount} {companyCount === 1 ? "company" : "companies"}
              </Badge>
            )}
            {taskCount > 0 && (
              <Badge variant="secondary">
                <ListTodo className="h-3 w-3" /> {taskCount} {taskCount === 1 ? "task" : "tasks"}
              </Badge>
            )}
          </div>
        )}
        {aiNote && (
          <div className="mt-1 flex max-w-xs items-start gap-2 rounded-lg border border-warning/30 bg-warning-soft px-3 py-2 text-left text-xs text-warning">
            <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
            <p>{aiNote}</p>
          </div>
        )}
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
          <Button type="button" size="sm" variant="secondary" onClick={handlePaste} disabled={readingImage}>
            {readingImage ? <Loader2 className="animate-spin" /> : <Clipboard />}
            {readingImage ? "Reading image…" : "Paste"}
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
            <Button size="sm" variant="secondary" onClick={saveAsIs}>
              Save as-is
            </Button>
          )}
          <Button size="sm" onClick={captureNote} disabled={!text.trim() || stage === "processing"}>
            {stage === "processing" ? <Loader2 className="animate-spin" /> : <Sparkles />}
            {stage === "processing" ? "Capturing…" : "Capture"}
          </Button>
        </div>
      </div>
    </div>
  );
}
