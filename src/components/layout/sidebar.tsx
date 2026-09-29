"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import { navItems } from "./nav-items";
import { Sparkles, LogOut } from "lucide-react";
import type { CurrentUser } from "@/lib/store";

export function Sidebar({ user }: { user: CurrentUser | null }) {
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
      <div className="border-t border-border-subtle px-5 py-4">
        {user ? (
          <form action="/api/auth/logout" method="POST" className="flex items-center justify-between gap-2">
            <span className="truncate text-xs text-muted" title={user.email ?? undefined}>
              {user.display_name ?? user.email ?? "Signed in"}
            </span>
            <button
              type="submit"
              className="flex shrink-0 items-center gap-1 text-xs text-muted-foreground hover:text-accent"
            >
              <LogOut className="h-3.5 w-3.5" /> Sign out
            </button>
          </form>
        ) : (
          <span className="text-xs text-muted">Your external brain</span>
        )}
      </div>
    </aside>
  );
}
