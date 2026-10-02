import type { AnalysisResult, ChartSpec, Fact } from "./types.ts";
import { fmtNumber, fmtP, fmtPct, parseNumber } from "./format.ts";
import { mean, median, minMax, stdev } from "./stats.ts";

const POSITIVE = new Set(["y", "yes", "true", "approved", "1", "success", "paid", "good"]);

function questionContainsTerm(question: string, term: string): boolean {
  const escaped = term.toLowerCase().replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  return new RegExp(`(^|[^a-z0-9])${escaped}($|[^a-z0-9])`, "i").test(question);
}

function mentionedColumns(question: string, result: AnalysisResult): string[] {
  const q = question.toLowerCase();
  const hits: string[] = [];
  for (const name of result.cleanedNames) {
    const c = result.profile.columns.find((column) => column.name === name);
    const names = [name, c?.originalName, c?.originalName.replace(/_/g, " ")].filter(
      (value): value is string => Boolean(value),
    );
    if (names.some((n) => n.length > 2 && q.includes(n.toLowerCase()))) hits.push(name);
  }
  return hits;
}

function mentionedCategories(question: string, result: AnalysisResult): Map<string, string[]> {
  const q = question.toLowerCase();
  const matches = new Map<string, string[]>();
  for (const column of result.profile.columns) {
    if (column.kind === "numeric" || column.kind === "identifier") continue;
    const values = [...(column.topValues ?? []).map((item) => item.value), ...column.sampleValues];
    const found = [...new Set(values)].filter((value) => value.length > 2 && questionContainsTerm(q, value));
    if (found.length) matches.set(column.name, found);
  }
  return matches;
}

