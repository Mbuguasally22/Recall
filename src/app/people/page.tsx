import * as store from "@/lib/store";
import { PeopleExplorer } from "@/components/people/people-explorer";

export const dynamic = "force-dynamic";

export default async function PeoplePage() {
  const [people, companies] = await Promise.all([store.getPeople(), store.getCompanies()]);

  return (
    <div className="flex flex-col gap-6 animate-fade-in">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">People</h1>
        <p className="mt-1 text-sm text-muted">{people.length} people in your memory</p>
      </div>
      <PeopleExplorer people={people} companies={companies} />
    </div>
  );
}
