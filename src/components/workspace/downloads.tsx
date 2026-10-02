import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  buildAnalysisJson,
  buildExcelBlob,
  buildInsightsJson,
  downloadBlob,
  downloadText,
  rowsToCsv,
  stem,
} from "@/lib/analytics/export";
import { useAppStore } from "@/lib/store";

export function DownloadsPanel() {
  const result = useAppStore((s) => s.result)!;
  const base = stem(result.fileName);

  function cleanedCsv() {
    downloadText(rowsToCsv(result.cleanedRows, result.cleanedNames), `${base}-cleaned.csv`, "text/csv");
    toast.success("Cleaned CSV downloaded.");
  }

  async function cleanedXlsx() {
    const blob = await buildExcelBlob(result);
    downloadBlob(blob, `${base}-analysis.xlsx`);
    toast.success("Excel workbook downloaded.");
  }

  async function powerbi() {
    toast.message("Building Power BI project…");
    try {
      const { buildPowerBiZip } = await import("@/lib/analytics/powerbi");
      const blob = await buildPowerBiZip(result);
      downloadBlob(blob, `${base}-HK-Analytics.pbip.zip`);
      toast.success("Power BI project (.pbip zip) downloaded. This is not a .pbix file.");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not build the Power BI package.");
    }
  }

  function printSummary() {
    window.print();
  }

  return (
    <div className="grid gap-4 md:grid-cols-2">
      <Card>
        <CardHeader>
          <div>
            <CardTitle>Cleaned data</CardTitle>
            <CardDescription>{result.cleanedRowCount.toLocaleString()} rows after documented cleaning.</CardDescription>
          </div>
        </CardHeader>
        <div className="flex flex-wrap gap-2">
          <Button onClick={cleanedCsv}>CSV</Button>
          <Button variant="secondary" onClick={cleanedXlsx}>
            Excel workbook
          </Button>
        </div>
      </Card>
      <Card>
        <CardHeader>
          <div>
            <CardTitle>Analysis pack</CardTitle>
            <CardDescription>Machine-readable profile, tests, and insights.</CardDescription>
          </div>
        </CardHeader>
        <div className="flex flex-wrap gap-2">
          <Button variant="secondary" onClick={() => downloadText(buildAnalysisJson(result), `${base}-analysis.json`, "application/json")}>
            Analysis JSON
          </Button>
          <Button variant="secondary" onClick={() => downloadText(buildInsightsJson(result), `${base}-insights.json`, "application/json")}>
            Insights JSON
          </Button>
          <Button variant="outline" onClick={printSummary}>
            Print / PDF
          </Button>
        </div>
      </Card>
      <Card className="md:col-span-2">
        <CardHeader>
          <div>
            <CardTitle>Power BI project</CardTitle>
            <CardDescription>
              A .pbip folder (zipped) with TMDL semantic model, PBIR pages, theme, cleaned CSV, and a README.
              HK Analytics does not emit a fake .pbix.
            </CardDescription>
          </div>
        </CardHeader>
        <Button onClick={() => void powerbi()}>Download Power BI Project (.pbip)</Button>
        <p className="mt-3 text-xs text-ink-subtle">
          Unzip, then open HK_Analytics.pbip in Power BI Desktop. Point the model at data/cleaned-data.csv if
          prompted. Visuals follow the same dashboard used here.
        </p>
      </Card>
    </div>
  );
}
