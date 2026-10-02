import type { AnalysisResult, ParsedDataset, ProgressEvent } from "./types";
import { memoryLabel, profileDataset } from "./profile";
import { cleanDataset } from "./clean";
import { computeStatistics, runEda } from "./eda";
import { buildQuality, generateInsights } from "./insights";
import { buildDashboard } from "./dashboard";
import { uid, yieldFrame } from "./format";

export async function runPipeline(
  data: ParsedDataset,
  onProgress?: (e: ProgressEvent) => void,
): Promise<AnalysisResult> {
  const emit = async (stage: string, detail: string, pct: number) => {
    onProgress?.({ stage, detail, pct });
    await yieldFrame();
  };

  await emit("Profiling", "Inferring types, missingness, and identifiers.", 12);
  const profile = profileDataset(data);

  await emit("Data quality", "Scoring duplicates, missing values, and constants.", 28);
  const cleaned = cleanDataset(data, profile);
  const quality = buildQuality(profile, cleaned.outlierReports);

  await emit("Cleaning", "Applying documented transforms. Outliers flagged, not deleted.", 46);

  await emit("EDA", "Building distributions, frequencies, and candidate charts.", 62);
  const statistics = computeStatistics(cleaned, profile);

  await emit("Statistics", "Correlations and group tests (association, not causation).", 76);
  const eda = runEda(cleaned, profile, statistics);

  await emit("Insights", "Ranking evidence-backed findings.", 88);
  const insights = generateInsights(profile, cleaned, quality, statistics, eda);
  const dashboard = buildDashboard(profile, cleaned, quality, eda);

  await emit("Dashboard", "Selecting KPIs and a compact visual set.", 97);

  const result: AnalysisResult = {
    jobId: uid("job"),
    fileName: data.fileName,
    analyzedAt: new Date().toISOString(),
    originalRowCount: profile.rowCount,
    originalColCount: profile.columnCount,
    cleanedRowCount: cleaned.rows.length,
    cleanedColCount: cleaned.names.length,
    memoryEstimate: memoryLabel(profile.memoryBytes),
    profile,
    quality,
    cleaning: {
      logs: cleaned.logs,
      strategyNotes: cleaned.strategyNotes,
      originalRowCount: profile.rowCount,
      cleanedRowCount: cleaned.rows.length,
    },
    eda,
    statistics,
    insights,
    dashboard,
    previewOriginal: data.rows.slice(0, 25),
    previewCleaned: cleaned.rows.slice(0, 25),
    cleanedRows: cleaned.rows,
    cleanedNames: cleaned.names,
    calculatedColumns: [],
    customMeasures: [],
    warnings: [
      ...data.warnings,
      ...data.parseErrors.slice(0, 5),
    ],
  };

  await emit("Done", "Analysis is ready.", 100);
  return result;
}
