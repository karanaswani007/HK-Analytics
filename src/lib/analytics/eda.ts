import type {
  AssociationTest,
  ChartSpec,
  CleanedDataset,
  ColumnProfile,
  CorrelationPair,
  DatasetProfile,
  EdaResult,
  GroupStat,
  StatsResult,
  TimePoint,
} from "./types";
import { parseDate, parseNumber, titleCase } from "./format";
import {
  chiSquareFromTable,
  histogram,
  kruskalWallis,
  mannWhitney,
  mean,
  median,
  pearson,
  spearman,
  welchT,
} from "./stats";

const POSITIVE = new Set(["y", "yes", "true", "approved", "1", "success", "paid", "good"]);

function numericSeries(rows: Record<string, unknown>[], name: string): number[] {
  return rows.map((r) => (typeof r[name] === "number" ? (r[name] as number) : NaN));
}

function catSeries(rows: Record<string, unknown>[], name: string): string[] {
  return rows.map((r) => String(r[name] ?? "Unknown"));
}

function isPositive(v: string): boolean {
  return POSITIVE.has(v.trim().toLowerCase());
}

export function computeStatistics(
  cleaned: CleanedDataset,
  profile: DatasetProfile,
): StatsResult {
  const numericCols = profile.columns.filter(
    (c) => c.kind === "numeric" && !c.isIdentifier && cleaned.names.includes(c.name),
  );
  const catCols = profile.columns.filter(
    (c) =>
      (c.kind === "categorical" || c.kind === "boolean") &&
      c.uniqueCount >= 2 &&
      c.uniqueCount <= 12 &&
      !c.isIdentifier &&
      cleaned.names.includes(c.name),
  );

  const limitedNumeric = numericCols.slice(0, 10);
  const correlations: CorrelationPair[] = [];
  for (let i = 0; i < limitedNumeric.length; i++) {
    for (let j = i + 1; j < limitedNumeric.length; j++) {
      const a = limitedNumeric[i]!.name;
      const b = limitedNumeric[j]!.name;
      const xs = numericSeries(cleaned.rows, a);
      const ys = numericSeries(cleaned.rows, b);
      const r = pearson(xs, ys);
      const s = spearman(xs, ys);
      if (r === null || s === null) continue;
      const n = xs.filter((x, k) => Number.isFinite(x) && Number.isFinite(ys[k]!)).length;
      correlations.push({ a, b, pearson: r, spearman: s, n });
    }
  }
  correlations.sort((x, y) => Math.abs(y.pearson) - Math.abs(x.pearson));

  const associationTests: AssociationTest[] = [];
  const target = profile.likelyTarget;
  const targetCol = target ? catCols.find((c) => c.name === target) : undefined;

  if (targetCol) {
    const y = catSeries(cleaned.rows, targetCol.name);
    const levels = [...new Set(y)];
    const binary = levels.length === 2;

    for (const cat of catCols) {
      if (cat.name === targetCol.name) continue;
      const x = catSeries(cleaned.rows, cat.name);
      const xLevels = [...new Set(x)].slice(0, 8);
      const yLevels = levels.slice(0, 6);
      const table = xLevels.map((xl) =>
        yLevels.map((yl) => x.filter((v, i) => v === xl && y[i] === yl).length),
      );
      const chi = chiSquareFromTable(table);
      if (!chi || !chi.ok) continue;

      const test: AssociationTest = {
        type: "chi-square",
        columns: [cat.name, targetCol.name],
        statistic: chi.chi2,
        pValue: chi.p,
        dof: chi.dof,
        n: chi.n,
        summary: `Chi-square association between ${cat.originalName} and ${targetCol.originalName} (χ²=${chi.chi2.toFixed(1)}, df=${chi.dof}, p=${chi.p < 0.001 ? "<0.001" : chi.p.toFixed(3)}). Association is not causation.`,
      };
      if (binary) {
        const posLabel = levels.find((l) => isPositive(l)) ?? levels[0]!;
        test.rateTable = xLevels.map((g) => {
          const idx = x.map((v, i) => (v === g ? i : -1)).filter((i) => i >= 0);
          const n = idx.length;
          const positives = idx.filter((i) => y[i] === posLabel).length;
          return { group: g, n, positives, rate: n ? positives / n : 0 };
        });
      }
      associationTests.push(test);
    }

    for (const num of numericCols.slice(0, 8)) {
      const groups = new Map<string, number[]>();
      for (const row of cleaned.rows) {
        const g = String(row[targetCol.name] ?? "Unknown");
        const v = row[num.name];
        if (typeof v !== "number") continue;
        const arr = groups.get(g) ?? [];
        arr.push(v);
        groups.set(g, arr);
      }
      const entries = [...groups.entries()];
      const groupStats: GroupStat[] = entries.map(([group, vals]) => ({
        group,
        n: vals.length,
        mean: mean(vals) ?? 0,
        median: median(vals) ?? 0,
      }));
      if (entries.length === 2) {
        const t = welchT(entries[0]![1], entries[1]![1]);
        const mw = mannWhitney(entries[0]![1], entries[1]![1]);
        if (t) {
          associationTests.push({
            type: "welch-t",
            columns: [num.name, targetCol.name],
            statistic: t.t,
            pValue: t.p,
            dof: t.df,
            n: entries[0]![1].length + entries[1]![1].length,
            summary: `Mean ${num.originalName} differs across ${targetCol.originalName} groups (Welch t=${t.t.toFixed(2)}, p=${t.p < 0.001 ? "<0.001" : t.p.toFixed(3)}). This is a group difference, not a causal effect.`,
            groupStats,
          });
        } else if (mw) {
          associationTests.push({
            type: "mann-whitney",
            columns: [num.name, targetCol.name],
            statistic: mw.u,
            pValue: mw.p,
            n: entries[0]![1].length + entries[1]![1].length,
            summary: `Distribution of ${num.originalName} differs across ${targetCol.originalName} (Mann–Whitney U=${mw.u.toFixed(0)}, p=${mw.p < 0.001 ? "<0.001" : mw.p.toFixed(3)}).`,
            groupStats,
          });
        }
      } else if (entries.length >= 3) {
        const kw = kruskalWallis(entries.map((e) => e[1]));
        if (kw) {
          associationTests.push({
            type: "kruskal-wallis",
            columns: [num.name, targetCol.name],
            statistic: kw.h,
            pValue: kw.p,
            n: cleaned.rows.length,
            summary: `${num.originalName} distributions differ across ${targetCol.originalName} groups (Kruskal–Wallis H=${kw.h.toFixed(2)}, p=${kw.p < 0.001 ? "<0.001" : kw.p.toFixed(3)}).`,
            groupStats,
          });
        }
      }
    }
  }

  associationTests.sort((a, b) => a.pValue - b.pValue);

  return {
    correlations: correlations.slice(0, 20),
    associationTests: associationTests.slice(0, 16),
    numericSummaries: numericCols,
  };
}

