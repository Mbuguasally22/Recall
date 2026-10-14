"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import {
  Camera,
  Mic,
  Sparkles,
  Loader2,
  Check,
  AlertTriangle,
  Copy,
  CheckCheck,
  Users,
  CalendarClock,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import type { RelationshipArea, RelationshipType, WeConnectStatus } from "@/lib/types";
import type { NetworkingExtractResponse } from "@/app/api/networking/extract/route";
import type { NetworkingSaveRequest, NetworkingSaveResponse } from "@/app/api/networking/save/route";

type Stage = "capture" | "processing" | "review" | "saving" | "saved" | "error";

const RELATIONSHIP_AREAS: RelationshipArea[] = ["Bumby", "WEConnect", "Both", "Other"];
const RELATIONSHIP_TYPES: RelationshipType[] = ["WBE", "Buyer", "Government", "Partner", "Supplier", "Media", "Connector", "Other"];
const WECONNECT_STATUSES: WeConnectStatus[] = ["Potential", "Interested", "Registered", "Certified", "N/A"];

function blobToBase64(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => resolve((reader.result as string).split(",")[1] ?? "");
    reader.onerror = reject;
    reader.readAsDataURL(blob);
  });
}

// Minimal Web Speech API typing, same as capture-flow.tsx — real dictation
// where the browser supports it, graceful fallback where it doesn't.
interface SpeechRecognitionResultLike { isFinal: boolean; 0: { transcript: string } }
interface SpeechRecognitionEventLike { resultIndex: number; results: ArrayLike<SpeechRecognitionResultLike> }
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
  const w = window as unknown as { SpeechRecognition?: new () => SpeechRecognitionLike; webkitSpeechRecognition?: new () => SpeechRecognitionLike };
  return w.SpeechRecognition ?? w.webkitSpeechRecognition ?? null;
}

interface ReviewState {
  person_id: string | null;
  name: string;
  title: string;
  company_name: string;
  email: string;
  phone: string;
  linkedin: string;
  location: string;
  industry: string;
  how_we_met: string;
  raw_note: string;
  note_summary: string;
  relationship_area: RelationshipArea | null;
  relationship_type: RelationshipType | null;
  weconnect_status: WeConnectStatus | null;
  priority_next_step: string;
  follow_up_date: string;
  task_title: string;
  intro_from: string;
  intro_to: string;
  intro_note: string;
}

function emptyReview(rawNote: string): ReviewState {
  return {
    person_id: null,
    name: "",
    title: "",
    company_name: "",
    email: "",
    phone: "",
    linkedin: "",
    location: "",
    industry: "",
    how_we_met: "",
    raw_note: rawNote,
    note_summary: "",
    relationship_area: null,
    relationship_type: null,
    weconnect_status: null,
    priority_next_step: "",
    follow_up_date: "",
    task_title: "",
    intro_from: "",
    intro_to: "",
    intro_note: "",
  };
}

function PillGroup<T extends string>({ value, options, onChange }: { value: T | null; options: T[]; onChange: (v: T | null) => void }) {
  return (
    <div className="flex flex-wrap gap-1.5">
      {options.map((opt) => (
        <button
          key={opt}
          type="button"
          onClick={() => onChange(value === opt ? null : opt)}
          className={cn(
            "rounded-full border px-2.5 py-1 text-xs font-medium transition-colors",
            value === opt ? "border-accent bg-accent-soft text-accent" : "border-border text-muted-foreground hover:text-foreground"
          )}
        >
          {opt}
        </button>
      ))}
    </div>
  );
}

