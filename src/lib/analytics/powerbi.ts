import type { AnalysisResult, ChartSpec } from "./types";
import { rowsToCsv } from "./export";

function guid(): string {
  const s = () => Math.floor((1 + Math.random()) * 0x10000).toString(16).slice(1);
  return `${s()}${s()}-${s()}-${s()}-${s()}-${s()}${s()}${s()}`;
}

function tmdlType(kind: string): string {
  if (kind === "numeric") return "double";
  if (kind === "datetime") return "dateTime";
  if (kind === "boolean") return "string";
  return "string";
}

function visualFromChart(chart: ChartSpec, i: number): object {
  const x = 16 + (i % 2) * 640;
  const y = 120 + Math.floor(i / 2) * 280;
  const visualType =
    chart.type === "line"
      ? "lineChart"
      : chart.type === "scatter"
        ? "scatterChart"
        : chart.type === "heatmap"
          ? "matrix"
          : "clusteredBarChart";
  return {
    $schema: "https://developer.microsoft.com/json-schemas/fabric/item/report/definition/visualContainer/1.3.0/schema.json",
    name: chart.id.replace(/[^A-Za-z0-9]/g, "").slice(0, 20) || `visual${i}`,
    position: { x, y, z: i, width: 620, height: 260, tabOrder: i },
    visual: {
      visualType,
      title: { show: true, text: chart.title },
      legend: { show: false },
    },
  };
}

