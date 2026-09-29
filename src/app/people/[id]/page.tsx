import Link from "next/link";
import { notFound } from "next/navigation";
import { Mail, Phone, Link2, MapPin, CalendarClock } from "lucide-react";
import * as store from "@/lib/store";
import { Avatar } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { PersonAiActions } from "@/components/people/person-ai-actions";
import { formatDate, formatDateTime } from "@/lib/utils";
import { StickyNote } from "lucide-react";

export const dynamic = "force-dynamic";

export default async function PersonProfilePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const person = await store.getPerson(id);
  if (!person) notFound();

  const [events, interactions, notes, tasks] = await Promise.all([
    store.getEvents(),
    store.getInteractionsForPerson(id),
    store.getNotesForPerson(id),
    store.getTasksForPerson(id),
  ]);
  const company = person.company_id ? await store.getCompany(person.company_id) : null;
  const event = person.met_event_id ? events.find((e) => e.id === person.met_event_id) : null;

  return (
    <div className="flex flex-col gap-6 animate-fade-in">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="flex items-start gap-4">
          <Avatar name={person.name} color={person.avatar_color} size="lg" />
          <div>
            <h1 className="text-2xl font-semibold tracking-tight">{person.name}</h1>
            <p className="mt-0.5 text-sm text-muted">
              {[person.industry, company?.name].filter(Boolean).join(" · ")}
            </p>
            {person.location && (
              <p className="mt-0.5 flex items-center gap-1 text-sm text-muted">
                <MapPin className="h-3.5 w-3.5" /> {person.location}
              </p>
            )}
            <div className="mt-2 flex flex-wrap gap-1.5">
              {person.tags.map((t) => <Badge key={t} variant="secondary">{t}</Badge>)}
            </div>
          </div>
        </div>
      </div>

      <Card>
        <CardContent className="pt-5">
          <PersonAiActions personId={person.id} personName={person.name} />
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <div className="flex flex-col gap-6 lg:col-span-2">
          <Card id="timeline">
            <CardHeader><CardTitle>Timeline</CardTitle></CardHeader>
            <CardContent>
              {interactions.length === 0 ? (
                <EmptyState icon={CalendarClock} title="No interactions logged yet" />
              ) : (
                <ol className="space-y-4 border-l border-border-subtle pl-4">
                  {interactions.map((i) => (
                    <li key={i.id} className="relative">
                      <span className="absolute -left-[21px] top-1 h-2 w-2 rounded-full bg-accent" />
                      <p className="text-xs text-muted">{formatDate(i.occurred_at)}</p>
                      <p className="text-sm">{i.summary}</p>
                      {i.source_note_id && (
                        <Link href={`/notes/${i.source_note_id}`} className="text-xs text-accent hover:underline">
                          View source note
                        </Link>
                      )}
                    </li>
                  ))}
                </ol>
              )}
            </CardContent>
          </Card>

          <Card id="memory">
            <CardHeader><CardTitle>Memory</CardTitle></CardHeader>
            <CardContent>
              {notes.length === 0 ? (
                <EmptyState icon={StickyNote} title="No notes mention this person yet" />
              ) : (
                <div className="divide-y divide-border-subtle">
                  {notes.map((n) => (
                    <Link key={n.id} href={`/notes/${n.id}`} className="block py-3 hover:opacity-80">
                      <p className="text-sm font-medium">{n.title}</p>
                      <p className="mt-0.5 text-sm text-muted-foreground">&ldquo;{n.raw_content}&rdquo;</p>
                    </Link>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        <div className="flex flex-col gap-6">
          <Card>
            <CardHeader><CardTitle>Contact</CardTitle></CardHeader>
            <CardContent className="space-y-2 text-sm">
              {person.email && (
                <p className="flex items-center gap-2"><Mail className="h-3.5 w-3.5 text-muted" /> {person.email}</p>
              )}
              {person.phone && (
                <p className="flex items-center gap-2"><Phone className="h-3.5 w-3.5 text-muted" /> {person.phone}</p>
              )}
              {person.linkedin && (
                <p className="flex items-center gap-2"><Link2 className="h-3.5 w-3.5 text-muted" /> {person.linkedin}</p>
              )}
              {!person.email && !person.phone && !person.linkedin && (
                <p className="text-muted">No contact details saved yet.</p>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader><CardTitle>Relationship</CardTitle></CardHeader>
            <CardContent className="space-y-2 text-sm">
              {person.how_we_met && (
                <div>
                  <p className="text-xs text-muted">How we met</p>
                  <p>{person.how_we_met}{event ? ` — ${event.name}` : ""}</p>
                </div>
              )}
              {person.last_interaction_at && (
                <div>
                  <p className="text-xs text-muted">Last interaction</p>
                  <p>{formatDate(person.last_interaction_at)}</p>
                </div>
              )}
              <div>
                <p className="text-xs text-muted">Next follow-up</p>
                <p>{person.next_follow_up_at ? formatDate(person.next_follow_up_at) : "None scheduled"}</p>
              </div>
            </CardContent>
          </Card>

          {tasks.length > 0 && (
            <Card>
              <CardHeader><CardTitle>Related tasks</CardTitle></CardHeader>
              <CardContent className="space-y-2 text-sm">
                {tasks.map((t) => (
                  <div key={t.id} className="flex items-center justify-between gap-2">
                    <span className={t.status === "completed" ? "text-muted line-through" : ""}>{t.title}</span>
                    <Badge variant={t.status === "completed" ? "success" : "outline"}>{t.status.replace("_", " ")}</Badge>
                  </div>
                ))}
              </CardContent>
            </Card>
          )}

          <p className="text-center text-xs text-muted">
            Updated {formatDateTime(person.updated_at)}
          </p>
        </div>
      </div>
    </div>
  );
}
