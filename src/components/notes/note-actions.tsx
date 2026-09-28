"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Archive, ArchiveRestore, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";

export function NoteActions({ noteId, archived }: { noteId: string; archived: boolean }) {
  const router = useRouter();
  const [pending, setPending] = React.useState(false);

  async function toggleArchive() {
    setPending(true);
    await fetch(`/api/notes/${noteId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ archived: !archived }),
    });
    setPending(false);
    router.refresh();
  }

  async function remove() {
    if (!confirm("Delete this note? This can't be undone.")) return;
    setPending(true);
    await fetch(`/api/notes/${noteId}`, { method: "DELETE" });
    router.push("/notes");
    router.refresh();
  }

  return (
    <div className="flex gap-2">
      <Button size="sm" variant="secondary" onClick={toggleArchive} disabled={pending}>
        {archived ? <ArchiveRestore /> : <Archive />} {archived ? "Unarchive" : "Archive"}
      </Button>
      <Button size="sm" variant="ghost" onClick={remove} disabled={pending}>
        <Trash2 /> Delete
      </Button>
    </div>
  );
}
