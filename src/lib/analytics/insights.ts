import type {
  AnalysisResult,
  CleanedDataset,
  DatasetProfile,
  EdaResult,
  Insight,
  QualityReport,
  StatsResult,
} from "./types";
import { fmtNumber, fmtP, fmtPct, round } from "./format";
import { pearsonP } from "./stats";

export function buildQuality(
  profile: DatasetProfile,
  outliers: QualityReport["outlierReports"],
): QualityReport {
  const issues: QualityReport["issues"] = [];
  if (profile.duplicateCount > 0) {
    issues.push({
      severity: profile.duplicateCount / profile.rowCount > 0.05 ? "high" : "medium",
      title: "Duplicate rows",
      detail: `${profile.duplicateCount.toLocaleString()} duplicate row${profile.duplicateCount === 1 ? "" : "s"} (${fmtPct((profile.duplicateCount / profile.rowCount) * 100)} of original rows).`,
    });
  }
  for (const c of profile.columns) {
    if (c.missingPct >= 20) {
      issues.push({
        severity: c.missingPct >= 40 ? "high" : "medium",
        title: `High missingness in ${c.originalName}`,
        detail: `${c.missingCount.toLocaleString()} missing (${fmtPct(c.missingPct)}).`,
        column: c.name,
      });
    } else if (c.missingPct > 0 && c.missingPct < 20 && c.missingCount >= 5) {
      issues.push({
        severity: "low",
        title: `Missing values in ${c.originalName}`,
        detail: `${c.missingCount.toLocaleString()} missing (${fmtPct(c.missingPct)}).`,
        column: c.name,
      });
    }
    if (c.isConstant) {
      issues.push({
        severity: "medium",
        title: `${c.originalName} is constant`,
        detail: "This column has a single unique value and adds no variation.",
        column: c.name,
      });
    }
  }
  for (const o of outliers) {
    if (o.pct >= 2) {
      issues.push({
        severity: o.pct >= 8 ? "medium" : "low",
        title: `Outliers in ${o.column}`,
        detail: `${o.count.toLocaleString()} values (${fmtPct(o.pct)}) sit outside the 1.5×IQR fence. They were flagged, not removed.`,
        column: o.column,
      });
    }
  }

  let score = 100;
  score -= Math.min(30, (profile.columns.reduce((s, c) => s + c.missingPct, 0) / Math.max(1, profile.columns.length)) * 0.8);
  score -= Math.min(15, (profile.duplicateCount / Math.max(1, profile.rowCount)) * 100);
  score -= Math.min(10, outliers.filter((o) => o.pct > 5).length * 3);
  score -= issues.filter((i) => i.severity === "high").length * 6;
  score = Math.max(25, Math.min(98, Math.round(score)));
  const overallLabel = score >= 85 ? "Healthy" : score >= 70 ? "Usable with caveats" : score >= 50 ? "Needs attention" : "Poor";

  return {
    issues: issues.sort((a, b) => severityRank(a.severity) - severityRank(b.severity)).slice(0, 18),
    missingByColumn: profile.columns
      .filter((c) => c.missingCount > 0)
      .map((c) => ({ column: c.originalName, missing: c.missingCount, pct: c.missingPct }))
      .sort((a, b) => b.pct - a.pct),
    duplicateCount: profile.duplicateCount,
    emptyRowCount: profile.emptyRowCount,
    emptyColumnCount: profile.emptyColumnCount,
    outlierReports: outliers,
    constantColumns: profile.columns.filter((c) => c.isConstant).map((c) => c.originalName),
    identifierColumns: profile.identifierColumns,
    overallScore: score,
    overallLabel,
  };
}

function severityRank(s: "high" | "medium" | "low"): number {
  return s === "high" ? 0 : s === "medium" ? 1 : 2;
}

