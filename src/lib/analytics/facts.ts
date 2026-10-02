import type { AnalysisResult, ChartSpec, Fact } from "./types";
import { fmtNumber, fmtP, fmtPct, parseNumber } from "./format";
import { mean, median, minMax, stdev } from "./stats";

function mentionedColumns(question: string, result: AnalysisResult): string[] {
  const q = question.toLowerCase();
  const hits: string[] = [];
  for (const c of result.profile.columns) {
    const names = [c.name, c.originalName, c.originalName.replace(/_/g, " ")];
    if (names.some((n) => n.length > 2 && q.includes(n.toLowerCase()))) hits.push(c.name);
  }
  return hits;
}

export function computeFacts(question: string, result: AnalysisResult): Fact[] {
  const q = question.toLowerCase();
  const facts: Fact[] = [
    { label: "Cleaned records", value: result.cleanedRowCount.toLocaleString() },
    { label: "Columns", value: String(result.cleanedColCount) },
    { label: "Source file", value: result.fileName },
  ];

  const cols = mentionedColumns(question, result);

  const wantsMean = /\b(mean|average|avg)\b/.test(q);
  const wantsMedian = /\bmedian\b/.test(q);
  const wantsSum = /\b(sum|total)\b/.test(q);
  const wantsMin = /\bmin(imum)?\b/.test(q);
  const wantsMax = /\bmax(imum)?\b/.test(q);
  const wantsMissing = /\bmiss(ing)?\b/.test(q);
  const wantsCorr = /\bcorr(elat(ion|ed))?\b/.test(q);
  const wantsRate = /\b(rate|approval|proportion|percent|percentage)\b/.test(q);

  for (const name of cols) {
    const col = result.profile.columns.find((c) => c.name === name);
    if (!col) continue;
    facts.push({
      label: `${col.originalName} type`,
      value: col.kind,
      columns: [name],
    });
    if (col.kind === "numeric") {
      const vals = result.cleanedRows
        .map((r) => parseNumber(r[name]))
        .filter((n): n is number => n !== null);
      if (wantsMean || cols.length <= 2) {
        facts.push({ label: `Mean ${col.originalName}`, value: fmtNumber(mean(vals) ?? undefined), columns: [name] });
      }
      if (wantsMedian || cols.length <= 2) {
        facts.push({ label: `Median ${col.originalName}`, value: fmtNumber(median(vals) ?? undefined), columns: [name] });
      }
      if (wantsSum) {
        facts.push({
          label: `Sum ${col.originalName}`,
          value: fmtNumber(vals.reduce((a, b) => a + b, 0)),
          columns: [name],
        });
      }
      const mm = minMax(vals);
      if (wantsMin) facts.push({ label: `Min ${col.originalName}`, value: fmtNumber(mm?.min), columns: [name] });
      if (wantsMax) facts.push({ label: `Max ${col.originalName}`, value: fmtNumber(mm?.max), columns: [name] });
      if (wantsMean) {
        facts.push({ label: `Std ${col.originalName}`, value: fmtNumber(stdev(vals) ?? undefined), columns: [name] });
      }
    }
    if (wantsMissing) {
      facts.push({
        label: `Missing ${col.originalName} (original)`,
        value: `${col.missingCount} (${fmtPct(col.missingPct)})`,
        columns: [name],
      });
    }
    if (col.topValues && col.kind !== "numeric") {
      facts.push({
        label: `Top ${col.originalName}`,
        value: col.topValues.slice(0, 5).map((t) => `${t.value} ${fmtPct(t.pct)}`).join("; "),
        columns: [name],
      });
    }
  }

  if (wantsCorr) {
    const list =
      cols.length >= 2
        ? result.statistics.correlations.filter((c) => cols.includes(c.a) && cols.includes(c.b))
        : result.statistics.correlations.slice(0, 5);
    for (const c of list.slice(0, 5)) {
      facts.push({
        label: `Correlation ${c.a} × ${c.b}`,
        value: `Pearson r=${c.pearson.toFixed(2)}, Spearman ρ=${c.spearman.toFixed(2)}, n=${c.n}`,
        columns: [c.a, c.b],
      });
    }
  }

  if (wantsRate || /status|approved|approval/.test(q)) {
    const target = result.profile.likelyTarget;
    if (target) {
      const tcol = result.profile.columns.find((c) => c.name === target);
      const tests = result.statistics.associationTests.filter((t) => t.rateTable);
      for (const t of tests.slice(0, 4)) {
        facts.push({
          label: `${tcol?.originalName ?? target} rates by ${t.columns[0]}`,
          value: (t.rateTable ?? [])
            .map((g) => `${g.group}: ${fmtPct(g.rate * 100)} (${g.positives}/${g.n}), p ${fmtP(t.pValue)}`)
            .join("; "),
          columns: t.columns,
        });
      }
    }
  }

  if (/insight|summary|important|executive|key finding/.test(q)) {
    for (const i of result.insights.slice(0, 6)) {
      facts.push({
        label: i.title,
        value: `${i.supportingMetric}. ${i.explanation}`,
        columns: i.supportingColumns,
      });
    }
  }

  if (/quality|missing|duplicate|outlier/.test(q)) {
    facts.push({
      label: "Quality score",
      value: `${result.quality.overallScore} (${result.quality.overallLabel})`,
    });
    facts.push({
      label: "Duplicates removed",
      value: String(result.quality.duplicateCount),
    });
    for (const issue of result.quality.issues.slice(0, 6)) {
      facts.push({ label: issue.title, value: issue.detail, columns: issue.column ? [issue.column] : undefined });
    }
  }

  return facts.slice(0, 24);
}

export function chartFacts(chart: ChartSpec): Fact[] {
  const facts: Fact[] = [
    { label: "Chart", value: chart.title },
    { label: "Type", value: chart.type },
    { label: "What it shows", value: chart.description },
  ];
  if (chart.note) facts.push({ label: "Note", value: chart.note });
  if (chart.heatmap) {
    facts.push({
      label: "Matrix size",
      value: `${chart.heatmap.x.length} × ${chart.heatmap.y.length}`,
    });
    return facts;
  }
  const yKey = chart.yKey ?? "count";
  const rows = chart.data.slice(0, 16).map((d) => {
    const x = d[chart.xKey];
    const y = d[yKey];
    return `${String(x)}: ${typeof y === "number" ? fmtNumber(y) : String(y ?? "")}`;
  });
  if (rows.length) facts.push({ label: "Aggregated values", value: rows.join("; ") });
  return facts;
}

export const SUGGESTED_QUESTIONS = [
  "Give me an executive summary.",
  "What are the most important insights?",
  "What are the major data-quality issues?",
  "Which variables are strongly correlated?",
  "Which category performs best?",
  "What should I investigate next?",
];
