// Deterministic, rule-based insight generation — every insight here is
// computed directly from stored records, never invented. This keeps the
// dashboard fast (no AI round-trip on every load) while still honoring the
// "never invent facts" guardrail: each insight is a straightforward
// aggregation over real data, phrased plainly.

import * as store from "@/lib/store";

export interface Insight {
  id: string;
  text: string;
  href?: string;
}

export async function getInsights(): Promise<Insight[]> {
  const insights: Insight[] = [];
  const [people, notes, tasks, goals] = await Promise.all([
    store.getPeople(),
    store.getNotes(),
    store.getTasks(),
    store.getGoals(),
  ]);

  // Mentioned more than once but no open follow-up task.
  for (const person of people) {
    const mentionCount = notes.filter((n) => n.person_ids.includes(person.id)).length;
    const hasOpenTask = tasks.some(
      (t) => t.related_person_id === person.id && t.status !== "completed" && t.status !== "cancelled"
    );
    if (mentionCount >= 2 && !hasOpenTask) {
      insights.push({
        id: `mention-${person.id}`,
        text: `You mentioned ${person.name} ${mentionCount} times but haven't created a follow-up.`,
        href: `/people/${person.id}`,
      });
    }
  }

  // Goals nearing their target date with open related tasks remaining.
  for (const goal of goals) {
    if (!goal.target_date || goal.status === "achieved") continue;
    const daysLeft = Math.ceil((new Date(goal.target_date).getTime() - Date.now()) / 86400000);
    const relatedOpenTasks = tasks.filter(
      (t) => t.related_goal_id === goal.id && t.status !== "completed" && t.status !== "cancelled"
    );
    if (daysLeft <= 7 && daysLeft >= 0) {
      insights.push({
        id: `goal-${goal.id}`,
        text: `Your goal "${goal.name}" is due in ${daysLeft} day${daysLeft === 1 ? "" : "s"}.${
          relatedOpenTasks.length ? ` You have ${relatedOpenTasks.length} related task${relatedOpenTasks.length === 1 ? "" : "s"} remaining.` : ""
        }`,
        href: "/goals",
      });
    }
  }

  // Overdue follow-ups.
  const overdue = await store.getPeopleNeedingFollowUp();
  if (overdue.length > 0) {
    insights.push({
      id: "overdue-followups",
      text: `${overdue.length} ${overdue.length === 1 ? "person needs" : "people need"} a follow-up: ${overdue
        .slice(0, 3)
        .map((p) => p.name)
        .join(", ")}${overdue.length > 3 ? ", and more" : ""}.`,
      href: "/people",
    });
  }

  // Overdue tasks.
  const overdueTasks = await store.getOverdueTasks();
  if (overdueTasks.length > 0) {
    insights.push({
      id: "overdue-tasks",
      text: `${overdueTasks.length} task${overdueTasks.length === 1 ? " is" : "s are"} overdue.`,
      href: "/tasks",
    });
  }

  return insights.slice(0, 6);
}
