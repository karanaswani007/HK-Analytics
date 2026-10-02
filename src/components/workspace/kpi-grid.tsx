import type { KpiCard } from "@/lib/analytics/types";
import { cn } from "@/lib/utils";

export function KpiGrid({ kpis }: { kpis: KpiCard[] }) {
  return (
    <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
      {kpis.map((k) => (
        <div key={k.id} className="rounded-2xl bg-surface p-4 shadow-[var(--shadow-border)]">
          <div className="text-xs font-medium uppercase tracking-wide text-ink-subtle">{k.label}</div>
          <div
            className={cn(
              "mt-1 font-display text-2xl font-medium tabular tracking-tight",
              k.tone === "good" && "text-teal",
              k.tone === "warn" && "text-amber",
              k.tone === "bad" && "text-rose",
              k.tone === "neutral" && "text-ink",
            )}
          >
            {k.value}
          </div>
          {k.hint ? <div className="mt-1 text-xs text-ink-subtle">{k.hint}</div> : null}
        </div>
      ))}
    </div>
  );
}
