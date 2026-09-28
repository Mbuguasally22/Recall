import { Sidebar } from "./sidebar";
import { MobileNav } from "./mobile-nav";
import { Topbar } from "./topbar";
import { QuickCaptureProvider } from "@/components/capture/quick-capture-dialog";

export function AppShell({ children }: { children: React.ReactNode }) {
  return (
    <QuickCaptureProvider>
      <div className="flex min-h-screen">
        <Sidebar />
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
