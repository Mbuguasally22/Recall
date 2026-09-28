import { Suspense } from "react";
import { AssistantChat } from "@/components/assistant/assistant-chat";

export const dynamic = "force-dynamic";

export default function AssistantPage() {
  return (
    <div className="mx-auto flex max-w-2xl flex-col gap-6 animate-fade-in">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">AI Assistant</h1>
        <p className="mt-1 text-sm text-muted">Ask your memory anything. Answers are grounded in what you&apos;ve actually told it.</p>
      </div>
      <Suspense>
        <AssistantChat />
      </Suspense>
    </div>
  );
}
