import { cn } from "@/lib/utils";
import { initials } from "@/lib/utils";

export function Avatar({
  name,
  color,
  size = "md",
  className,
}: {
  name: string;
  color?: string;
  size?: "sm" | "md" | "lg";
  className?: string;
}) {
  const sizes = {
    sm: "h-7 w-7 text-[10px]",
    md: "h-9 w-9 text-xs",
    lg: "h-14 w-14 text-lg",
  };
  return (
    <div
      className={cn(
        "flex shrink-0 items-center justify-center rounded-full font-semibold text-white",
        sizes[size],
        className
      )}
      style={{ backgroundColor: color ?? "#6366f1" }}
    >
      {initials(name)}
    </div>
  );
}
