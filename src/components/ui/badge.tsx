import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

export function Badge({
  className,
  tone = "neutral",
  children,
}: {
  className?: string;
  tone?: "neutral" | "good" | "warn" | "bad" | "navy";
  children: ReactNode;
}) {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium",
        tone === "neutral" && "bg-bg-subtle text-ink-muted",
        tone === "good" && "bg-teal-soft text-teal",
        tone === "warn" && "bg-amber-soft text-amber",
        tone === "bad" && "bg-rose-soft text-rose",
        tone === "navy" && "bg-navy-soft text-navy",
        className,
      )}
    >
      {children}
    </span>
  );
}
