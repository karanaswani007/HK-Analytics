import { create } from "zustand";
import type { AnalysisResult, AnalystMessage, ParsedDataset, ProgressEvent } from "./analytics/types";
import { runPipeline } from "./analytics/pipeline";
import { uid } from "./analytics/format";

export type View = "landing" | "preview" | "processing" | "workspace";
export type TabId =
  | "overview"
  | "quality"
  | "cleaning"
  | "eda"
  | "insights"
  | "dashboard"
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
