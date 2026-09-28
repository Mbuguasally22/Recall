import Link from "next/link";
import { notFound } from "next/navigation";
import * as store from "@/lib/store";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Avatar } from "@/components/ui/avatar";
import { NoteActions } from "@/components/notes/note-actions";
import { formatDateTime } from "@/lib/utils";

export const dynamic = "force-dynamic";

export default async function NoteDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const note = store.getNote(id);
  if (!note) notFound();

  const people = note.person_ids.map((pid) => store.getPerson(pid)).filter(Boolean);
  const companies = note.company_ids.map((cid) => store.getCompany(cid)).filter(Boolean);
  const events = note.event_ids
    .map((eid) => store.getEvents().find((e) => e.id === eid))
    .filter(Boolean);
  const relatedTasks = store.getTasks().filter((t) => t.source_note_id === id);

  return (
    <div className="mx-auto flex max-w-3xl flex-col gap-6 animate-fade-in">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">{note.title}</h1>
          <p className="mt-1 text-sm text-muted">
            Captured {formatDateTime(note.created_at)} · {note.source_type}
          </p>
        </div>
        <NoteActions noteId={note.id} archived={note.archived} />
      </div>

      <Card>
        <CardHeader><CardTitle>Raw memory</CardTitle></CardHeader>
        <CardContent>
          <p className="whitespace-pre-wrap text-sm leading-relaxed">{note.raw_content}</p>
          <p className="mt-3 text-xs text-muted">Preserved exactly as written — never modified by AI.</p>
        </CardContent>
      </Card>

      {note.ai_summary && (
        <Card>
          <CardHeader><CardTitle>AI summary</CardTitle></CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground">{note.ai_summary}</p>
          </CardContent>
        </Card>
      )}

      {(people.length > 0 || companies.length > 0 || events.length > 0 || note.tags.length > 0) && (
        <Card>
          <CardHeader><CardTitle>Linked structure</CardTitle></CardHeader>
          <CardContent className="flex flex-col gap-4">
            {people.length > 0 && (
              <div>
                <p className="mb-2 text-xs font-medium text-muted">People</p>
                <div className="flex flex-wrap gap-2">
                  {people.map((p) => (
                    <Link key={p!.id} href={`/people/${p!.id}`} className="flex items-center gap-1.5 rounded-full border border-border py-1 pl-1 pr-3 text-sm hover:border-accent/40">
                      <Avatar name={p!.name} color={p!.avatar_color} size="sm" />
                      {p!.name}
                    </Link>
                  ))}
                </div>
              </div>
            )}
            {companies.length > 0 && (
              <div>
                <p className="mb-2 text-xs font-medium text-muted">Companies</p>
                <div className="flex flex-wrap gap-1.5">
                  {companies.map((c) => <Badge key={c!.id} variant="secondary">{c!.name}</Badge>)}
                </div>
              </div>
            )}
            {events.length > 0 && (
              <div>
                <p className="mb-2 text-xs font-medium text-muted">Events</p>
                <div className="flex flex-wrap gap-1.5">
                  {events.map((e) => <Badge key={e!.id} variant="secondary">{e!.name}</Badge>)}
                </div>
              </div>
            )}
            {note.tags.length > 0 && (
              <div>
                <p className="mb-2 text-xs font-medium text-muted">Tags</p>
                <div className="flex flex-wrap gap-1.5">
                  {note.tags.map((t) => <Badge key={t} variant="outline">{t}</Badge>)}
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {relatedTasks.length > 0 && (
        <Card>
          <CardHeader><CardTitle>Tasks created from this note</CardTitle></CardHeader>
          <CardContent className="space-y-2">
            {relatedTasks.map((t) => (
              <div key={t.id} className="flex items-center justify-between text-sm">
                <span className={t.status === "completed" ? "text-muted line-through" : ""}>{t.title}</span>
                <Badge variant={t.status === "completed" ? "success" : "outline"}>{t.status.replace("_", " ")}</Badge>
              </div>
            ))}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
