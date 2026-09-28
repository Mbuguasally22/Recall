import Link from "next/link";
import { ChevronRight } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export function SectionCard({
  title,
  viewAllHref,
  children,
}: {
  title: string;
  viewAllHref?: string;
  children: React.ReactNode;
}) {
  return (
    <Card>
      <CardHeader className="flex-row items-center justify-between space-y-0">
        <CardTitle>{title}</CardTitle>
        {viewAllHref && (
          <Link
            href={viewAllHref}
            className="flex items-center text-xs font-medium text-muted hover:text-accent"
          >
            View all <ChevronRight className="h-3.5 w-3.5" />
          </Link>
        )}
      </CardHeader>
      <CardContent>{children}</CardContent>
    </Card>
  );
}
