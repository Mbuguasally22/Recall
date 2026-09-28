import * as store from "@/lib/store";
import { NotesExplorer } from "@/components/notes/notes-explorer";

export const dynamic = "force-dynamic";

export default function NotesPage() {
  const notes = store.getNotes();
  return (
    <div className="flex flex-col gap-6 animate-fade-in">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Notes</h1>
        <p className="mt-1 text-sm text-muted">{notes.length} notes captured</p>
      </div>
      <NotesExplorer notes={notes} />
    </div>
  );
}
