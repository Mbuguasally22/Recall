"use client";

import * as React from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Send, Loader2, AlertTriangle, Sparkles } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import type { AssistantAnswer } from "@/lib/types";

const EXAMPLE_QUESTIONS = [
  "Who did I meet at All In?",
  "What did I say about Sarah Chen?",
  "Who do I know in Toronto?",
  "Who works in fintech?",
  "What do I need to follow up on?",
  "What were my biggest successes this month?",
];

interface Turn {
  question: string;
  answer?: AssistantAnswer;
  error?: string;
  pending?: boolean;
}

export function AssistantChat() {
  const searchParams = useSearchParams();
  const prefilled = searchParams.get("q") ?? "";
  const [input, setInput] = React.useState(prefilled);
  const [turns, setTurns] = React.useState<Turn[]>([]);
  const askedPrefill = React.useRef(false);

  async function ask(question: string) {
    const q = question.trim();
    if (!q) return;
    setTurns((prev) => [...prev, { question: q, pending: true }]);
    setInput("");

    const res = await fetch("/api/assistant/ask", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ question: q }),
    });
    const data = await res.json();

    setTurns((prev) =>
      prev.map((t, i) =>
        i === prev.length - 1
          ? res.ok
            ? { ...t, pending: false, answer: data as AssistantAnswer }
            : { ...t, pending: false, error: data.detail ?? data.error ?? "Something went wrong." }
          : t
      )
    );
  }

  React.useEffect(() => {
    if (prefilled && !askedPrefill.current) {
      askedPrefill.current = true;
      ask(prefilled);
    }
  }, [prefilled]);

  function submit(e: React.FormEvent) {
    e.preventDefault();
    ask(input);
  }

  return (
    <div className="flex flex-col gap-5">
      <form onSubmit={submit} className="flex gap-2">
        <Input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="Ask your memory anything..."
          className="h-12 flex-1 text-base"
        />
        <Button type="submit" size="lg" disabled={!input.trim()}>
          <Send />
        </Button>
      </form>

      {turns.length === 0 && (
        <div>
          <p className="mb-2 text-xs font-medium text-muted">Try asking</p>
          <div className="flex flex-wrap gap-2">
            {EXAMPLE_QUESTIONS.map((q) => (
              <button
                key={q}
                onClick={() => ask(q)}
                className="rounded-full border border-border px-3 py-1.5 text-xs font-medium text-muted-foreground hover:border-accent/40 hover:text-accent"
              >
                {q}
              </button>
            ))}
          </div>
        </div>
      )}

      <div className="flex flex-col gap-4">
        {turns.map((t, i) => (
          <div key={i} className="animate-fade-in">
            <p className="text-sm font-medium">{t.question}</p>
            <div className="mt-2 rounded-xl border border-border bg-surface p-4">
              {t.pending && (
                <div className="flex items-center gap-2 text-sm text-muted">
                  <Loader2 className="h-3.5 w-3.5 animate-spin" /> Thinking…
                </div>
              )}
              {t.error && (
                <div className="flex items-start gap-2 text-sm text-warning">
                  <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
                  {t.error}
                </div>
              )}
              {t.answer && (
                <>
                  <p className={cn("text-sm", !t.answer.grounded && "text-muted italic")}>{t.answer.answer}</p>
                  {t.answer.sources.length > 0 && (
                    <div className="mt-3 flex flex-wrap gap-2 border-t border-border-subtle pt-3">
                      {t.answer.sources.map((s) => (
                        <Link
                          key={s.note_id}
                          href={`/notes/${s.note_id}`}
                          className="flex items-center gap-1 rounded-full border border-border px-2.5 py-1 text-xs text-muted-foreground hover:border-accent/40 hover:text-accent"
                        >
                          <Sparkles className="h-3 w-3" /> {s.note_title}
                        </Link>
                      ))}
                    </div>
                  )}
                </>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
