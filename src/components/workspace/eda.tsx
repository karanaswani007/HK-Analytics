import { ChartCard } from "@/components/charts/render-chart";
import { Card, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { fmtNumber, fmtP } from "@/lib/analytics/format";
import { useAppStore } from "@/lib/store";
import { useExplain } from "./use-explain";

export function EdaPanel() {
  const result = useAppStore((s) => s.result)!;
  const explain = useExplain();
  const tests = result.statistics.associationTests.slice(0, 8);
  const corrs = result.statistics.correlations.slice(0, 8);

  return (
    <div className="space-y-6">
      <div className="grid gap-4 lg:grid-cols-2">
        {result.eda.charts
          .filter((c) => c.type === "histogram" || c.id.startsWith("cat-") || c.type === "line")
          .map((c) => (
            <ChartCard key={c.id} chart={c} onExplain={explain} />
          ))}
      </div>

      <Card>
        <CardHeader>
          <div>
            <CardTitle>Correlations</CardTitle>
            <CardDescription>Pearson and Spearman on pairwise-complete numeric columns. Not causation.</CardDescription>
          </div>
        </CardHeader>
        {corrs.length === 0 ? (
          <p className="text-sm text-ink-muted">Not enough numeric pairs to estimate correlation.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full text-sm">
              <thead className="text-left text-xs uppercase tracking-wide text-ink-muted">
                <tr>
                  <th className="pb-2 pr-3">Pair</th>
                  <th className="pb-2 pr-3">Pearson r</th>
                  <th className="pb-2 pr-3">Spearman ρ</th>
                  <th className="pb-2">n</th>
                </tr>
              </thead>
              <tbody>
                {corrs.map((c) => (
                  <tr key={`${c.a}-${c.b}`} className="border-t border-line">
                    <td className="py-2 pr-3">
                      {c.a} × {c.b}
                    </td>
                    <td className="py-2 pr-3 tabular">{c.pearson.toFixed(2)}</td>
                    <td className="py-2 pr-3 tabular">{c.spearman.toFixed(2)}</td>
                    <td className="py-2 tabular">{c.n}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      <Card>
        <CardHeader>
          <div>
            <CardTitle>Group tests</CardTitle>
            <CardDescription>Chi-square, Welch t, Mann–Whitney, Kruskal–Wallis where assumptions allow.</CardDescription>
          </div>
        </CardHeader>
        {tests.length === 0 ? (
          <p className="text-sm text-ink-muted">No eligible group tests for this schema.</p>
        ) : (
          <ul className="space-y-3">
            {tests.map((t, i) => (
              <li key={i} className="rounded-xl bg-surface-2 p-3 text-sm">
                <div className="font-medium text-ink">
                  {t.type} · p {fmtP(t.pValue)} · n {t.n.toLocaleString()}
                </div>
                <p className="mt-1 text-ink-muted">{t.summary}</p>
                {t.groupStats?.length ? (
                  <p className="mt-1 text-xs text-ink-subtle">
                    {t.groupStats
                      .map((g) => `${g.group}: mean ${fmtNumber(g.mean)} (n=${g.n})`)
                      .join(" · ")}
                  </p>
                ) : null}
              </li>
            ))}
          </ul>
        )}
      </Card>
    </div>
  );
}
