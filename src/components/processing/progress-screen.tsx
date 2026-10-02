import { Wordmark } from "@/components/brand/logo";
import { Progress } from "@/components/ui/progress";
import { useAppStore } from "@/lib/store";

const STAGES = [
  "Profiling",
  "Data quality",
  "Cleaning",
  "EDA",
  "Statistics",
  "Insights",
  "Dashboard",
];

export function ProgressScreen() {
  const parsed = useAppStore((s) => s.parsed);
  const progress = useAppStore((s) => s.progress);
  const activeIdx = Math.max(
    0,
    STAGES.findIndex((s) => progress.stage.toLowerCase().includes(s.toLowerCase().split(" ")[0]!)),
  );

  return (
    <div className="paper-grid flex min-h-dvh flex-col">
      <header className="px-5 py-5">
        <Wordmark />
      </header>
      <main className="mx-auto flex w-full max-w-xl flex-1 flex-col justify-center px-5 pb-24">
        <p className="text-xs font-medium uppercase tracking-[0.18em] text-navy">Analyzing</p>
        <h1 className="mt-2 font-display text-3xl font-medium tracking-tight text-ink">
          {parsed?.fileName ?? "Dataset"}
        </h1>
        <p className="mt-2 text-sm text-ink-muted">{progress.detail || "Working through the pipeline."}</p>
        <Progress value={progress.pct} className="mt-6" />
        <p className="mt-2 text-xs tabular text-ink-subtle">{Math.round(progress.pct)}% · {progress.stage}</p>
        <ol className="mt-8 space-y-3">
          {STAGES.map((stage, i) => {
            const done = i < activeIdx || progress.pct >= 100;
            const current = i === activeIdx && progress.pct < 100;
            return (
              <li key={stage} className="flex items-center gap-3 text-sm">
                <span
                  className={
                    done
                      ? "size-2 rounded-full bg-teal"
                      : current
                        ? "size-2 rounded-full bg-navy"
                        : "size-2 rounded-full bg-line-strong"
                  }
                />
                <span className={current ? "font-medium text-ink" : done ? "text-ink-muted" : "text-ink-subtle"}>
                  {stage}
                </span>
              </li>
            );
          })}
        </ol>
      </main>
    </div>
  );
}
