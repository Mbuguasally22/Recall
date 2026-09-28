"use client";

import * as React from "react";
import { Dialog, DialogContent, DialogClose } from "@/components/ui/dialog";
import { CaptureFlow } from "./capture-flow";

interface QuickCaptureContextValue {
  open: () => void;
}
const QuickCaptureContext = React.createContext<QuickCaptureContextValue | null>(null);

export function useQuickCapture() {
  const ctx = React.useContext(QuickCaptureContext);
  if (!ctx) throw new Error("useQuickCapture must be used within QuickCaptureProvider");
  return ctx;
}

export function QuickCaptureProvider({ children }: { children: React.ReactNode }) {
  const [open, setOpen] = React.useState(false);

  return (
    <QuickCaptureContext.Provider value={{ open: () => setOpen(true) }}>
      {children}
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="relative">
          <DialogClose onClick={() => setOpen(false)} />
          <h2 className="mb-1 text-base font-semibold">Capture a thought</h2>
          <p className="mb-4 text-sm text-muted">What do you want to remember?</p>
          <CaptureFlow compact onSaved={() => setTimeout(() => setOpen(false), 1400)} />
        </DialogContent>
      </Dialog>
    </QuickCaptureContext.Provider>
  );
}