export function generateInsights(
  profile: DatasetProfile,
  cleaned: CleanedDataset,
  quality: QualityReport,
  stats: StatsResult,
  eda: EdaResult,
): Insight[] {
  const insights: Insight[] = [];
  const n = cleaned.rows.length;

  insights.push({
    id: "size",
    title: `Analyzed ${n.toLocaleString()} cleaned records across ${cleaned.names.length} columns`,
    category: "Key Finding",
    explanation: `The original file had ${profile.rowCount.toLocaleString()} rows and ${profile.columnCount} columns. After removing empty and duplicate rows, ${n.toLocaleString()} records remain for analysis.`,
    supportingMetric: `${n.toLocaleString()} rows`,
    supportingColumns: [],
    strength: "high",
  });

  if (quality.duplicateCount > 0) {
    insights.push({
      id: "dups",
      title: `${quality.duplicateCount.toLocaleString()} duplicate rows were removed`,
      category: "Data Quality",
      explanation: `Exact duplicate rows can inflate counts and rates. They were dropped during cleaning so metrics reflect unique records.`,
      supportingMetric: `${quality.duplicateCount} duplicates`,
      supportingColumns: [],
      strength: quality.duplicateCount / profile.rowCount > 0.05 ? "high" : "medium",
    });
  }

  const highMissing = quality.missingByColumn.filter((c) => c.pct >= 10);
  if (highMissing.length) {
    const top = highMissing[0]!;
    insights.push({
      id: "missing",
      title: `${top.column} is missing ${fmtPct(top.pct)} of original values`,
      category: "Data Quality",
      explanation: `Missingness is concentrated in ${highMissing.map((c) => c.column).slice(0, 4).join(", ")}. Numeric gaps were filled with medians; categorical gaps used mode or “Unknown”. Imputation preserves row count but can dampen real variation.`,
      supportingMetric: fmtPct(top.pct),
      supportingColumns: highMissing.slice(0, 4).map((c) => c.column),
      strength: top.pct >= 25 ? "high" : "medium",
      caveat: "Imputed values are estimates, not observed measurements.",
    });
  }

  for (const o of quality.outlierReports.filter((x) => x.pct >= 2).slice(0, 3)) {
    const col = profile.columns.find((c) => c.name === o.column);
    insights.push({
      id: `out-${o.column}`,
      title: `${fmtPct(o.pct)} of ${col?.originalName ?? o.column} values are statistical outliers`,
      category: "Outlier",
      explanation: `${o.count.toLocaleString()} values fall outside the IQR fence [${fmtNumber(o.lower)}, ${fmtNumber(o.upper)}]. Examples: ${o.examples.map((x) => fmtNumber(x)).join(", ")}. Outliers were kept; they may be errors or legitimate extremes.`,
      supportingMetric: `${o.count} outliers`,
      supportingColumns: [o.column],
      strength: o.pct >= 8 ? "high" : "medium",
      caveat: "Outliers were not deleted. Investigate before treating them as errors.",
    });
  }

  const target = profile.columns.find((c) => c.name === profile.likelyTarget);
  if (target) {
    const counts = new Map<string, number>();
    for (const r of cleaned.rows) {
      const k = String(r[target.name] ?? "Unknown");
      counts.set(k, (counts.get(k) ?? 0) + 1);
    }
    const ranked = [...counts.entries()].sort((a, b) => b[1] - a[1]);
    const majority = ranked[0]!;
    insights.push({
      id: "target-mix",
      title: `${target.originalName} is ${fmtPct((majority[1] / n) * 100)} “${majority[0]}”`,
      category: "Key Finding",
      explanation: ranked
        .map(([k, v]) => `${k}: ${v.toLocaleString()} (${fmtPct((v / n) * 100)})`)
        .join(". ") + ".",
      supportingMetric: fmtPct((majority[1] / n) * 100),
      supportingColumns: [target.name],
      strength: "high",
    });
  }

  for (const t of stats.associationTests.filter((x) => x.pValue < 0.05).slice(0, 5)) {
    if (t.rateTable && t.rateTable.length >= 2) {
      const sorted = [...t.rateTable].sort((a, b) => b.rate - a.rate);
      const best = sorted[0]!;
      const worst = sorted[sorted.length - 1]!;
      const cat = t.columns[0]!;
      const tgt = t.columns[1]!;
      const catLabel = profile.columns.find((c) => c.name === cat)?.originalName ?? cat;
      const tgtLabel = profile.columns.find((c) => c.name === tgt)?.originalName ?? tgt;
      insights.push({
        id: `assoc-${cat}`,
        title: `${catLabel} is associated with ${tgtLabel}`,
        category: "Comparison",
        explanation: `In this dataset, “${best.group}” shows a ${fmtPct(best.rate * 100)} rate (${best.positives.toLocaleString()} of ${best.n.toLocaleString()}), versus ${fmtPct(worst.rate * 100)} for “${worst.group}” (${worst.positives.toLocaleString()} of ${worst.n.toLocaleString()}). Chi-square p-value ${fmtP(t.pValue)} on ${t.n.toLocaleString()} records.`,
        supportingMetric: `${fmtPct(best.rate * 100)} vs ${fmtPct(worst.rate * 100)}`,
        supportingColumns: [cat, tgt],
        strength: t.pValue < 0.01 ? "high" : "medium",
        caveat: "This is an association in the observed table, not evidence that one field causes the other.",
      });
    } else if (t.groupStats && t.pValue < 0.05) {
      const sorted = [...t.groupStats].sort((a, b) => b.mean - a.mean);
      const hi = sorted[0]!;
      const lo = sorted[sorted.length - 1]!;
      const num = t.columns[0]!;
      const cat = t.columns[1]!;
      insights.push({
        id: `mean-${num}-${cat}`,
        title: `${label(profile, num)} differs by ${label(profile, cat)}`,
        category: "Comparison",
        explanation: `Mean ${label(profile, num)} is ${fmtNumber(hi.mean)} for “${hi.group}” (n=${hi.n.toLocaleString()}) versus ${fmtNumber(lo.mean)} for “${lo.group}” (n=${lo.n.toLocaleString()}). Test p-value ${fmtP(t.pValue)}.`,
        supportingMetric: `${fmtNumber(hi.mean)} vs ${fmtNumber(lo.mean)}`,
        supportingColumns: [num, cat],
        strength: t.pValue < 0.01 ? "high" : "medium",
        caveat: "A significant group difference is not a causal claim.",
      });
    }
  }

  for (const c of stats.correlations.filter((x) => Math.abs(x.pearson) >= 0.4).slice(0, 4)) {
    const p = pearsonP(c.pearson, c.n);
    insights.push({
      id: `corr-${c.a}-${c.b}`,
      title: `${label(profile, c.a)} and ${label(profile, c.b)} move together`,
      category: "Correlation",
      explanation: `Pearson r = ${round(c.pearson, 2)} (Spearman ρ = ${round(c.spearman, 2)}) on ${c.n.toLocaleString()} paired observations${p < 0.05 ? `, p ${fmtP(p)}` : ""}. ${c.pearson > 0 ? "Higher values of one tend to accompany higher values of the other." : "Higher values of one tend to accompany lower values of the other."}`,
      supportingMetric: `r = ${round(c.pearson, 2)}`,
      supportingColumns: [c.a, c.b],
      strength: Math.abs(c.pearson) >= 0.6 ? "high" : "medium",
      caveat: "Correlation is not causation. A third factor may drive both series.",
    });
  }

  for (const col of profile.columns.filter((c) => c.kind === "numeric" && c.skewness !== undefined && Math.abs(c.skewness) >= 1.2).slice(0, 2)) {
    insights.push({
      id: `skew-${col.name}`,
      title: `${col.originalName} is ${col.skewness! > 0 ? "right" : "left"}-skewed`,
      category: "Trend",
      explanation: `Skewness is ${round(col.skewness!, 2)}. Mean ${fmtNumber(col.mean)} sits ${col.skewness! > 0 ? "above" : "below"} the median ${fmtNumber(col.median)}, so a handful of extreme values pull the average.`,
      supportingMetric: `skew ${round(col.skewness!, 2)}`,
      supportingColumns: [col.name],
      strength: Math.abs(col.skewness!) >= 2 ? "high" : "medium",
      caveat: "Prefer the median when summarizing this field.",
    });
  }

  const trend = eda.timeSeries[0];
  if (trend && trend.points.length >= 4) {
    const pts = trend.points;
    const first = pts[0]!;
    const last = pts[pts.length - 1]!;
    const change = first.value === 0 ? null : ((last.value - first.value) / Math.abs(first.value)) * 100;
    insights.push({
      id: "trend",
      title:
        change === null
          ? `${label(profile, trend.metric)} over time`
          : `${label(profile, trend.metric)} ${change >= 0 ? "rose" : "fell"} ${fmtPct(Math.abs(change))} from first to last ${trend.grain}`,
      category: "Trend",
      explanation: `Using ${label(profile, trend.column)}, the series runs ${first.period} (${fmtNumber(first.value)}) to ${last.period} (${fmtNumber(last.value)}) at a ${trend.grain} grain.`,
      supportingMetric: change === null ? fmtNumber(last.value) : fmtPct(change),
      supportingColumns: [trend.column, trend.metric],
      strength: "medium",
      caveat: "Seasonality was not formally tested; treat short series as descriptive.",
    });
  }

  if (target) {
    insights.push({
      id: "next",
      title: `Investigate the strongest ${target.originalName} split next`,
      category: "Recommendation",
      explanation: `Focus on fields with low p-values against ${target.originalName}, then check whether missingness or outliers in those fields could be driving the pattern. Validate on a later time period before acting.`,
      supportingMetric: target.originalName,
      supportingColumns: [target.name],
      strength: "medium",
      caveat: "Recommendations are descriptive next steps, not a decision model.",
    });
  } else {
    insights.push({
      id: "next",
      title: "No obvious target column was detected",
      category: "Recommendation",
      explanation: "Analysis focused on distributions, correlations, and data quality. If you have a business outcome (churn, approval, conversion), add it as a column and re-run.",
      supportingMetric: "n/a",
      supportingColumns: [],
      strength: "low",
    });
  }

  const amount = profile.columns.find((c) => c.isLikelyAmount && c.kind === "numeric");
  if (amount && amount.mean !== undefined) {
    insights.push({
      id: "amount",
      title: `${amount.originalName} averages ${fmtNumber(amount.mean)} (median ${fmtNumber(amount.median)})`,
      category: "Opportunity",
      explanation: `Range ${fmtNumber(amount.min)}–${fmtNumber(amount.max)} across ${n.toLocaleString()} cleaned rows. Use the median if the distribution is skewed.`,
      supportingMetric: fmtNumber(amount.median ?? amount.mean),
      supportingColumns: [amount.name],
      strength: "medium",
    });
  }

  const ranked = insights.sort((a, b) => rank(b.strength) - rank(a.strength));
  return ranked.slice(0, 14);
}

