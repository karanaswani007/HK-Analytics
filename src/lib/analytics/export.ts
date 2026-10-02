import type { AnalysisResult } from "./types";
import { asText } from "./format";

export function rowsToCsv(rows: Record<string, unknown>[], names: string[]): string {
  const esc = (v: unknown) => {
    const s = asText(v);
    if (/[",\n]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
    return s;
  };
  const header = names.map(esc).join(",");
  const body = rows.map((r) => names.map((n) => esc(r[n])).join(","));
  return [header, ...body].join("\n");
}

export function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1500);
}

export function downloadText(text: string, filename: string, mime = "text/plain") {
  downloadBlob(new Blob([text], { type: `${mime};charset=utf-8` }), filename);
}

export function buildAnalysisJson(result: AnalysisResult): string {
  return JSON.stringify(
    {
      jobId: result.jobId,
      fileName: result.fileName,
      analyzedAt: result.analyzedAt,
      originalRowCount: result.originalRowCount,
      originalColCount: result.originalColCount,
      cleanedRowCount: result.cleanedRowCount,
      cleanedColCount: result.cleanedColCount,
      calculatedColumns: result.calculatedColumns,
      customMeasures: result.customMeasures,
      profile: result.profile,
      quality: result.quality,
      cleaning: result.cleaning,
      statistics: result.statistics,
      insights: result.insights,
      dashboard: {
        kpis: result.dashboard.kpis,
        charts: result.dashboard.charts.map((c) => ({
          id: c.id,
          type: c.type,
          title: c.title,
          description: c.description,
          usefulness: c.usefulness,
        })),
      },
      warnings: result.warnings,
      note: "Full cleaned rows are exported separately as CSV/XLSX.",
    },
    null,
    2,
  );
}

export function buildInsightsJson(result: AnalysisResult): string {
  return JSON.stringify({ insights: result.insights, generatedAt: result.analyzedAt }, null, 2);
}

export async function buildExcelBlob(result: AnalysisResult): Promise<Blob> {
  const XLSX = await import("xlsx");
  const wb = XLSX.utils.book_new();
  const cleaned = result.cleanedRows.map((r) => {
    const o: Record<string, unknown> = {};
    for (const n of result.cleanedNames) o[n] = r[n] ?? "";
    return o;
  });
  XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(cleaned), "Cleaned");

  const profile = result.profile.columns.map((c) => ({
    column: c.originalName,
    kind: c.kind,
    missing: c.missingCount,
    missing_pct: c.missingPct,
    unique: c.uniqueCount,
    mean: c.mean ?? "",
    median: c.median ?? "",
    std: c.std ?? "",
    min: c.min ?? "",
    max: c.max ?? "",
    mode: c.mode ?? "",
  }));
  XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(profile), "Profile");

  const insights = result.insights.map((i) => ({
    title: i.title,
    category: i.category,
    metric: i.supportingMetric,
    columns: i.supportingColumns.join(", "),
    strength: i.strength,
    explanation: i.explanation,
    caveat: i.caveat ?? "",
  }));
  XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(insights), "Insights");

  const logs = result.cleaning.logs.map((l) => ({
    operation: l.operation,
    column: l.column ?? "",
    rows_affected: l.rowsAffected,
    method: l.method,
    reason: l.reason,
  }));
  XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(logs), "Cleaning");

  if (result.customMeasures.length) {
    XLSX.utils.book_append_sheet(
      wb,
      XLSX.utils.json_to_sheet(
        result.customMeasures.map((measure) => ({
          name: measure.name,
          aggregation: measure.aggregation,
          column: measure.column,
          value: measure.value,
        })),
      ),
      "Measures",
    );
  }

  const out = XLSX.write(wb, { bookType: "xlsx", type: "array" }) as number[];
  return new Blob([Uint8Array.from(out)], {
    type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  });
}

export function stem(fileName: string): string {
  return fileName.replace(/\.[^.]+$/, "") || "dataset";
}