function pickGrain(min: Date, max: Date): "day" | "month" | "year" {
  const days = (max.getTime() - min.getTime()) / 86400000;
  if (days <= 90) return "day";
  if (days <= 800) return "month";
  return "year";
}

function periodKey(d: Date, grain: "day" | "month" | "year"): string {
  const y = d.getUTCFullYear();
  const m = String(d.getUTCMonth() + 1).padStart(2, "0");
  const day = String(d.getUTCDate()).padStart(2, "0");
  if (grain === "year") return String(y);
  if (grain === "month") return `${y}-${m}`;
  return `${y}-${m}-${day}`;
}

export function runEda(
  cleaned: CleanedDataset,
  profile: DatasetProfile,
  stats: StatsResult,
): EdaResult {
  const charts: ChartSpec[] = [];
  const histograms = [];
  const categoryFrequencies = [];
  const timeSeries = [];

  const numericCols = profile.columns.filter(
    (c) => c.kind === "numeric" && !c.isIdentifier && cleaned.names.includes(c.name),
  );
  const catCols = profile.columns.filter(
    (c) =>
      (c.kind === "categorical" || c.kind === "boolean") &&
      c.uniqueCount >= 2 &&
      c.uniqueCount <= 16 &&
      !c.isIdentifier &&
      cleaned.names.includes(c.name),
  );

  const target = profile.columns.find((c) => c.name === profile.likelyTarget);

  if (target && (target.kind === "categorical" || target.kind === "boolean")) {
    const freq = countMap(cleaned.rows, target.name);
    charts.push({
      id: "target-mix",
      type: "bar",
      title: `${target.originalName} mix`,
      usefulness: 98,
      description: `Share of records by ${target.originalName}.`,
      xKey: "label",
      yKey: "count",
      xLabel: target.originalName,
      yLabel: "Records",
      data: freq.map((d) => ({ label: d.value, count: d.count, pct: d.pct })),
    });
  }

  for (const col of numericCols.slice(0, 5)) {
    const vals = numericSeries(cleaned.rows, col.name).filter(Number.isFinite);
    const bins = histogram(vals);
    histograms.push({ column: col.name, bins, skewness: col.skewness });
    charts.push({
      id: `hist-${col.name}`,
      type: "histogram",
      title: `Distribution of ${col.originalName}`,
      usefulness: col.isLikelyAmount ? 88 : 70,
      description: `Histogram of ${col.originalName} after cleaning.`,
      xKey: "label",
      yKey: "count",
      xLabel: col.originalName,
      yLabel: "Count",
      data: bins.map((b) => ({ label: b.label, count: b.count })),
      note: col.skewness !== undefined ? `Skewness ${col.skewness.toFixed(2)}` : undefined,
    });
  }

  for (const col of catCols.slice(0, 6)) {
    const freq = countMap(cleaned.rows, col.name);
    const rareCount = freq.filter((f) => f.pct < 5).length;
    categoryFrequencies.push({ column: col.name, values: freq, rareCount });
    if (col.name === target?.name) continue;
    charts.push({
      id: `cat-${col.name}`,
      type: "bar",
      title: `${col.originalName} frequency`,
      usefulness: 62,
      description: `Record counts by ${col.originalName}.`,
      xKey: "label",
      yKey: "count",
      xLabel: col.originalName,
      yLabel: "Records",
      data: freq.slice(0, 12).map((d) => ({ label: d.value, count: d.count, pct: d.pct })),
    });
  }

  if (target) {
    const rateTests = stats.associationTests.filter((t) => t.rateTable && t.pValue < 0.2);
    for (const t of rateTests.slice(0, 3)) {
      const cat = t.columns[0]!;
      const col = profile.columns.find((c) => c.name === cat);
      charts.push({
        id: `rate-${cat}`,
        type: "bar",
        title: `${target.originalName} rate by ${col?.originalName ?? cat}`,
        usefulness: 96 - t.pValue * 10,
        description: `Observed rate of the positive ${target.originalName} class in each group. Association, not causation.`,
        xKey: "label",
        yKey: "ratePct",
        xLabel: col?.originalName ?? cat,
        yLabel: "Rate %",
        data: (t.rateTable ?? []).map((g) => ({
          label: g.group,
          ratePct: Math.round(g.rate * 1000) / 10,
          n: g.n,
          positives: g.positives,
        })),
        note: `n=${t.n}. p=${t.pValue < 0.001 ? "<0.001" : t.pValue.toFixed(3)}`,
      });
    }
  }

  const dateCol = profile.columns.find((c) => c.kind === "datetime" && cleaned.names.includes(c.name));
  if (dateCol) {
    const amount =
      numericCols.find((c) => c.isLikelyAmount) ?? numericCols[0];
    const parsed: { d: Date; v: number }[] = [];
    for (const row of cleaned.rows) {
      const d = parseDate(row[dateCol.name]);
      if (!d) continue;
      const v = amount ? parseNumber(row[amount.name]) : 1;
      parsed.push({ d, v: v ?? 1 });
    }
    if (parsed.length >= 8) {
      parsed.sort((a, b) => a.d.getTime() - b.d.getTime());
      const grain = pickGrain(parsed[0]!.d, parsed[parsed.length - 1]!.d);
      const buckets = new Map<string, { value: number; n: number }>();
      for (const p of parsed) {
        const k = periodKey(p.d, grain);
        const cur = buckets.get(k) ?? { value: 0, n: 0 };
        cur.value += amount ? p.v : 1;
        cur.n += 1;
        buckets.set(k, cur);
      }
      const points: TimePoint[] = [...buckets.entries()]
        .sort(([a], [b]) => (a < b ? -1 : 1))
        .map(([period, v]) => ({ period, value: v.value, n: v.n }));
      timeSeries.push({
        column: dateCol.name,
        metric: amount ? amount.name : "count",
        grain,
        points,
      });
      charts.push({
        id: "trend",
        type: "line",
        title: amount
          ? `${amount.originalName} by ${grain}`
          : `Records by ${grain}`,
        usefulness: 90,
        description: `Time aggregation of ${amount ? amount.originalName : "record count"} using ${dateCol.originalName}.`,
        xKey: "period",
        yKey: "value",
        xLabel: titleCase(grain),
        yLabel: amount ? amount.originalName : "Records",
        data: points.map((p) => ({ period: p.period, value: p.value, n: p.n })),
      });
    }
  }

  const topCorr = stats.correlations.find((c) => Math.abs(c.pearson) >= 0.25);
  if (topCorr) {
    const a = topCorr.a;
    const b = topCorr.b;
    const sample: Record<string, string | number | null>[] = [];
    const step = Math.max(1, Math.floor(cleaned.rows.length / 700));
    for (let i = 0; i < cleaned.rows.length; i += step) {
      const row = cleaned.rows[i]!;
      const x = row[a];
      const y = row[b];
      if (typeof x === "number" && typeof y === "number") {
        sample.push({ x, y });
      }
    }
    charts.push({
      id: `scatter-${a}-${b}`,
      type: "scatter",
      title: `${labelOf(profile, a)} vs ${labelOf(profile, b)}`,
      usefulness: 80,
      description: `Sampled scatter of two numeric fields (Pearson r=${topCorr.pearson.toFixed(2)}). Correlation is not causation.`,
      xKey: "x",
      yKey: "y",
      xLabel: labelOf(profile, a),
      yLabel: labelOf(profile, b),
      data: sample,
      note: `n=${topCorr.n}`,
    });
  }

  if (numericCols.length >= 3) {
    const cols = numericCols.slice(0, 8);
    const z = cols.map((cy) =>
      cols.map((cx) => {
        if (cx.name === cy.name) return 1;
        const found = stats.correlations.find(
          (c) =>
            (c.a === cx.name && c.b === cy.name) || (c.a === cy.name && c.b === cx.name),
        );
        return found ? found.pearson : null;
      }),
    );
    charts.push({
      id: "corr-heatmap",
      type: "heatmap",
      title: "Numeric correlation matrix",
      usefulness: 78,
      description: "Pearson correlations among numeric columns. Darker |r| means a stronger linear association.",
      xKey: "x",
      yKey: "y",
      data: [],
      heatmap: {
        x: cols.map((c) => c.originalName),
        y: cols.map((c) => c.originalName),
        z,
      },
    });
  }

  const missing = profile.columns
    .filter((c) => c.missingPct > 0)
    .sort((a, b) => b.missingPct - a.missingPct)
    .slice(0, 12);
  if (missing.length) {
    charts.push({
      id: "missingness",
      type: "bar",
      title: "Missing values by column",
      usefulness: 74,
      description: "Percent of original rows with a missing value, before imputation.",
      xKey: "label",
      yKey: "pct",
      xLabel: "Column",
      yLabel: "Missing %",
      data: missing.map((c) => ({
        label: c.originalName,
        pct: Math.round(c.missingPct * 10) / 10,
        missing: c.missingCount,
      })),
    });
  }

  charts.sort((a, b) => b.usefulness - a.usefulness);
  return {
    histograms,
    categoryFrequencies,
    timeSeries,
    charts: charts.slice(0, 12),
  };
}

function countMap(rows: Record<string, unknown>[], name: string) {
  const m = new Map<string, number>();
  for (const r of rows) {
    const k = String(r[name] ?? "Unknown");
    m.set(k, (m.get(k) ?? 0) + 1);
  }
  const n = rows.length || 1;
  return [...m.entries()]
    .sort((a, b) => b[1] - a[1])
    .map(([value, count]) => ({ value, count, pct: (count / n) * 100 }));
}

function labelOf(profile: DatasetProfile, name: string): string {
  return profile.columns.find((c) => c.name === name)?.originalName ?? name;
}

export type { ColumnProfile };
