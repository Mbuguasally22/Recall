import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

const badgeVariants = cva(
  "inline-flex items-center gap-1 rounded-md border px-2 py-0.5 text-xs font-medium",
  {
    variants: {
      variant: {
        default: "bg-accent-soft text-accent border-transparent",
        secondary: "bg-black/[0.04] dark:bg-white/[0.06] text-muted-foreground border-transparent",
        outline: "border-border text-foreground bg-transparent",
        success: "bg-success-soft text-success border-transparent",
        warning: "bg-warning-soft text-warning border-transparent",
        danger: "bg-danger-soft text-danger border-transparent",
      },
    },
    defaultVariants: { variant: "default" },
  }
);

export interface BadgeProps
  extends React.HTMLAttributes<HTMLSpanElement>,
    VariantProps<typeof badgeVariants> {}

function Badge({ className, variant, ...props }: BadgeProps) {
  return <span className={cn(badgeVariants({ variant }), className)} {...props} />;
}

export { Badge, badgeVariants };
