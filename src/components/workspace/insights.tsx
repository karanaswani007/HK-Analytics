import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { useAppStore } from "@/lib/store";

export function InsightsPanel() {
  const result = useAppStore((s) => s.result)!;
  return (
    <div className="space-y-3">
      <p className="text-sm text-ink-muted">
        Each finding is computed first, then written in plain language. Strength reflects statistical
        support in this sample — not a business guarantee.
      </p>
      {result.insights.map((i) => (
        <Card key={i.id} className="p-5">
          <div className="flex flex-wrap items-center gap-2">
            <Badge tone={i.strength === "high" ? "navy" : i.strength === "medium" ? "warn" : "neutral"}>
              {i.category}
            </Badge>
            <Badge>{i.strength}</Badge>
            <span className="text-xs tabular text-ink-subtle">{i.supportingMetric}</span>
          </div>
          <h3 className="mt-2 font-display text-lg font-medium tracking-tight">{i.title}</h3>
          <p className="mt-2 text-sm text-ink-muted">{i.explanation}</p>
          {i.supportingColumns.length ? (
            <p className="mt-2 text-xs text-ink-subtle">Columns: {i.supportingColumns.join(", ")}</p>
          ) : null}
          {i.caveat ? (
            <p className="mt-2 rounded-lg bg-amber-soft px-3 py-2 text-xs text-amber">{i.caveat}</p>
          ) : null}
        </Card>
      ))}
    </div>
  );
}
