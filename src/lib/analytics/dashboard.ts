import type {
  ChartSpec,
  CleanedDataset,
  DashboardSpec,
  DatasetProfile,
  EdaResult,
  KpiCard,
  QualityReport,
} from "./types";
import { fmtNumber, fmtPct } from "./format";

const POSITIVE = new Set(["y", "yes", "true", "approved", "1", "success", "paid", "good"]);

export function buildDashboard(
  profile: DatasetProfile,
  cleaned: CleanedDataset,
  quality: QualityReport,
  eda: EdaResult,
): DashboardSpec {
  const kpis: KpiCard[] = [
    {
      id: "rows",
      label: "Cleaned records",
      value: cleaned.rows.length.toLocaleString(),
      hint: `from ${profile.rowCount.toLocaleString()} original`,
      tone: "neutral",
    },
    {
      id: "cols",
      label: "Columns",
      value: String(cleaned.names.length),
      tone: "neutral",
    },
    {
      id: "quality",
      label: "Quality score",
      value: String(quality.overallScore),
      hint: quality.overallLabel,
      tone: quality.overallScore >= 80 ? "good" : quality.overallScore >= 60 ? "warn" : "bad",
    },
    {
      id: "missing",
      label: "Avg. missing",
      value: fmtPct(
        profile.columns.reduce((s, c) => s + c.missingPct, 0) / Math.max(1, profile.columns.length),
      ),
      hint: "before imputation",
      tone:
        profile.columns.some((c) => c.missingPct >= 25) ? "warn" : "neutral",
    },
  ];

  const target = profile.columns.find((c) => c.name === profile.likelyTarget);
  if (target) {
    let pos = 0;
    let n = 0;
    for (const r of cleaned.rows) {
      n += 1;
      if (POSITIVE.has(String(r[target.name] ?? "").toLowerCase())) pos += 1;
    }
    const rate = n ? (pos / n) * 100 : 0;
    kpis.push({
      id: "target-rate",
      label: `${target.originalName} rate`,
      value: fmtPct(rate),
      hint: `${pos.toLocaleString()} of ${n.toLocaleString()}`,
      tone: "neutral",
    });
    kpis.push({
      id: "target-n",
      label: `Positive ${target.originalName}`,
      value: pos.toLocaleString(),
      tone: "good",
    });
  }

  const amount = profile.columns.find((c) => c.isLikelyAmount && c.kind === "numeric");
  if (amount) {
    let sum = 0;
    let cnt = 0;
    for (const r of cleaned.rows) {
      const v = r[amount.name];
      if (typeof v === "number") {
        sum += v;
        cnt += 1;
      }
    }
    kpis.push({
      id: "amount-sum",
      label: `Total ${amount.originalName}`,
      value: fmtNumber(sum),
      tone: "neutral",
    });
    kpis.push({
      id: "amount-avg",
      label: `Avg. ${amount.originalName}`,
      value: fmtNumber(amount.mean ?? (cnt ? sum / cnt : 0)),
      hint: `median ${fmtNumber(amount.median)}`,
      tone: "neutral",
    });
  }

  if (quality.duplicateCount > 0) {
    kpis.push({
      id: "dups",
      label: "Duplicates removed",
      value: quality.duplicateCount.toLocaleString(),
      tone: "warn",
    });
  }

  const charts: ChartSpec[] = eda.charts.slice(0, 8);
  const execIds = charts.filter((c) => ["target-mix", "rate-", "trend"].some((p) => c.id.startsWith(p) || c.id === p)).map((c) => c.id);
  const rest = charts.map((c) => c.id);

  const sections = [
    {
      id: "exec",
      title: "Executive summary",
      chartIds: execIds.length ? execIds.slice(0, 3) : rest.slice(0, 2),
      kpiIds: kpis.slice(0, 6).map((k) => k.id),
    },
    {
      id: "categories",
      title: "Category analysis",
      chartIds: charts.filter((c) => c.id.startsWith("cat-") || c.id.startsWith("rate-")).map((c) => c.id),
    },
    {
      id: "relationships",
      title: "Relationships",
      chartIds: charts.filter((c) => c.type === "scatter" || c.type === "heatmap").map((c) => c.id),
    },
    {
      id: "quality",
      title: "Data quality",
      chartIds: charts.filter((c) => c.id === "missingness" || c.type === "histogram").map((c) => c.id).slice(0, 3),
    },
  ].filter((s) => s.chartIds.length || s.kpiIds?.length);

  return { kpis: kpis.slice(0, 8), charts, sections };
}
