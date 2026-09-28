"use client";

import * as React from "react";
import { X } from "lucide-react";
import { cn } from "@/lib/utils";

export function Dialog({
  open,
  onOpenChange,
  children,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  children: React.ReactNode;
}) {
  React.useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") onOpenChange(false);
    }
    if (open) document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open, onOpenChange]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto p-4 pt-[8vh] sm:pt-[12vh]">
      <div
        className="fixed inset-0 bg-black/40 backdrop-blur-[2px] animate-fade-in"
        onClick={() => onOpenChange(false)}
      />
      <div className="relative z-10 w-full max-w-lg animate-fade-in">{children}</div>
    </div>
  );
}

export function DialogContent({ className, children }: { className?: string; children: React.ReactNode }) {
  return (
    <div
      className={cn(
        "rounded-xl border border-border bg-surface p-6 shadow-2xl",
        className
      )}
    >
      {children}
    </div>
  );
}

export function DialogClose({ onClick }: { onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className="absolute right-4 top-4 rounded-md p-1 text-muted hover:bg-black/[0.04] hover:text-foreground dark:hover:bg-white/[0.06]"
    >
      <X className="h-4 w-4" />
    </button>
  );
}
