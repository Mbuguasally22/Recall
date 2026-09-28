import Link from "next/link";
import { Avatar } from "@/components/ui/avatar";
import { formatDateShort } from "@/lib/utils";
import type { Company, Person } from "@/lib/types";

export function PersonRow({ person, company }: { person: Person; company?: Company | null }) {
  return (
    <Link
      href={`/people/${person.id}`}
      className="flex items-center gap-3 rounded-lg py-2.5 transition-colors hover:bg-black/[0.02] dark:hover:bg-white/[0.03]"
    >
      <Avatar name={person.name} color={person.avatar_color} />
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-medium">{person.name}</p>
        <p className="truncate text-xs text-muted">
          {company?.name ?? person.industry ?? "—"}
          {person.last_interaction_at && ` · last talked ${formatDateShort(person.last_interaction_at)}`}
        </p>
      </div>
      {person.next_follow_up_at && (
        <span className="shrink-0 text-xs font-medium text-warning">
          Follow up {formatDateShort(person.next_follow_up_at)}
        </span>
      )}
    </Link>
  );
}
