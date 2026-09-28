"use client";

import { useEffect } from "react";
import { AlertTriangle } from "lucide-react";
import { Button } from "@/components/ui/button";

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <div className="flex flex-col items-center justify-center gap-3 py-24 text-center">
      <div className="flex h-12 w-12 items-center justify-center rounded-full bg-danger-soft text-danger">
        <AlertTriangle className="h-6 w-6" />
      </div>
      <p className="text-lg font-semibold">Something went wrong</p>
      <p className="max-w-sm text-sm text-muted">
        This page hit an unexpected error. Your captured notes and data are unaffected — try again.
      </p>
      <Button className="mt-2" onClick={reset}>Try again</Button>
    </div>
  );
}
