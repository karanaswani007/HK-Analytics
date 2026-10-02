import { Badge } from "@/components/ui/badge";
import { Card, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { DataTable } from "@/components/data-table";
import { fmtPct } from "@/lib/analytics/format";
import { useAppStore } from "@/lib/store";
import { KpiGrid } from "./kpi-grid";

export function OverviewPanel() {
  const result = useAppStore((s) => s.result)!;
  const setTab = useAppStore((s) => s.setTab);
  const topInsights = result.insights.slice(0, 4);

  return (
    <div className="space-y-6">
      {result.warnings.length ? (
        <p className="rounded-xl bg-amber-soft px-4 py-3 text-sm text-amber">{result.warnings.join(" ")}</p>
      ) : null}
      <KpiGrid kpis={result.dashboard.kpis.slice(0, 4)} />
      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <div>
              <CardTitle>Dataset profile</CardTitle>
              <CardDescription>Inferred types from the original file, before imputation.</CardDescription>
            </div>
          </CardHeader>
          <div className="overflow-x-auto">
            <table className="min-w-full text-sm">
              <thead className="text-left text-xs uppercase tracking-wide text-ink-muted">
                <tr>
                  <th className="pb-2 pr-3">Column</th>
                  <th className="pb-2 pr-3">Kind</th>
                  <th className="pb-2 pr-3">Missing</th>
                  <th className="pb-2">Unique</th>
                </tr>
              </thead>
              <tbody>
                {result.profile.columns.map((c) => (
                  <tr key={c.name} className="border-t border-line">
                    <td className="py-2 pr-3 font-medium">{c.originalName}</td>
                    <td className="py-2 pr-3">
                      <Badge tone={c.kind === "identifier" ? "navy" : "neutral"}>{c.kind}</Badge>
                    </td>
                    <td className="py-2 pr-3 tabular">{fmtPct(c.missingPct)}</td>
                    <td className="py-2 tabular">{c.uniqueCount}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
        <Card>
          <CardHeader>
            <div>
              <CardTitle>Headline insights</CardTitle>
              <CardDescription>Computed from the cleaned table, then ranked.</CardDescription>
            </div>
            <button type="button" className="text-xs font-medium text-navy" onClick={() => setTab("insights")}>
              All insights
            </button>
          </CardHeader>
          <ul className="space-y-3">
            {topInsights.map((i) => (
              <li key={i.id} className="rounded-xl bg-surface-2 p-3">
                <div className="flex items-center gap-2">
                  <Badge tone={i.strength === "high" ? "navy" : "neutral"}>{i.category}</Badge>
                  <span className="text-xs text-ink-subtle">{i.supportingMetric}</span>
                </div>
                <p className="mt-1 text-sm font-medium text-ink">{i.title}</p>
              </li>
            ))}
          </ul>
        </Card>
      </div>
      <Card>
        <CardHeader>
          <div>
            <CardTitle>Cleaned preview</CardTitle>
            <CardDescription>First rows after documented cleaning. Original upload is unchanged.</CardDescription>
          </div>
        </CardHeader>
        <DataTable rows={result.previewCleaned} columns={result.cleanedNames} maxRows={8} />
      </Card>
    </div>
  );
}
