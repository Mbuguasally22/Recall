import { Card, CardContent } from "@/components/ui/card";
import { NetworkingCaptureFlow } from "@/components/networking/networking-capture-flow";

export default function NetworkingPage() {
  return (
    <div className="mx-auto flex max-w-2xl flex-col gap-6 animate-fade-in">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Networking capture</h1>
        <p className="mt-1 text-sm text-muted">
          Scan a business card, add a quick note, and Recall handles the rest — HubSpot contact, note, follow-up
          task, and a draft email, all in one pass.
        </p>
      </div>
      <Card>
        <CardContent className="pt-6">
          <NetworkingCaptureFlow />
        </CardContent>
      </Card>
    </div>
  );
}