export function computeFacts(question: string, result: AnalysisResult): Fact[] {
  const q = question.toLowerCase();
  const facts: Fact[] = [
    { label: "Cleaned records", value: result.cleanedRowCount.toLocaleString() },
    { label: "Columns", value: String(result.cleanedColCount) },
    { label: "Source file", value: result.fileName },
  ];

  const cols = mentionedColumns(question, result);
  const categories = mentionedCategories(question, result);

  const wantsMean = /\b(mean|average|avg)\b/.test(q);
  const wantsMedian = /\bmedian\b/.test(q);
  const wantsSum = /\b(sum|total)\b/.test(q);
  const wantsMin = /\bmin(imum)?\b/.test(q);
  const wantsMax = /\bmax(imum)?\b/.test(q);
  const wantsMissing = /\bmiss(ing)?\b/.test(q);
  const wantsCorr = /\bcorr(elat(ion|ed))?\b/.test(q);
  const wantsRate = /\b(rate|approv(al|ed)?|proportion|percent(age)?|perform(s|ance)?|best|highest|lowest)\b/.test(q);

  for (const [name, values] of categories) {
    for (const value of values) {
      const count = result.cleanedRows.filter((row) => String(row[name] ?? "") === value).length;
      facts.push({
        label: `${value} records in ${name}`,
        value: `${count} of ${result.cleanedRowCount} cleaned records (${fmtPct((count / Math.max(1, result.cleanedRowCount)) * 100)}).`,
        columns: [name],
      });
    }
  }

  for (const name of cols) {
    const col = result.profile.columns.find((c) => c.name === name);
    const label = col?.originalName ?? name;
    const values = result.cleanedRows.map((row) => row[name]);
    const kind = col?.kind ?? (values.some((value) => typeof value === "number") ? "numeric" : "categorical");
    facts.push({
      label: `${label} type`,
      value: kind,
      columns: [name],
    });
    if (kind === "numeric") {
      const vals = values
        .map(parseNumber)
        .filter((n): n is number => n !== null);
      if (wantsMean || cols.length <= 2) {
        facts.push({ label: `Mean ${label}`, value: fmtNumber(mean(vals) ?? undefined), columns: [name] });
      }
      if (wantsMedian || cols.length <= 2) {
        facts.push({ label: `Median ${label}`, value: fmtNumber(median(vals) ?? undefined), columns: [name] });
      }
      if (wantsSum) {
        facts.push({
          label: `Sum ${label}`,
          value: fmtNumber(vals.reduce((a, b) => a + b, 0)),
          columns: [name],
        });
      }
      const mm = minMax(vals);
      if (wantsMin) facts.push({ label: `Min ${label}`, value: fmtNumber(mm?.min), columns: [name] });
      if (wantsMax) facts.push({ label: `Max ${label}`, value: fmtNumber(mm?.max), columns: [name] });
      if (wantsMean) {
        facts.push({ label: `Std ${label}`, value: fmtNumber(stdev(vals) ?? undefined), columns: [name] });
      }
    }
    if (wantsMissing) {
      const missingCount = col?.missingCount ?? values.filter((value) => value === null || value === undefined || value === "").length;
      const missingPct = col?.missingPct ?? (missingCount / Math.max(1, values.length)) * 100;
      facts.push({
        label: `Missing ${label}${col ? " (original)" : ""}`,
        value: `${missingCount} (${fmtPct(missingPct)})`,
        columns: [name],
      });
    }
    if (col?.topValues && kind !== "numeric") {
      facts.push({
        label: `Top ${label}`,
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
      const targetColumn = result.profile.columns.find((column) => column.name === target);
      const targetValues = [...new Set(result.cleanedRows.map((row) => String(row[target] ?? "Unknown")))];
      const positiveValue = targetValues.find((value) => POSITIVE.has(value.trim().toLowerCase())) ??
        (targetValues.length === 2 ? targetValues[0] : undefined);
      const rateColumns = categories.size
        ? [...categories.keys()]
        : cols.filter((name) => name !== target && result.profile.columns.find((column) => column.name === name)?.kind !== "numeric");
      const selectedRateColumns = rateColumns.length
        ? rateColumns
        : result.profile.columns
          .filter((column) => column.name !== target && (column.kind === "categorical" || column.kind === "boolean"))
            .slice(0, 4)
            .map((column) => column.name);

      if (positiveValue) {
        for (const name of selectedRateColumns.slice(0, 5)) {
          const groups = new Map<string, { total: number; positives: number }>();
          for (const row of result.cleanedRows) {
            const group = String(row[name] ?? "Unknown");
            const tally = groups.get(group) ?? { total: 0, positives: 0 };
            tally.total += 1;
            if (String(row[target] ?? "Unknown") === positiveValue) tally.positives += 1;
            groups.set(group, tally);
          }
          const rates = [...groups.entries()]
            .sort((a, b) => b[1].total - a[1].total)
            .slice(0, 12)
            .map(([group, tally]) => `${group}: ${fmtPct((tally.positives / Math.max(1, tally.total)) * 100)} (${tally.positives}/${tally.total})`)
            .join("; ");
          facts.push({
            label: `Observed ${positiveValue} rate by ${name}`,
            value: `${targetColumn?.originalName ?? target}=${positiveValue}; ${rates}. Calculated from ${result.cleanedRowCount} cleaned records.`,
            columns: [name, target],
          });
        }
      }

      const tests = result.statistics.associationTests.filter((test) => test.rateTable);
      for (const test of tests.slice(0, 4)) {
        facts.push({
          label: `${targetColumn?.originalName ?? target} association test by ${test.columns[0]}`,
          value: `${test.summary} p ${fmtP(test.pValue)}.`,
          columns: test.columns,
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

  for (const measure of result.customMeasures) {
    if (q.includes(measure.name.toLowerCase()) || cols.includes(measure.column)) {
      facts.push({
        label: `Measure ${measure.name}`,
        value: `${measure.aggregation} of ${measure.column}: ${fmtNumber(measure.value)}`,
        columns: [measure.column],
      });
    }
  }

  return facts.slice(0, 40);
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
