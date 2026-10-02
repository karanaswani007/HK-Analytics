import {
  BarChart3,
  Bot,
  Download,
  LayoutDashboard,
  Lightbulb,
  ListChecks,
  Activity,
  ShieldAlert,
  ChartNoAxesCombined,
} from "lucide-react";
import { Wordmark } from "@/components/brand/logo";
import { Button } from "@/components/ui/button";
import { useAppStore, type TabId } from "@/lib/store";
import { cn } from "@/lib/utils";
import { OverviewPanel } from "./overview";
import { QualityPanel } from "./quality";
import { CleaningPanel } from "./cleaning";
import { EdaPanel } from "./eda";
import { InsightsPanel } from "./insights";
import { DashboardPanel } from "./dashboard";
import { AnalystPanel } from "./analyst";
import { DownloadsPanel } from "./downloads";
import { ModelPanel } from "./model";

const NAV: { id: TabId; label: string; icon: typeof BarChart3 }[] = [
  { id: "overview", label: "Overview", icon: LayoutDashboard },
  { id: "quality", label: "Data quality", icon: ShieldAlert },
  { id: "cleaning", label: "Cleaning", icon: ListChecks },
  { id: "eda", label: "EDA", icon: Activity },
  { id: "insights", label: "Insights", icon: Lightbulb },
  { id: "dashboard", label: "Dashboard", icon: BarChart3 },
  { id: "model", label: "Model & charts", icon: ChartNoAxesCombined },
  { id: "analyst", label: "AI Analyst", icon: Bot },
  { id: "downloads", label: "Downloads", icon: Download },
];

export function WorkspaceShell() {
  const result = useAppStore((s) => s.result);
  const tab = useAppStore((s) => s.tab);
  const setTab = useAppStore((s) => s.setTab);
  const reset = useAppStore((s) => s.reset);
  if (!result) return null;

  const when = new Date(result.analyzedAt).toLocaleString();

  return (
    <div className="flex min-h-dvh bg-bg text-ink">
      <aside className="hidden w-60 shrink-0 flex-col bg-navy-deep text-navy-fg lg:flex">
        <div className="px-4 py-5">
          <Wordmark inverted />
        </div>
        <nav className="flex flex-1 flex-col gap-0.5 px-3 pb-4">
          {NAV.map((item) => {
            const Icon = item.icon;
            const active = tab === item.id;
            return (
              <button
                key={item.id}
                type="button"
                onClick={() => setTab(item.id)}
                className={cn(
                  "flex h-11 items-center gap-2.5 rounded-lg px-3 text-sm transition-colors duration-150",
                  active ? "bg-navy text-navy-fg" : "text-navy-fg/70 hover:bg-navy hover:text-navy-fg",
                )}
              >
                <Icon className="size-4" />
                {item.label}
              </button>
            );
          })}
        </nav>
        <p className="px-5 pb-5 text-[11px] leading-relaxed text-navy-fg/50">
          Raw Data In. Intelligent Insights Out.
        </p>
      </aside>

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="flex flex-col gap-3 border-b border-line bg-surface px-4 py-3 sm:px-6">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="min-w-0">
              <h1 className="truncate font-display text-xl font-medium tracking-tight">{result.fileName}</h1>
              <p className="text-xs text-ink-muted">
                {when} · {result.cleanedRowCount.toLocaleString()} rows · {result.cleanedColCount} cols ·{" "}
                {result.memoryEstimate}
              </p>
            </div>
            <div className="flex items-center gap-2">
              <Button variant="secondary" size="sm" onClick={() => setTab("analyst")}>
                <Bot className="size-4" />
                Ask analyst
              </Button>
              <Button variant="outline" size="sm" onClick={reset}>
                New analysis
              </Button>
            </div>
          </div>
          <div className="flex gap-1 overflow-x-auto pb-1 lg:hidden">
            {NAV.map((item) => (
              <button
                key={item.id}
                type="button"
                onClick={() => setTab(item.id)}
                className={cn(
                  "h-10 shrink-0 rounded-full px-3 text-xs font-medium",
                  tab === item.id ? "bg-navy text-navy-fg" : "bg-bg-subtle text-ink-muted",
                )}
              >
                {item.label}
              </button>
            ))}
          </div>
        </header>
        <main className="min-w-0 flex-1 overflow-x-hidden p-4 sm:p-6">
          {tab === "overview" && <OverviewPanel />}
          {tab === "quality" && <QualityPanel />}
          {tab === "cleaning" && <CleaningPanel />}
          {tab === "eda" && <EdaPanel />}
          {tab === "insights" && <InsightsPanel />}
          {tab === "dashboard" && <DashboardPanel />}
          {tab === "model" && <ModelPanel />}
          {tab === "analyst" && <AnalystPanel />}
          {tab === "downloads" && <DownloadsPanel />}
        </main>
      </div>
    </div>
  );
}