export async function buildPowerBiZip(result: AnalysisResult): Promise<Blob> {
  const JSZip = (await import("jszip")).default;
  const zip = new JSZip();
  const reportName = "HK_Analytics";
  const modelId = guid();
  const tableName = "Dataset";

  zip.file(
    `${reportName}.pbip`,
    JSON.stringify(
      {
        version: "1.0",
        artifacts: [{ report: { path: `${reportName}.Report` } }],
        settings: { enableAutoRecovery: true },
      },
      null,
      2,
    ),
  );

  zip.file(
    `${reportName}.Report/definition.pbir`,
    JSON.stringify(
      {
        version: "4.0",
        datasetReference: { byPath: { path: `../${reportName}.SemanticModel` } },
      },
      null,
      2,
    ),
  );

  zip.file(
    `${reportName}.Report/.platform`,
    JSON.stringify(
      {
        $schema: "https://developer.microsoft.com/json-schemas/fabric/gitIntegration/platformProperties/2.0.0/schema.json",
        metadata: { type: "Report", displayName: reportName },
        config: { version: "2.0", logicalId: guid() },
      },
      null,
      2,
    ),
  );

  zip.file(
    `${reportName}.SemanticModel/definition.pbism`,
    JSON.stringify({ version: "4.0" }, null, 2),
  );

  zip.file(
    `${reportName}.SemanticModel/.platform`,
    JSON.stringify(
      {
        $schema: "https://developer.microsoft.com/json-schemas/fabric/gitIntegration/platformProperties/2.0.0/schema.json",
        metadata: { type: "SemanticModel", displayName: `${reportName} Model` },
        config: { version: "2.0", logicalId: modelId },
      },
      null,
      2,
    ),
  );

  const colsTmdl = result.profile.columns
    .filter((c) => result.cleanedNames.includes(c.name))
    .map((c) => {
      const tag = guid();
      return [
        `\tcolumn ${c.name}`,
        `\t\tdataType: ${tmdlType(c.kind)}`,
        `\t\tlineageTag: ${tag}`,
        `\t\tsummarizeBy: ${c.kind === "numeric" ? "sum" : "none"}`,
        `\t\tsourceColumn: ${c.name}`,
        "",
        `\t\tannotation SummarizationSetBy = Automatic`,
        "",
      ].join("\n");
    })
    .join("\n");

  const tableTmdl = [
    `table ${tableName}`,
    `\tlineageTag: ${guid()}`,
    "",
    colsTmdl,
    `\tpartition ${tableName} = m`,
    `\t\tmode: import`,
    `\t\tsource =`,
    "\t\t\t```",
    "\t\t\tlet",
    `\t\t\t    Source = Csv.Document(File.Contents("cleaned-data.csv"), [Delimiter=",", Encoding=65001, QuoteStyle=QuoteStyle.Csv]),`,
    "\t\t\t    Promoted = Table.PromoteHeaders(Source, [PromoteAllScalars=true])",
    "\t\t\tin",
    "\t\t\t    Promoted",
    "\t\t\t```",
    "",
    "\tannotation PBI_ResultType = Table",
    "",
  ].join("\n");

  zip.file(`${reportName}.SemanticModel/definition/tables/${tableName}.tmdl`, tableTmdl);
  zip.file(
    `${reportName}.SemanticModel/definition/model.tmdl`,
    [
      "model Model",
      "\tculture: en-US",
      "\tdefaultPowerBIDataSourceVersion: powerBI_V3",
      "\tsourceQueryCulture: en-US",
      "\tdataAccessOptions",
      "\t\tlegacyRedirects",
      "\t\treturnErrorValuesAsNull",
      "",
      `\tannotation PBI_QueryOrder = ["${tableName}"]`,
      "",
      `ref table ${tableName}`,
      "",
    ].join("\n"),
  );
  zip.file(
    `${reportName}.SemanticModel/definition/database.tmdl`,
    "database\n\tcompatibilityLevel: 1600\n",
  );
  zip.file(
    `${reportName}.SemanticModel/definition/cultures/en-US.tmdl`,
    "cultureInfo en-US\n\tlinguisticMetadata =\n\t\tjson\n\t\t\t```\n\t\t\t{ \"Version\": \"1.0.0\", \"Language\": \"en-US\" }\n\t\t\t```\n",
  );

  const pages = [
    {
      id: "overview",
      displayName: "Overview",
      charts: result.dashboard.charts.slice(0, 4),
    },
    {
      id: "quality",
      displayName: "Data Quality",
      charts: result.dashboard.charts.filter((c) => c.id === "missingness" || c.type === "histogram").slice(0, 4),
    },
    {
      id: "insights",
      displayName: "Insights",
      charts: result.dashboard.charts.filter((c) => c.id.startsWith("rate-") || c.type === "heatmap" || c.type === "scatter").slice(0, 4),
    },
  ];

  zip.file(
    `${reportName}.Report/definition/version.json`,
    JSON.stringify({ version: "2.0.0" }, null, 2),
  );

  zip.file(
    `${reportName}.Report/definition/pages/pages.json`,
    JSON.stringify(
      {
        $schema: "https://developer.microsoft.com/json-schemas/fabric/item/report/definition/pagesMetadata/1.0.0/schema.json",
        pageOrder: pages.map((p) => p.id),
        activePageName: pages[0]!.id,
      },
      null,
      2,
    ),
  );

  for (const page of pages) {
    zip.file(
      `${reportName}.Report/definition/pages/${page.id}/page.json`,
      JSON.stringify(
        {
          $schema: "https://developer.microsoft.com/json-schemas/fabric/item/report/definition/page/1.3.0/schema.json",
          name: page.id,
          displayName: page.displayName,
          displayOption: "FitToPage",
          height: 720,
          width: 1280,
        },
        null,
        2,
      ),
    );
    page.charts.forEach((chart, i) => {
      zip.file(
        `${reportName}.Report/definition/pages/${page.id}/visuals/${chart.id}/visual.json`,
        JSON.stringify(visualFromChart(chart, i), null, 2),
      );
    });
  }

  zip.file(
    `${reportName}.Report/StaticResources/SharedResources/BaseThemes/CY24SU10.json`,
    JSON.stringify(
      {
        name: "HK Analytics",
        dataColors: ["#1C3D6E", "#2A6B63", "#8A5A12", "#3A5F94", "#8F3A3A", "#5C6474"],
        foreground: "#1A1F2B",
        background: "#FFFCF7",
        tableAccent: "#1C3D6E",
        good: "#2A6B63",
        neutral: "#8A5A12",
        bad: "#8F3A3A",
        maximum: "#1C3D6E",
        center: "#C4BFB4",
        minimum: "#F3F1EC",
        textClasses: {
          callout: { fontFace: "Georgia", fontSize: 28, color: "#1A1F2B" },
          title: { fontFace: "Segoe UI", fontSize: 12, color: "#1A1F2B" },
          header: { fontFace: "Segoe UI Semibold", color: "#1C3D6E" },
          label: { fontFace: "Segoe UI", color: "#5C6474" },
        },
      },
      null,
      2,
    ),
  );

  zip.file("data/cleaned-data.csv", rowsToCsv(result.cleanedRows, result.cleanedNames));
  zip.file(
    "dashboard-spec.json",
    JSON.stringify(
      {
        generatedBy: "HK Analytics",
        analyzedAt: result.analyzedAt,
        fileName: result.fileName,
        kpis: result.dashboard.kpis,
        charts: result.dashboard.charts.map((c) => ({
          id: c.id,
          type: c.type,
          title: c.title,
          description: c.description,
        })),
        insights: result.insights,
      },
      null,
      2,
    ),
  );

  zip.file(
    "README.txt",
    [
      "HK Analytics — Power BI Project",
      "================================",
      "",
      "This is a Power BI Project (.pbip), not a .pbix binary.",
      "HK Analytics does not fabricate .pbix files.",
      "",
      "How to open in Power BI Desktop:",
      "1. Unzip this archive to a folder.",
      "2. Copy data/cleaned-data.csv next to the SemanticModel folder, or",
      "   update the M partition path in definition/tables/Dataset.tmdl to the CSV location.",
      "3. Double-click HK_Analytics.pbip.",
      "4. If Power BI prompts to refresh the semantic model, point it at cleaned-data.csv.",
      "",
      `Source file: ${result.fileName}`,
      `Generated: ${result.analyzedAt}`,
      `Rows: ${result.cleanedRowCount}  Columns: ${result.cleanedColCount}`,
      "",
      "Visual definitions are generated from the same dashboard used in the web app.",
      "Theme: professional navy on warm paper (HK SoftTech).",
      "",
    ].join("\n"),
  );

  return zip.generateAsync({ type: "blob" });
}
