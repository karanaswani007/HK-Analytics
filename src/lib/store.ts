import { create } from "zustand";
import type {
  AnalysisResult,
  AnalystMessage,
  CalculatedColumnDefinition,
  ChartSpec,
  CustomMeasure,
  ParsedDataset,
  ProgressEvent,
} from "./analytics/types";
import { runPipeline } from "./analytics/pipeline";
import { aggregateValues, calculateColumnValues } from "./analytics/custom-model";
import { uid } from "./analytics/format";

export type View = "landing" | "preview" | "processing" | "workspace";
export type TabId =
  | "overview"
  | "quality"
  | "cleaning"
  | "eda"
  | "insights"
  | "dashboard"
  | "model"
  | "analyst"
  | "downloads";

interface AppState {
  view: View;
  tab: TabId;
  parsed: ParsedDataset | null;
  result: AnalysisResult | null;
  progress: ProgressEvent;
  error: string | null;
  messages: AnalystMessage[];
  analyzing: boolean;
  setTab: (tab: TabId) => void;
  setView: (view: View) => void;
  loadParsed: (parsed: ParsedDataset) => void;
  setError: (error: string | null) => void;
  analyze: () => Promise<void>;
  addCalculatedColumn: (definition: CalculatedColumnDefinition) => boolean;
  addCustomMeasure: (measure: CustomMeasure) => boolean;
  addCustomChart: (chart: ChartSpec) => boolean;
  addMessage: (msg: Omit<AnalystMessage, "id" | "at"> & { id?: string }) => void;
  reset: () => void;
}

const idleProgress: ProgressEvent = { stage: "Ready", detail: "", pct: 0 };

export const useAppStore = create<AppState>((set, get) => ({
  view: "landing",
  tab: "overview",
  parsed: null,
  result: null,
  progress: idleProgress,
  error: null,
  messages: [],
  analyzing: false,
  setTab: (tab) => set({ tab }),
  setView: (view) => set({ view }),
  loadParsed: (parsed) =>
    set({
      parsed,
      result: null,
      error: null,
      view: "preview",
      messages: [],
      tab: "overview",
    }),
  setError: (error) => set({ error }),
  analyze: async () => {
    const parsed = get().parsed;
    if (!parsed) return;
    set({
      analyzing: true,
      view: "processing",
      error: null,
      progress: { stage: "Starting", detail: "Opening the dataset.", pct: 4 },
    });
    try {
      const result = await runPipeline(parsed, (progress) => set({ progress }));
      set({
        result,
        analyzing: false,
        view: "workspace",
        tab: "overview",
        messages: [
          {
            id: uid("msg"),
            role: "assistant",
            content: `Analysis of ${result.fileName} is ready. ${result.cleanedRowCount.toLocaleString()} cleaned records, ${result.insights.length} insights. Ask a question — answers are grounded in the computed metrics.`,
            at: new Date().toISOString(),
          },
        ],
      });
    } catch (err) {
      const message = err instanceof Error ? err.message : "Analysis failed.";
      set({
        analyzing: false,
        view: get().parsed ? "preview" : "landing",
        error: message,
      });
    }
  },
  addCalculatedColumn: (definition) => {
    const result = get().result;
    const name = definition.name.trim();
    if (!result || !name || result.cleanedNames.some((column) => column.toLowerCase() === name.toLowerCase())) {
      return false;
    }
    if (!result.cleanedNames.includes(definition.leftColumn) || !result.cleanedNames.includes(definition.rightColumn)) {
      return false;
    }
    const values = calculateColumnValues(result.cleanedRows, definition);
    const cleanedRows = result.cleanedRows.map((row, index) => ({ ...row, [name]: values[index] }));
    const cleanedNames = [...result.cleanedNames, name];
    set({
      result: {
        ...result,
        cleanedRows,
        cleanedNames,
        cleanedColCount: cleanedNames.length,
        previewCleaned: cleanedRows.slice(0, 25),
        calculatedColumns: [...result.calculatedColumns, { ...definition, name }],
        dashboard: {
          ...result.dashboard,
          kpis: result.dashboard.kpis.map((kpi) =>
            kpi.id === "cols" ? { ...kpi, value: String(cleanedNames.length) } : kpi,
          ),
        },
      },
    });
    return true;
  },
  addCustomMeasure: (measure) => {
    const result = get().result;
    if (!result || !result.cleanedNames.includes(measure.column)) return false;
    if (result.customMeasures.some((existing) => existing.name.toLowerCase() === measure.name.trim().toLowerCase())) {
      return false;
    }
    const value = aggregateValues(
      result.cleanedRows.map((row) => row[measure.column]),
      measure.aggregation,
    );
    set({
      result: {
        ...result,
        customMeasures: [...result.customMeasures, { ...measure, name: measure.name.trim(), value }],
      },
    });
    return true;
  },
  addCustomChart: (chart) => {
    const result = get().result;
    if (!result || result.dashboard.charts.some((existing) => existing.id === chart.id)) return false;
    const charts = [...result.dashboard.charts, chart];
    const customChartIds = charts.filter((item) => item.id.startsWith("custom-")).map((item) => item.id);
    const sections = result.dashboard.sections.filter((section) => section.id !== "custom");
    if (customChartIds.length) {
      sections.push({ id: "custom", title: "Custom visuals", chartIds: customChartIds });
    }
    set({ result: { ...result, dashboard: { ...result.dashboard, charts, sections } } });
    return true;
  },
  addMessage: (msg) =>
    set({
      messages: [
        ...get().messages,
        {
          id: msg.id ?? uid("msg"),
          role: msg.role,
          content: msg.content,
          evidence: msg.evidence,
          at: new Date().toISOString(),
        },
      ],
    }),
  reset: () =>
    set({
      view: "landing",
      tab: "overview",
      parsed: null,
      result: null,
      progress: idleProgress,
      error: null,
      messages: [],
      analyzing: false,
    }),
}));
