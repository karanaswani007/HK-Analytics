import { Badge } from "@/components/ui/badge";
import { Card, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { ChartCard } from "@/components/charts/render-chart";
import { fmtNumber, fmtPct } from "@/lib/analytics/format";
import { useAppStore } from "@/lib/store";

export function QualityPanel() {
  const result = useAppStore((s) => s.result)!;
  const q = result.quality;
  const missingChart = result.dashboard.charts.find((c) => c.id === "missingness");

  return (
    <div className="space-y-6">
      <div className="grid gap-3 sm:grid-cols-3">
        <Card className="p-4">
          <div className="text-xs uppercase tracking-wide text-ink-subtle">Quality score</div>
          <div className="mt-1 font-display text-3xl tabular">{q.overallScore}</div>
          <div className="text-sm text-ink-muted">{q.overallLabel}</div>
        </Card>
        <Card className="p-4">
          <div className="text-xs uppercase tracking-wide text-ink-subtle">Duplicates</div>
          <div className="mt-1 font-display text-3xl tabular">{q.duplicateCount}</div>
          <div className="text-sm text-ink-muted">Removed during cleaning</div>
        </Card>
        <Card className="p-4">
          <div className="text-xs uppercase tracking-wide text-ink-subtle">Empty rows / cols</div>
          <div className="mt-1 font-display text-3xl tabular">
            {q.emptyRowCount} / {q.emptyColumnCount}
          </div>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <div>
            <CardTitle>Issues</CardTitle>
            <CardDescription>Ranked by severity. Cleaning logs live on the next tab.</CardDescription>
          </div>
        </CardHeader>
        {q.issues.length === 0 ? (
          <p className="text-sm text-ink-muted">No material data-quality issues were flagged.</p>
        ) : (
          <ul className="space-y-3">
            {q.issues.map((issue, i) => (
              <li key={i} className="flex gap-3 rounded-xl bg-surface-2 p-3">
                <Badge tone={issue.severity === "high" ? "bad" : issue.severity === "medium" ? "warn" : "neutral"}>
                  {issue.severity}
                </Badge>
                <div>
                  <div className="text-sm font-medium">{issue.title}</div>
                  <p className="text-sm text-ink-muted">{issue.detail}</p>
                </div>
              </li>
            ))}
          </ul>
        )}
      </Card>

      {missingChart ? <ChartCard chart={missingChart} /> : null}

      {q.outlierReports.length ? (
        <Card>
          <CardHeader>
            <div>
              <CardTitle>Outliers (IQR)</CardTitle>
              <CardDescription>Flagged only — not deleted.</CardDescription>
            </div>
          </CardHeader>
          <div className="overflow-x-auto">
            <table className="min-w-full text-sm">
              <thead className="text-left text-xs uppercase tracking-wide text-ink-muted">
                <tr>
                  <th className="pb-2 pr-3">Column</th>
                  <th className="pb-2 pr-3">Count</th>
                  <th className="pb-2 pr-3">Share</th>
                  <th className="pb-2">Fence</th>
                </tr>
              </thead>
              <tbody>
                {q.outlierReports.map((o) => (
                  <tr key={o.column} className="border-t border-line">
                    <td className="py-2 pr-3 font-medium">{o.column}</td>
                    <td className="py-2 pr-3 tabular">{o.count}</td>
                    <td className="py-2 pr-3 tabular">{fmtPct(o.pct)}</td>
                    <td className="py-2 tabular text-ink-muted">
                      {fmtNumber(o.lower)} – {fmtNumber(o.upper)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      ) : null}
    </div>
  );
}
