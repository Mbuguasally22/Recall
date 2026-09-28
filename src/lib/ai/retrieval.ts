import * as store from "@/lib/store";
import type { Note } from "@/lib/types";

// Simple, dependency-free lexical retrieval: score notes by term overlap
// with the question, plus a boost for notes linked to a person/company/tag
// explicitly named in the question. This is the "simplest reliable
// implementation that can ship quickly" called for in the brief — swap for
// pgvector / embeddings once Supabase is wired in (see supabase/schema.sql,
// memory_items table, which already carries an embedding column for this).

const STOPWORDS = new Set([
  "the", "a", "an", "is", "are", "was", "were", "do", "does", "did", "i",
  "me", "my", "what", "who", "where", "when", "which", "how", "have", "has",
  "had", "with", "about", "for", "to", "of", "in", "on", "at", "and", "or",
  "did", "know", "you", "did",
]);

function tokenize(text: string): string[] {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .split(/\s+/)
    .filter((t) => t.length > 1 && !STOPWORDS.has(t));
}

export interface RetrievedContext {
  notes: Array<Note & { score: number }>;
  matchedPeopleNames: string[];
}

export function retrieveRelevantNotes(question: string, limit = 8): RetrievedContext {
  const qTokens = new Set(tokenize(question));
  const people = store.getPeople();
  const matchedPeople = people.filter((p) =>
    question.toLowerCase().includes(p.name.toLowerCase())
  );

  const scored = store.getNotes().map((note) => {
    const haystack = [
      note.title,
      note.raw_content,
      note.ai_summary ?? "",
      ...note.tags,
    ]
      .join(" ")
      .toLowerCase();
    const noteTokens = tokenize(haystack);
    let score = 0;
    for (const t of noteTokens) if (qTokens.has(t)) score += 1;

    // Boost notes that mention a person explicitly named in the question.
    for (const p of matchedPeople) {
      if (note.person_ids.includes(p.id)) score += 5;
    }
    return { ...note, score };
  });

  const relevant = scored
    .filter((n) => n.score > 0)
    .sort((a, b) => b.score - a.score || new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
    .slice(0, limit);

  return { notes: relevant, matchedPeopleNames: matchedPeople.map((p) => p.name) };
}
