import { CalendarClock, Users, CheckSquare } from "lucide-react";
import * as store from "@/lib/store";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

export const dynamic = "force-dynamic";

function formatDate(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" });
}

export default async function MeetingsPage() {
  const meetings = await store.getMeetings();

  return (
    <div className="flex flex-col gap-6 animate-fade-in">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Meetings</h1>
        <p className="mt-1 text-sm text-muted">
          {meetings.length} meeting{meetings.length === 1 ? "" : "s"}
          {meetings.some((m) => m.source === "wispr_flow") ? " — including ones synced from Wispr Flow" : ""}
        </p>
      </div>

      {meetings.length === 0 ? (
        <Card>
          <CardContent className="py-10 text-center text-sm text-muted">
            No meetings yet. Connect Wispr Flow in Settings and click &quot;Sync now&quot; to pull yours in.
          </CardContent>
        </Card>
      ) : (
        <div className="flex flex-col gap-4">
          {meetings.map((meeting) => (
            <Card key={meeting.id}>
              <CardHeader>
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <CardTitle className="flex items-center gap-2 text-base">
                    <CalendarClock className="h-4 w-4 shrink-0 text-muted-foreground" />
                    {meeting.title}
                  </CardTitle>
                  <div className="flex items-center gap-2">
                    <Badge variant={meeting.source === "wispr_flow" ? "default" : "secondary"}>
                      {meeting.source === "wispr_flow" ? "Wispr Flow" : "Manual"}
                    </Badge>
                    <span className="text-xs text-muted whitespace-nowrap">{formatDate(meeting.date)}</span>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="space-y-3">
                {meeting.summary && <p className="text-sm text-foreground">{meeting.summary}</p>}

                {meeting.attendees.length > 0 && (
                  <div className="flex items-start gap-2 text-xs text-muted">
                    <Users className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                    <span>{meeting.attendees.map((a) => a.name).join(", ")}</span>
                  </div>
                )}

                {meeting.action_items.length > 0 && (
                  <div className="flex items-start gap-2 text-xs text-muted">
                    <CheckSquare className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                    <ul className="list-inside list-disc space-y-0.5">
                      {meeting.action_items.map((item, i) => (
                        <li key={i}>{item}</li>
                      ))}
                    </ul>
                  </div>
                )}

                {!meeting.summary && meeting.attendees.length === 0 && meeting.action_items.length === 0 && (
                  <p className="text-xs text-muted">No additional details on this one.</p>
                )}
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
