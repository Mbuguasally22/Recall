import type { Metadata } from "next";
import "./globals.css";
import { AppShell } from "@/components/layout/app-shell";
import { getCurrentUser } from "@/lib/store";

export const metadata: Metadata = {
  title: "Recall — your external brain",
  description: "Personal memory, CRM, and AI assistant for the people, plans, and goals in your life.",
};

export default async function RootLayout({ children }: LayoutProps<"/">) {
  // Safe on /login and /signup too — signed out just means `user` is null.
  const user = await getCurrentUser();
  return (
    <html lang="en" className="h-full antialiased">
      <body className="min-h-full">
        <AppShell user={user}>{children}</AppShell>
      </body>
    </html>
  );
}