export function NetworkingCaptureFlow() {
  const router = useRouter();
  const [stage, setStage] = React.useState<Stage>("capture");
  const [noteText, setNoteText] = React.useState("");
  const [cardImage, setCardImage] = React.useState<{ base64: string; mediaType: string; previewUrl: string } | null>(null);
  const [listening, setListening] = React.useState(false);
  const [review, setReview] = React.useState<ReviewState>(emptyReview(""));
  const [aiNotices, setAiNotices] = React.useState<string[]>([]);
  const [errorMsg, setErrorMsg] = React.useState<string | null>(null);
  const [result, setResult] = React.useState<NetworkingSaveResponse | null>(null);
  const [emailCopied, setEmailCopied] = React.useState(false);
  const recognitionRef = React.useRef<SpeechRecognitionLike | null>(null);
  const fileInputRef = React.useRef<HTMLInputElement | null>(null);
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
    let base = noteText ? noteText + " " : "";
    rec.onresult = (ev) => {
      let interim = "";
      for (let i = ev.resultIndex; i < ev.results.length; i++) {
        const r = ev.results[i];
        if (r.isFinal) base += r[0].transcript + " ";
        else interim += r[0].transcript;
      }
      setNoteText((base + interim).trim());
    };
    rec.onend = () => setListening(false);
    rec.onerror = () => setListening(false);
    recognitionRef.current = rec;
    rec.start();
    setListening(true);
  }

  async function handleFileChosen(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    const base64 = await blobToBase64(file);
    setCardImage({ base64, mediaType: file.type, previewUrl: URL.createObjectURL(file) });
  }

  async function processCapture() {
    if (!noteText.trim() && !cardImage) return;
    setStage("processing");
    setErrorMsg(null);
    setAiNotices([]);

    try {
      const res = await fetch("/api/networking/extract", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          image_base64: cardImage?.base64,
          media_type: cardImage?.mediaType,
          note_text: noteText.trim() || undefined,
        }),
      });
      const data: NetworkingExtractResponse = await res.json();
      if (!res.ok) {
        setErrorMsg((data as unknown as { error?: string }).error ?? "Couldn't process that capture.");
        setStage("error");
        return;
      }

      const notices: string[] = [];
      const next = emptyReview(noteText.trim());
      next.person_id = data.matched_person_id;
      if (data.card) {
        next.name = data.card.name ?? "";
        next.title = data.card.title ?? "";
        next.company_name = data.card.company ?? "";
        next.email = data.card.email ?? "";
        next.phone = data.card.phone ?? "";
        next.linkedin = data.card.linkedin ?? "";
        next.location = data.card.location ?? "";
      }
      if (data.card_error) notices.push(data.card_error);
      if (data.note) {
        next.note_summary = data.note.note_summary;
        next.relationship_area = data.note.relationship_area;
        next.relationship_type = data.note.relationship_type;
        next.weconnect_status = data.note.weconnect_status;
        next.priority_next_step = data.note.priority_next_step ?? "";
        next.follow_up_date = data.note.follow_up_date ?? "";
        next.task_title = data.note.task_title ?? "";
        if (data.note.introduction) {
          next.intro_from = data.note.introduction.from_name;
          next.intro_to = data.note.introduction.to_name;
          next.intro_note = data.note.introduction.note ?? "";
        }
      }
      if (data.note_error) notices.push(data.note_error);

      setReview(next);
      setAiNotices(notices);
      setStage("review");
    } catch {
      setErrorMsg("Couldn't reach the server — try again.");
      setStage("error");
    }
  }

  async function saveContact() {
    if (!review.name.trim()) {
      setErrorMsg("Add the contact's name before saving.");
      return;
    }
    setStage("saving");
    setErrorMsg(null);
    try {
      const payload: NetworkingSaveRequest = {
        person_id: review.person_id,
        name: review.name.trim(),
        title: review.title.trim() || null,
        company_name: review.company_name.trim() || null,
        email: review.email.trim() || null,
        phone: review.phone.trim() || null,
        linkedin: review.linkedin.trim() || null,
        location: review.location.trim() || null,
        industry: review.industry.trim() || null,
        how_we_met: review.how_we_met.trim() || null,
        raw_note: review.raw_note,
        note_summary: review.note_summary.trim() || null,
        relationship_area: review.relationship_area,
        relationship_type: review.relationship_type,
        weconnect_status: review.weconnect_status,
        priority_next_step: review.priority_next_step.trim() || null,
        follow_up_date: review.follow_up_date.trim() || null,
        task_title: review.task_title.trim() || null,
        introduction:
          review.intro_from.trim() && review.intro_to.trim()
            ? { from_name: review.intro_from.trim(), to_name: review.intro_to.trim(), note: review.intro_note.trim() || null }
            : null,
      };
      const res = await fetch("/api/networking/save", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      if (!res.ok) {
        setErrorMsg(data.error ?? "Couldn't save that contact.");
        setStage("review");
        return;
      }
      setResult(data as NetworkingSaveResponse);
      setStage("saved");
      router.refresh();
    } catch {
      setErrorMsg("Couldn't reach the server — your details are still filled in above, try again.");
      setStage("review");
    }
  }

  function reset() {
    setStage("capture");
    setNoteText("");
    setCardImage(null);
    setReview(emptyReview(""));
    setAiNotices([]);
    setErrorMsg(null);
    setResult(null);
    setEmailCopied(false);
  }

  async function copyEmail() {
    if (!result?.email_draft) return;
    const text = `Subject: ${result.email_draft.subject}\n\n${result.email_draft.body}`;
    try {
      await navigator.clipboard.writeText(text);
      setEmailCopied(true);
      setTimeout(() => setEmailCopied(false), 2000);
    } catch {
      // Clipboard permission denied — the draft is still fully visible to copy by hand.
    }
  }

  if (stage === "saved" && result) {
    return (
      <div className="flex flex-col gap-4 animate-fade-in">
        <div className="flex flex-col items-center gap-2 py-4 text-center">
          <div className="flex h-11 w-11 items-center justify-center rounded-full bg-success-soft text-success">
            <Check className="h-5 w-5" />
          </div>
          <p className="text-sm font-medium">Saved {result.person.name} to People</p>
          <div className="flex flex-wrap items-center justify-center gap-1.5">
            {result.hubspot.attempted && (
              <Badge variant={result.hubspot.synced ? "success" : "danger"}>
                {result.hubspot.synced ? "Synced to HubSpot" : "HubSpot sync failed"}
              </Badge>
            )}
            {!result.hubspot.attempted && <Badge variant="secondary">HubSpot not connected</Badge>}
            {result.created_task && <Badge variant="secondary">Task created</Badge>}
            {result.introduction && (
              <Badge variant="secondary"><Users className="h-3 w-3" /> Introduction logged</Badge>
            )}
          </div>
          {result.hubspot.error && (
            <p className="max-w-sm text-xs text-danger">{result.hubspot.error}</p>
          )}
        </div>

        {result.created_task && (
          <Card>
            <CardContent className="flex items-center gap-2 pt-5 text-sm">
              <CalendarClock className="h-4 w-4 text-muted" />
              <span>{result.created_task.title}</span>
              {result.created_task.due_date && (
                <Badge variant="outline">{new Date(result.created_task.due_date).toLocaleDateString()}</Badge>
              )}
            </CardContent>
          </Card>
        )}

        {result.email_draft && (
          <Card>
            <CardHeader><CardTitle>Draft follow-up email (not sent)</CardTitle></CardHeader>
            <CardContent className="flex flex-col gap-2">
              <p className="text-sm font-medium">{result.email_draft.subject}</p>
              <p className="whitespace-pre-wrap text-sm text-muted-foreground">{result.email_draft.body}</p>
              <Button type="button" size="sm" variant="secondary" onClick={copyEmail} className="self-start">
                {emailCopied ? <CheckCheck /> : <Copy />} {emailCopied ? "Copied" : "Copy to clipboard"}
              </Button>
            </CardContent>
          </Card>
        )}
        {result.email_draft_error && <p className="text-xs text-muted">{result.email_draft_error}</p>}

        <div className="flex justify-center gap-2 pt-2">
          <Button size="sm" variant="secondary" onClick={reset}>Capture another contact</Button>
          <Button size="sm" variant="ghost" onClick={() => router.push(`/people/${result.person.id}`)}>View contact</Button>
        </div>
      </div>
    );
  }

  if (stage === "review") {
    return (
      <div className="flex flex-col gap-5 animate-fade-in">
        {aiNotices.map((n, i) => (
          <div key={i} className="flex items-start gap-2 rounded-lg border border-warning/30 bg-warning-soft px-3 py-2 text-xs text-warning">
            <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" /> <p>{n}</p>
          </div>
        ))}
        {errorMsg && (
          <div className="flex items-start gap-2 rounded-lg border border-warning/30 bg-warning-soft px-3 py-2 text-xs text-warning">
            <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" /> <p>{errorMsg}</p>
          </div>
        )}

        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <Input placeholder="Name *" value={review.name} onChange={(e) => setReview((r) => ({ ...r, name: e.target.value }))} />
          <Input placeholder="Title" value={review.title} onChange={(e) => setReview((r) => ({ ...r, title: e.target.value }))} />
          <Input placeholder="Company" value={review.company_name} onChange={(e) => setReview((r) => ({ ...r, company_name: e.target.value }))} />
          <Input placeholder="Location" value={review.location} onChange={(e) => setReview((r) => ({ ...r, location: e.target.value }))} />
          <Input placeholder="Email" value={review.email} onChange={(e) => setReview((r) => ({ ...r, email: e.target.value }))} />
          <Input placeholder="Phone" value={review.phone} onChange={(e) => setReview((r) => ({ ...r, phone: e.target.value }))} />
          <Input placeholder="LinkedIn" value={review.linkedin} onChange={(e) => setReview((r) => ({ ...r, linkedin: e.target.value }))} />
          <Input placeholder="How we met" value={review.how_we_met} onChange={(e) => setReview((r) => ({ ...r, how_we_met: e.target.value }))} />
        </div>

        <div className="flex flex-col gap-1.5">
          <p className="text-xs font-medium text-muted">Note</p>
          <Textarea
            value={review.note_summary}
            onChange={(e) => setReview((r) => ({ ...r, note_summary: e.target.value }))}
            placeholder="AI summary of the conversation (editable)"
            className="min-h-[70px] text-sm"
          />
        </div>

        <div className="flex flex-col gap-1.5">
          <p className="text-xs font-medium text-muted">Relationship area</p>
          <PillGroup value={review.relationship_area} options={RELATIONSHIP_AREAS} onChange={(v) => setReview((r) => ({ ...r, relationship_area: v }))} />
        </div>
        <div className="flex flex-col gap-1.5">
          <p className="text-xs font-medium text-muted">Relationship type</p>
          <PillGroup value={review.relationship_type} options={RELATIONSHIP_TYPES} onChange={(v) => setReview((r) => ({ ...r, relationship_type: v }))} />
        </div>
        <div className="flex flex-col gap-1.5">
          <p className="text-xs font-medium text-muted">WEConnect status</p>
          <PillGroup value={review.weconnect_status} options={WECONNECT_STATUSES} onChange={(v) => setReview((r) => ({ ...r, weconnect_status: v }))} />
        </div>

        <Input
          placeholder="Priority next step"
          value={review.priority_next_step}
          onChange={(e) => setReview((r) => ({ ...r, priority_next_step: e.target.value }))}
        />

        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <div className="flex flex-col gap-1.5">
            <p className="text-xs font-medium text-muted">Follow-up task</p>
            <Input placeholder="e.g. Send pricing sheet" value={review.task_title} onChange={(e) => setReview((r) => ({ ...r, task_title: e.target.value }))} />
          </div>
          <div className="flex flex-col gap-1.5">
            <p className="text-xs font-medium text-muted">Follow-up date {!review.follow_up_date && "(defaults to next Monday)"}</p>
            <Input type="date" value={review.follow_up_date} onChange={(e) => setReview((r) => ({ ...r, follow_up_date: e.target.value }))} />
          </div>
        </div>

        <div className="rounded-lg border border-border-subtle p-3">
          <p className="mb-2 flex items-center gap-1.5 text-xs font-medium text-muted"><Users className="h-3.5 w-3.5" /> Introduction (optional)</p>
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
            <Input placeholder="Introduced from (name)" value={review.intro_from} onChange={(e) => setReview((r) => ({ ...r, intro_from: e.target.value }))} />
            <Input placeholder="Introduced to (name)" value={review.intro_to} onChange={(e) => setReview((r) => ({ ...r, intro_to: e.target.value }))} />
          </div>
          <Input
            className="mt-2"
            placeholder="Note about the introduction (optional)"
            value={review.intro_note}
            onChange={(e) => setReview((r) => ({ ...r, intro_note: e.target.value }))}
          />
        </div>

        <div className="flex justify-end gap-2">
          <Button size="sm" variant="ghost" onClick={reset}>Start over</Button>
          <Button size="sm" onClick={saveContact} disabled={!review.name.trim()}>
            <Sparkles /> Save contact
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      {cardImage && (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={cardImage.previewUrl} alt="Business card preview" className="max-h-48 w-auto self-start rounded-lg border border-border-subtle object-contain" />
      )}
      <input ref={fileInputRef} type="file" accept="image/*" capture="environment" onChange={handleFileChosen} className="hidden" />
      <Textarea
        value={noteText}
        onChange={(e) => setNoteText(e.target.value)}
        placeholder="What did you talk about? Dictate or type a quick note about this contact..."
        className="min-h-[140px] text-sm"
        disabled={stage === "processing"}
      />
      {errorMsg && (
        <div className="flex items-start gap-2 rounded-lg border border-warning/30 bg-warning-soft px-3 py-2 text-xs text-warning">
          <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" /> <p>{errorMsg}</p>
        </div>
      )}
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex flex-wrap gap-1.5">
          <Button type="button" size="sm" variant="secondary" onClick={() => fileInputRef.current?.click()}>
            <Camera /> {cardImage ? "Retake card" : "Scan business card"}
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
        </div>
        <Button size="sm" onClick={processCapture} disabled={(!noteText.trim() && !cardImage) || stage === "processing"}>
          {stage === "processing" ? <Loader2 className="animate-spin" /> : <Sparkles />}
          {stage === "processing" ? "Processing…" : "Process"}
        </Button>
      </div>
    </div>
  );
}
