export type ColumnKind =
  | "numeric"
  | "categorical"
  | "boolean"
  | "datetime"
  | "text"
  | "identifier"
  | "constant";

export type InsightCategory =
  | "Key Finding"
  | "Trend"
  | "Comparison"
  | "Correlation"
  | "Data Quality"
  | "Outlier"
  | "Risk/Attention"
  | "Opportunity"
  | "Recommendation";

export type Strength = "high" | "medium" | "low";

export type ChartType =
  | "bar"
  | "line"
  | "scatter"
  | "histogram"
  | "heatmap"
  | "stacked-bar";

export interface CellValue {
  raw: unknown;
  text: string;
}

export interface ParsedDataset {
  fileName: string;
  sheetName?: string;
  originalNames: string[];
  names: string[];
  rows: Record<string, unknown>[];
  warnings: string[];
  parseErrors: string[];
  encoding?: string;
}

export interface TopValue {
  value: string;
  count: number;
  pct: number;
}

export interface ColumnProfile {
  name: string;
  originalName: string;
  kind: ColumnKind;
  missingCount: number;
  missingPct: number;
  uniqueCount: number;
  cardinality: number;
  isHighCardinality: boolean;
  isIdentifier: boolean;
  isConstant: boolean;
  isNearConstant: boolean;
  isLikelyTarget: boolean;
  isLikelyAmount: boolean;
  sampleValues: string[];
  min?: number;
  max?: number;
  mean?: number;
  median?: number;
  std?: number;
  q1?: number;
  q3?: number;
  iqr?: number;
  skewness?: number;
  zeros?: number;
  negatives?: number;
  mode?: string;
  topValues?: TopValue[];
  dateMin?: string;
  dateMax?: string;
}

export interface DatasetProfile {
  rowCount: number;
  columnCount: number;
  memoryBytes: number;
  duplicateCount: number;
  emptyRowCount: number;
  emptyColumnCount: number;
  columns: ColumnProfile[];
  likelyTarget?: string;
  likelyDate?: string;
  identifierColumns: string[];
}

export interface CleaningLog {
  operation: string;
  column: string | null;
  rowsAffected: number;
  reason: string;
  method: string;
}

export interface OutlierReport {
  column: string;
  method: "IQR";
  lower: number;
  upper: number;
  count: number;
  pct: number;
  examples: number[];
}

export interface QualityIssue {
  severity: "high" | "medium" | "low";
  title: string;
  detail: string;
  column?: string;
}

export interface QualityReport {
  issues: QualityIssue[];
  missingByColumn: { column: string; missing: number; pct: number }[];
  duplicateCount: number;
  emptyRowCount: number;
  emptyColumnCount: number;
  outlierReports: OutlierReport[];
  constantColumns: string[];
  identifierColumns: string[];
  overallScore: number;
  overallLabel: string;
}

export interface CleanedDataset {
  names: string[];
  originalNames: string[];
  rows: Record<string, unknown>[];
  logs: CleaningLog[];
  outlierReports: OutlierReport[];
  strategyNotes: string[];
}

export interface CorrelationPair {
  a: string;
  b: string;
  pearson: number;
  spearman: number;
  n: number;
}

export interface GroupStat {
  group: string;
  n: number;
  mean: number;
  median: number;
}

export interface AssociationTest {
  type: "chi-square" | "welch-t" | "mann-whitney" | "kruskal-wallis";
  columns: string[];
  statistic: number;
  pValue: number;
  dof?: number;
  n: number;
  summary: string;
  groupStats?: GroupStat[];
  rateTable?: { group: string; n: number; positives: number; rate: number }[];
}

export interface StatsResult {
  correlations: CorrelationPair[];
  associationTests: AssociationTest[];
  numericSummaries: ColumnProfile[];
}

export interface HistogramBin {
  label: string;
  count: number;
  x0: number;
  x1: number;
}

export interface TimePoint {
  period: string;
  value: number;
  n: number;
}

export interface ChartSpec {
  id: string;
  type: ChartType;
  title: string;
  usefulness: number;
  description: string;
  xKey: string;
  yKey?: string;
  seriesKey?: string;
  xLabel?: string;
  yLabel?: string;
  data: Record<string, string | number | null>[];
  heatmap?: { x: string[]; y: string[]; z: (number | null)[][] };
  note?: string;
}

export interface EdaResult {
  histograms: { column: string; bins: HistogramBin[]; skewness?: number }[];
  categoryFrequencies: {
    column: string;
    values: TopValue[];
    rareCount: number;
  }[];
  timeSeries: { column: string; metric: string; grain: string; points: TimePoint[] }[];
  charts: ChartSpec[];
}

export interface Insight {
  id: string;
  title: string;
  category: InsightCategory;
  explanation: string;
  supportingMetric: string;
  supportingColumns: string[];
  strength: Strength;
  caveat?: string;
}

export interface KpiCard {
  id: string;
  label: string;
  value: string;
  hint?: string;
  tone: "neutral" | "good" | "warn" | "bad";
}

export interface DashboardSpec {
  kpis: KpiCard[];
  charts: ChartSpec[];
  sections: { id: string; title: string; chartIds: string[]; kpiIds?: string[] }[];
}

export interface AnalysisResult {
  jobId: string;
  fileName: string;
  analyzedAt: string;
  originalRowCount: number;
  originalColCount: number;
  cleanedRowCount: number;
  cleanedColCount: number;
  memoryEstimate: string;
  profile: DatasetProfile;
  quality: QualityReport;
  cleaning: {
    logs: CleaningLog[];
    strategyNotes: string[];
    originalRowCount: number;
    cleanedRowCount: number;
  };
  eda: EdaResult;
  statistics: StatsResult;
  insights: Insight[];
  dashboard: DashboardSpec;
  previewOriginal: Record<string, unknown>[];
  previewCleaned: Record<string, unknown>[];
  cleanedRows: Record<string, unknown>[];
  cleanedNames: string[];
  warnings: string[];
}

export interface ProgressEvent {
  stage: string;
  detail: string;
  pct: number;
}

export type AnalystRole = "user" | "assistant";

export interface AnalystMessage {
  id: string;
  role: AnalystRole;
  content: string;
  evidence?: string[];
  at: string;
}

export interface Fact {
  label: string;
  value: string;
  columns?: string[];
}
