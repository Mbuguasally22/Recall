"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import { navItems } from "./nav-items";
import { Sparkles } from "lucide-react";

export function Sidebar() {
  const pathname = usePathname();

  return (
    <aside className="hidden w-60 shrink-0 flex-col border-r border-border bg-surface md:flex">
      <div className="flex h-16 items-center gap-2 px-5">
        <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-accent text-accent-foreground">
          <Sparkles className="h-4 w-4" />
        </div>
        <span className="text-sm font-semibold tracking-tight">Recall</span>
      </div>
      <nav className="flex-1 space-y-0.5 px-3 py-2">
        {navItems.map((item) => {
          const active = pathname === item.href || (item.href !== "/" && pathname.startsWith(item.href));
          const Icon = item.icon;
          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                "flex items-center gap-2.5 rounded-lg px-3 py-2 text-sm font-medium transition-colors",
                active
                  ? "bg-accent-soft text-accent"
                  : "text-muted-foreground hover:bg-black/[0.03] hover:text-foreground dark:hover:bg-white/[0.05]"
              )}
            >
              <Icon className="h-4 w-4" />
              {item.label}
            </Link>
          );
        })}
      </nav>
      <div className="border-t border-border-subtle px-5 py-4 text-xs text-muted">
        Your external brain
      </div>
    </aside>
  );
}
