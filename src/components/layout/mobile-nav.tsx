"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import { navItems } from "./nav-items";

// Primary five for the bottom bar; the rest remain reachable from Home/Settings links.
const primary = navItems.filter((n) =>
  ["/", "/people", "/notes", "/tasks", "/assistant"].includes(n.href)
);

export function MobileNav() {
  const pathname = usePathname();
  return (
    <nav className="fixed inset-x-0 bottom-0 z-40 flex border-t border-border bg-surface/95 backdrop-blur md:hidden">
      {primary.map((item) => {
        const active = pathname === item.href || (item.href !== "/" && pathname.startsWith(item.href));
        const Icon = item.icon;
        return (
          <Link
            key={item.href}
            href={item.href}
            className={cn(
              "flex flex-1 flex-col items-center gap-0.5 py-2.5 text-[11px] font-medium",
              active ? "text-accent" : "text-muted"
            )}
          >
            <Icon className="h-5 w-5" />
            {item.label === "AI Assistant" ? "Assistant" : item.label}
          </Link>
        );
      })}
    </nav>
  );
}
