import { Card, CardContent } from "@/components/ui/card";
import { CaptureFlow } from "@/components/capture/capture-flow";

export default function CapturePage() {
  return (
    <div className="mx-auto flex max-w-2xl flex-col gap-6 animate-fade-in">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Capture a thought</h1>
        <p className="mt-1 text-sm text-muted">What do you want to remember?</p>
      </div>
      <Card>
        <CardContent className="pt-6">
          <CaptureFlow />
        </CardContent>
      </Card>
    </div>
  );
}
