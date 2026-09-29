import { Sidebar } from "./sidebar";
import { MobileNav } from "./mobile-nav";
import { Topbar } from "./topbar";
import { QuickCaptureProvider } from "@/components/capture/quick-capture-dialog";
import type { CurrentUser } from "@/lib/store";

export function AppShell({
  children,
  user,
}: {
  children: React.ReactNode;
  user: CurrentUser | null;
}) {
  return (
    <QuickCaptureProvider>
      <div className="flex min-h-screen">
        <Sidebar user={user} />
        <div className="flex min-h-screen flex-1 flex-col">
          <Topbar />
          <main className="flex-1 pb-20 md:pb-0">
            <div className="mx-auto w-full max-w-6xl px-4 py-6 md:px-8 md:py-8">{children}</div>
          </main>
        </div>
        <MobileNav />
      </div>
    </QuickCaptureProvider>
  );
}
