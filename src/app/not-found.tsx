import Link from "next/link";
import { SearchX } from "lucide-react";
import { buttonVariants } from "@/components/ui/button";

export default function NotFound() {
  return (
    <div className="flex flex-col items-center justify-center gap-3 py-24 text-center">
      <div className="flex h-12 w-12 items-center justify-center rounded-full bg-accent-soft text-accent">
        <SearchX className="h-6 w-6" />
      </div>
      <p className="text-lg font-semibold">We couldn&apos;t find that</p>
      <p className="max-w-sm text-sm text-muted">
        It may have been removed, or the link might be off. Nothing else in your memory was affected.
      </p>
      <Link href="/" className={buttonVariants({ className: "mt-2" })}>
        Back to Home
      </Link>
    </div>
  );
}
