"use client";

import { Plus, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useQuickCapture } from "@/components/capture/quick-capture-dialog";

export function Topbar() {
  const { open } = useQuickCapture();
  return (
    <header className="sticky top-0 z-30 flex h-16 items-center justify-between border-b border-border bg-surface/90 px-4 backdrop-blur md:px-6">
      <div className="flex items-center gap-2 md:hidden">
        <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-accent text-accent-foreground">
          <Sparkles className="h-4 w-4" />
        </div>
        <span className="text-sm font-semibold">Recall</span>
      </div>
      <div className="hidden md:block" />
      <Button size="sm" onClick={open}>
        <Plus /> Capture
      </Button>
    </header>
  );
}
