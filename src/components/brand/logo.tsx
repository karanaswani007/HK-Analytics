import { cn } from "@/lib/utils";

export function Mark({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 32 32" className={cn("size-8", className)} aria-hidden="true">
      <rect width="32" height="32" rx="8" fill="currentColor" />
      <rect x="7" y="16" width="4.5" height="9" rx="1" fill="#F3F1EC" />
      <rect x="13.75" y="11" width="4.5" height="14" rx="1" fill="#FFFCF7" />
      <rect x="20.5" y="7" width="4.5" height="18" rx="1" fill="#2A6B63" />
    </svg>
  );
}

export function Wordmark({ inverted = false }: { inverted?: boolean }) {
  return (
    <div className="flex items-center gap-2.5">
      <Mark className={inverted ? "text-navy-fg" : "text-navy"} />
      <div className="leading-tight">
        <div className={cn("text-sm font-semibold tracking-tight", inverted ? "text-navy-fg" : "text-ink")}>
          HK Analytics
        </div>
        <div className={cn("text-[11px] tracking-wide", inverted ? "text-navy-fg/70" : "text-ink-subtle")}>
          HK SoftTech
        </div>
      </div>
    </div>
  );
}
