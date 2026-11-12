"use client";

import * as React from "react";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { TaskRow } from "@/components/shared/task-row";
import { EmptyState } from "@/components/ui/empty-state";
import { RelationshipAreaFilter } from "@/components/shared/relationship-area-filter";
import { CheckSquare } from "lucide-react";
import { isOverdue, isToday } from "@/lib/utils";
import type { Person, RelationshipArea, Task } from "@/lib/types";

export function TasksBoard({ tasks, peopleById }: { tasks: Task[]; peopleById: Map<string, Person> }) {
  const [area, setArea] = React.useState<RelationshipArea | "all">("all");

  const availableAreas = React.useMemo(() => {
    const set = new Set<RelationshipArea>();
    peopleById.forEach((p) => {
      if (p.relationship_area) set.add(p.relationship_area);
    });
    return Array.from(set);
  }, [peopleById]);

  const matchesArea = React.useCallback(
    (t: Task) => {
      if (area === "all") return true;
      const personArea = t.related_person_id ? peopleById.get(t.related_person_id)?.relationship_area : null;
      return personArea === area || ((area === "Bumby" || area === "WEConnect") && personArea === "Both");
    },
    [area, peopleById]
  );

  const filteredTasks = tasks.filter(matchesArea);
  const open = filteredTasks.filter((t) => t.status !== "completed" && t.status !== "cancelled");
  const today = open.filter((t) => isToday(t.due_date));
  const overdue = open.filter((t) => isOverdue(t.due_date));
  const upcoming = open.filter((t) => !isToday(t.due_date) && !isOverdue(t.due_date));
  const completed = filteredTasks.filter((t) => t.status === "completed");

  const views: Record<string, Task[]> = { today, upcoming, overdue, completed };

  return (
    <Tabs defaultValue="today">
      <RelationshipAreaFilter value={area} onChange={setArea} available={availableAreas} />
      <TabsList className="mt-3">
        <TabsTrigger value="today">Today ({today.length})</TabsTrigger>
        <TabsTrigger value="upcoming">Upcoming ({upcoming.length})</TabsTrigger>
        <TabsTrigger value="overdue">Overdue ({overdue.length})</TabsTrigger>
        <TabsTrigger value="completed">Completed ({completed.length})</TabsTrigger>
      </TabsList>
      {Object.entries(views).map(([key, list]) => (
        <TabsContent key={key} value={key} className="mt-4">
          {list.length === 0 ? (
            <EmptyState icon={CheckSquare} title={`Nothing here`} description="Tasks will show up as you capture and confirm them." />
          ) : (
            <div className="divide-y divide-border-subtle rounded-xl border border-border bg-surface px-4">
              {list.map((t) => (
                <TaskRow key={t.id} task={t} personName={t.related_person_id ? peopleById.get(t.related_person_id)?.name : null} />
              ))}
            </div>
          )}
        </TabsContent>
      ))}
    </Tabs>
  );
}
