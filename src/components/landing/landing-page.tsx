import { useRef, useState } from "react";
import { ArrowRight, FileSpreadsheet, ShieldCheck, Upload } from "lucide-react";
import { toast } from "sonner";
import { Wordmark } from "@/components/brand/logo";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { DataTable } from "@/components/data-table";
import { parseFile } from "@/lib/analytics/parse";
import { sampleLoanDataset, SAMPLE_LOAN_DESCRIPTION } from "@/lib/analytics/sample-loan";
import { useAppStore } from "@/lib/store";
import { cn } from "@/lib/utils";

const STEPS = [
  { n: "01", title: "Profile", copy: "Types, missingness, identifiers, and duplicates — as structured JSON, not vibes." },
  { n: "02", title: "Clean", copy: "Transparent transforms. Outliers flagged. Every operation logged." },
  { n: "03", title: "Analyze", copy: "EDA, correlations, and group tests. Association, never causation." },
  { n: "04", title: "Deliver", copy: "Dashboard, evidence-backed insights, AI Analyst, and a Power BI project." },
];

export function LandingPage() {
  const parsed = useAppStore((s) => s.parsed);
  const view = useAppStore((s) => s.view);
  const error = useAppStore((s) => s.error);
  const loadParsed = useAppStore((s) => s.loadParsed);
  const analyze = useAppStore((s) => s.analyze);
  const setError = useAppStore((s) => s.setError);
  const reset = useAppStore((s) => s.reset);
  const inputRef = useRef<HTMLInputElement>(null);
  const [drag, setDrag] = useState(false);
  const [busy, setBusy] = useState(false);

  async function handleFile(file: File) {
    setBusy(true);
    setError(null);
    try {
      const ds = await parseFile(file);
      loadParsed(ds);
      toast.success(`Loaded ${ds.rows.length.toLocaleString()} rows from ${ds.fileName}`);
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Could not read that file.";
      setError(msg);
      toast.error(msg);
    } finally {
      setBusy(false);
    }
  }

  function onSample() {
    const ds = sampleLoanDataset();
    loadParsed(ds);
    toast.success("Sample loan dataset loaded.");
  }

  return (
    <div className="paper-grid min-h-dvh">
      <header className="mx-auto flex w-full max-w-6xl items-center justify-between px-5 py-5">
        <Wordmark />
        <p className="hidden text-xs tracking-wide text-ink-subtle sm:block">Raw Data In. Intelligent Insights Out.</p>
      </header>

      <main className="mx-auto grid w-full max-w-6xl grid-cols-1 gap-10 px-5 pb-16 pt-4 lg:grid-cols-2 lg:items-start lg:gap-14">
        <section className="stagger-in max-w-xl">
          <p className="text-xs font-medium uppercase tracking-[0.18em] text-navy">HK SoftTech</p>
          <h1 className="mt-3 font-display text-4xl font-medium tracking-tight text-ink sm:text-5xl">
            Upload a spreadsheet.
            <span className="block text-navy">Leave with a briefing.</span>
          </h1>
          <p className="mt-5 max-w-prose text-base text-ink-muted">
            HK Analytics profiles, cleans, and studies your CSV or Excel file, then writes a dashboard, ranked insights,
            and a Power BI project you can open in Desktop. The AI Analyst answers from computed evidence — not invention.
          </p>
          <ul className="mt-8 space-y-5">
            {STEPS.map((s) => (
              <li key={s.n} className="flex gap-4">
                <span className="font-display text-sm text-navy tabular">{s.n}</span>
                <div>
                  <div className="text-sm font-medium text-ink">{s.title}</div>
                  <p className="text-sm text-ink-muted">{s.copy}</p>
                </div>
              </li>
            ))}
          </ul>
        </section>

        <section className="flex flex-col gap-4">
          <Card className="p-4 sm:p-6">
            <button
              type="button"
              onClick={() => inputRef.current?.click()}
              onDragOver={(e) => {
                e.preventDefault();
                setDrag(true);
              }}
              onDragLeave={() => setDrag(false)}
              onDrop={(e) => {
                e.preventDefault();
                setDrag(false);
                const file = e.dataTransfer.files[0];
                if (file) void handleFile(file);
              }}
              className={cn(
                "flex min-h-44 w-full flex-col items-center justify-center rounded-xl border border-dashed px-4 py-8 text-center transition-[background-color,border-color] duration-150",
                drag ? "border-navy bg-navy-soft" : "border-line-strong bg-surface-2",
              )}
            >
              <Upload className="size-6 text-navy" />
              <p className="mt-3 text-sm font-medium text-ink">Drop CSV or Excel here</p>
              <p className="mt-1 text-xs text-ink-subtle">.csv, .xlsx, .xls · up to 12 MB · first sheet</p>
              <span className="mt-4 inline-flex h-11 items-center rounded-lg bg-navy px-4 text-sm font-medium text-navy-fg">
                {busy ? "Reading…" : "Choose file"}
              </span>
            </button>
            <input
              ref={inputRef}
              type="file"
              accept=".csv,.xlsx,.xls,text/csv,application/vnd.ms-excel,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
              className="sr-only"
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (file) void handleFile(file);
                e.target.value = "";
              }}
            />
            <div className="mt-4 flex flex-col gap-2 sm:flex-row">
              <Button variant="secondary" className="flex-1" onClick={onSample} disabled={busy}>
                <FileSpreadsheet />
                Try sample loan data
              </Button>
            </div>
            <p className="mt-3 text-xs text-ink-subtle">{SAMPLE_LOAN_DESCRIPTION}</p>
            {error ? (
              <p className="mt-3 rounded-lg bg-rose-soft px-3 py-2 text-sm text-rose" role="alert">
                {error}
              </p>
            ) : null}
          </Card>

          {view === "preview" && parsed ? (
            <Card className="p-4 sm:p-5">
              <div className="mb-3 flex flex-wrap items-start justify-between gap-3">
                <div>
                  <h2 className="font-display text-lg font-medium">{parsed.fileName}</h2>
                  <p className="text-sm text-ink-muted">
                    {parsed.rows.length.toLocaleString()} rows · {parsed.names.length} columns
                    {parsed.sheetName ? ` · sheet ${parsed.sheetName}` : ""}
                    {parsed.encoding ? ` · ${parsed.encoding}` : ""}
                  </p>
                </div>
                <div className="flex gap-2">
                  <Button variant="ghost" size="sm" onClick={reset}>
                    Clear
                  </Button>
                  <Button size="sm" onClick={() => void analyze()}>
                    Analyze dataset
                    <ArrowRight />
                  </Button>
                </div>
              </div>
              {parsed.warnings.length ? (
                <p className="mb-3 text-xs text-amber">{parsed.warnings.join(" ")}</p>
              ) : null}
              <DataTable rows={parsed.rows} columns={parsed.names} maxRows={8} />
              <p className="mt-2 text-xs text-ink-subtle">Showing the first 8 rows. Original file is not modified.</p>
            </Card>
          ) : (
            <div className="flex items-start gap-3 px-1 text-sm text-ink-muted">
              <ShieldCheck className="mt-0.5 size-4 shrink-0 text-teal" />
              Files stay in this session. The AI Analyst sends relevant context to Gemini when you ask; API keys never reach the browser.
            </div>
          )}
        </section>
      </main>

      <footer className="mx-auto flex w-full max-w-6xl flex-wrap items-center justify-between gap-2 px-5 pb-8 text-xs text-ink-subtle">
        <span>HK Analytics · HK SoftTech</span>
        <span>Power BI export is a .pbip project — never a fake .pbix</span>
      </footer>
    </div>
  );
}