function rank(s: Insight["strength"]): number {
  return s === "high" ? 3 : s === "medium" ? 2 : 1;
}

function label(profile: DatasetProfile, name: string): string {
  return profile.columns.find((c) => c.name === name)?.originalName ?? name;
}

export function compactContext(result: AnalysisResult): string {
  const cols = result.profile.columns.map((c) => {
    const bits = [`${c.originalName} (${c.kind})`, `missing ${c.missingPct.toFixed(1)}%`, `unique ${c.uniqueCount}`];
    if (c.mean !== undefined) bits.push(`mean ${fmtNumber(c.mean)} median ${fmtNumber(c.median)}`);
    if (c.mode) bits.push(`mode ${c.mode}`);
    if (c.dateMin) bits.push(`${c.dateMin} → ${c.dateMax}`);
    return bits.join(", ");
  });
  const insights = result.insights
    .slice(0, 10)
    .map((i) => `[${i.category}] ${i.title} | ${i.supportingMetric} | ${i.explanation}${i.caveat ? " Caveat: " + i.caveat : ""}`)
    .join("\n");
  const tests = result.statistics.associationTests
    .slice(0, 8)
    .map((t) => t.summary)
    .join("\n");
  const corrs = result.statistics.correlations
    .slice(0, 8)
    .map((c) => `${c.a} ~ ${c.b}: r=${c.pearson.toFixed(2)} ρ=${c.spearman.toFixed(2)} n=${c.n}`)
    .join("\n");
  const kpis = result.dashboard.kpis.map((k) => `${k.label}: ${k.value}`).join("; ");
  const cleaning = result.cleaning.logs
    .filter((l) => l.rowsAffected > 0)
    .slice(0, 12)
    .map((l) => `${l.operation} ${l.column ?? ""} → ${l.rowsAffected} (${l.method})`)
    .join("\n");
  return [
    `Dataset: ${result.fileName}`,
    `Analyzed: ${result.analyzedAt}`,
    `Original: ${result.originalRowCount} rows × ${result.originalColCount} cols`,
    `Cleaned: ${result.cleanedRowCount} rows × ${result.cleanedColCount} cols`,
    `Quality score: ${result.quality.overallScore} (${result.quality.overallLabel})`,
    `KPIs: ${kpis}`,
    `Likely target: ${result.profile.likelyTarget ?? "none"}`,
    `Columns:\n${cols.join("\n")}`,
    `Cleaning:\n${cleaning}`,
    `Associations:\n${tests}`,
    `Correlations:\n${corrs}`,
    `Insights:\n${insights}`,
  ].join("\n\n");
}
