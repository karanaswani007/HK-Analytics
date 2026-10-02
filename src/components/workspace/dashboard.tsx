import { ChartCard } from "@/components/charts/render-chart";
import { useAppStore } from "@/lib/store";
import { KpiGrid } from "./kpi-grid";
import { useExplain } from "./use-explain";

export function DashboardPanel() {
  const result = useAppStore((s) => s.result)!;
  const explain = useExplain();
  return (
    <div className="space-y-6">
      <div>
        <h2 className="font-display text-2xl font-medium tracking-tight">Executive dashboard</h2>
        <p className="mt-1 text-sm text-ink-muted">
          A compact visual set ranked by usefulness for this schema — not a chart dump.
        </p>
      </div>
      <KpiGrid kpis={result.dashboard.kpis} />
      {result.dashboard.sections.map((section) => {
        const charts = result.dashboard.charts.filter((c) => section.chartIds.includes(c.id));
        if (!charts.length) return null;
        return (
          <section key={section.id} className="space-y-3">
            <h3 className="font-display text-lg font-medium">{section.title}</h3>
            <div className="grid gap-4 lg:grid-cols-2">
              {charts.map((c) => (
                <ChartCard key={c.id} chart={c} onExplain={explain} />
              ))}
            </div>
          </section>
        );
      })}
    </div>
  );
}
