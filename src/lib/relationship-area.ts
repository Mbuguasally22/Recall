import type { RelationshipArea } from "./types";

// Shared by the People/Tasks/Notes filters and the dashboard's split
// follow-up digest — one canonical place for "what are the areas" and "how
// do we group by them" so the two don't drift apart.

export const RELATIONSHIP_AREAS: RelationshipArea[] = ["Bumby", "WEConnect", "Both", "Other"];

export interface AreaGroups<T> {
  bumby: T[];
  weconnect: T[];
  /** No area set, or explicitly "Other" — never silently dropped. */
  other: T[];
}

/**
 * Buckets items by relationship area for the dashboard's split digest.
 * "Both" lands in both the Bumby and WEConnect buckets (a commitment that
 * touches both hats shouldn't disappear from either one's list), and a
 * missing/"Other" area lands in `other` rather than being dropped.
 */
export function groupByArea<T>(
  items: T[],
  getArea: (item: T) => RelationshipArea | null | undefined
): AreaGroups<T> {
  const groups: AreaGroups<T> = { bumby: [], weconnect: [], other: [] };
  for (const item of items) {
    const area = getArea(item);
    if (area === "Bumby" || area === "Both") groups.bumby.push(item);
    if (area === "WEConnect" || area === "Both") groups.weconnect.push(item);
    if (!area || area === "Other") groups.other.push(item);
  }
  return groups;
}
