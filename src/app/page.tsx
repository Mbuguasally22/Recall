import Link from "next/link";
import { Lightbulb, Users2, StickyNote } from "lucide-react";
import * as store from "@/lib/store";
import { getInsights } from "@/lib/insights";
import { Greeting } from "@/components/dashboard/greeting";
import { SectionCard } from "@/components/dashboard/section-card";
import { CaptureFlow } from "@/components/capture/capture-flow";
import { TaskRow } from "@/components/shared/task-row";
import { PersonRow } from "@/components/shared/person-row";
import { GoalRow } from "@/components/shared/goal-row";
import { EmptyState } from "@/components/ui/empty-state";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { timeAgo } from "@/lib/utils";

export const dynamic = "force-dynamic";

export default async function DashboardPage() {
  const [overdue, dueToday, upcoming, followUpsAll, goals, recentNotesAll, insights, user] = await Promise.all([
    store.getOverdueTasks(),
    store.getTasksDueToday(),
    store.getUpcomingTasks(7),
    store.getPeopleNeedingFollowUp(),
    store.getGoals(),
    store.getNotes(),
    getInsights(),
    store.getCurrentUser(),
  ]);
  const todayItems = [...overdue, ...dueToday, ...upcoming].slice(0, 6);

  const followUps = followUpsAll.slice(0, 5);
  const shortGoals = goals.filter((g) => g.term === "short_term");
  const longGoals = goals.filter((g) => g.term === "long_term");
  const recentNotes = recentNotesAll.slice(0, 5);

  // People rows below need each task's/person's linked person/company by id —
  // fetch once and look up in-memory rather than one query per row.
  const [allPeople, allCompanies] = await Promise.all([store.getPeople(), store.getCompanies()]);
  const peopleById = new Map(allPeople.map((p) => [p.id, p]));
  const companiesById = new Map(allCompanies.map((c) => [c.id, c]));

  return (
    <div className="flex flex-col gap-8 animate-fade-in">
      <Greeting name={user?.display_name ?? user?.email?.split("@")[0] ?? "there"} />

      <Card className="border-accent/20 bg-gradient-to-br from-accent-soft/60 to-transparent">
        <CardHeader>
          <CardTitle className="text-base">What&apos;s on your mind?</CardTitle>
        </CardHeader>
        <CardContent>
          <CaptureFlow />
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <div className="flex flex-col gap-6 lg:col-span-2">
          <SectionCard title="Today" viewAllHref="/tasks">
            {todayItems.length === 0 ? (
              <EmptyState
                icon={StickyNote}
                title="Nothing on deck today"
                description="Tasks and reminders you create will show up here."
              />
            ) : (
              <div className="divide-y divide-border-subtle">
                {todayItems.map((t) => (
                  <TaskRow
                    key={t.id}
                    task={t}
                    personName={t.related_person_id ? peopleById.get(t.related_person_id)?.name : null}
                  />
                ))}
              </div>
            )}
          </SectionCard>

          <SectionCard title="Recent memory" viewAllHref="/notes">
            {recentNotes.length === 0 ? (
              <EmptyState icon={StickyNote} title="No notes yet" description="Capture your first thought above." />
            ) : (
              <div className="divide-y divide-border-subtle">
                {recentNotes.map((n) => (
                  <Link
                    key={n.id}
                    href={`/notes/${n.id}`}
                    className="block py-2.5 hover:opacity-80"
                  >
                    <div className="flex items-center justify-between gap-2">
                      <p className="truncate text-sm font-medium">{n.title}</p>
                      <span className="shrink-0 text-xs text-muted">{timeAgo(n.created_at)}</span>
                    </div>
                    <p className="mt-0.5 line-clamp-1 text-xs text-muted">
                      {n.ai_summary ?? n.raw_content}
                    </p>
                  </Link>
                ))}
              </div>
            )}
          </SectionCard>
        </div>

        <div className="flex flex-col gap-6">
          <SectionCard title="People to follow up with" viewAllHref="/people">
            {followUps.length === 0 ? (
              <EmptyState icon={Users2} title="You're caught up" description="No pending follow-ups right now." />
            ) : (
              <div className="divide-y divide-border-subtle">
                {followUps.map((p) => (
                  <PersonRow key={p.id} person={p} company={p.company_id ? companiesById.get(p.company_id) ?? null : null} />
                ))}
              </div>
            )}
          </SectionCard>

          <SectionCard title="Goals" viewAllHref="/goals">
            <div className="space-y-1">
              <p className="text-xs font-semibold uppercase tracking-wide text-muted">Short-term</p>
              <div className="divide-y divide-border-subtle">
                {shortGoals.map((g) => <GoalRow key={g.id} goal={g} />)}
              </div>
              <p className="pt-2 text-xs font-semibold uppercase tracking-wide text-muted">Long-term</p>
              <div className="divide-y divide-border-subtle">
                {longGoals.map((g) => <GoalRow key={g.id} goal={g} />)}
              </div>
            </div>
          </SectionCard>

          <SectionCard title="AI insights">
            {insights.length === 0 ? (
              <EmptyState icon={Lightbulb} title="Nothing to surface yet" description="Insights appear as your memory grows." />
            ) : (
              <ul className="space-y-3">
                {insights.map((insight) => (
                  <li key={insight.id} className="flex gap-2 text-sm">
                    <Lightbulb className="mt-0.5 h-3.5 w-3.5 shrink-0 text-accent" />
                    {insight.href ? (
                      <Link href={insight.href} className="text-muted-foreground hover:text-accent">
                        {insight.text}
                      </Link>
                    ) : (
                      <span className="text-muted-foreground">{insight.text}</span>
                    )}
                  </li>
                ))}
              </ul>
            )}
          </SectionCard>
        </div>
      </div>
    </div>
  );
}
