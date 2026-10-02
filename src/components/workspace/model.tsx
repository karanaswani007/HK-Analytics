import { useState } from "react";
import { ChartNoAxesCombined, Plus } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { buildCustomChart } from "@/lib/analytics/custom-model";
import type {
  CalculatedColumnOperator,
  ChartType,
  MeasureAggregation,
} from "@/lib/analytics/types";
import { uid } from "@/lib/analytics/format";
import { useAppStore } from "@/lib/store";

const CONTROL = "h-10 min-w-0 rounded-lg border border-line bg-surface px-3 text-sm text-ink";

const OPERATORS: { value: CalculatedColumnOperator; label: string }[] = [
  { value: "add", label: "+ Add" },
  { value: "subtract", label: "− Subtract" },
  { value: "multiply", label: "× Multiply" },
  { value: "divide", label: "÷ Divide" },
];

const AGGREGATIONS: { value: MeasureAggregation; label: string }[] = [
  { value: "sum", label: "Sum" },
  { value: "average", label: "Average" },
  { value: "count", label: "Count values" },
  { value: "distinct", label: "Distinct count" },
  { value: "median", label: "Median" },
  { value: "min", label: "Minimum" },
  { value: "max", label: "Maximum" },
];

const CHART_TYPES: { value: Exclude<ChartType, "heatmap">; label: string }[] = [
  { value: "bar", label: "Bar / column" },
  { value: "stacked-bar", label: "Stacked bar" },
  { value: "line", label: "Line" },
  { value: "area", label: "Area" },
  { value: "scatter", label: "Scatter" },
  { value: "histogram", label: "Histogram" },
  { value: "pie", label: "Pie" },
  { value: "donut", label: "Donut" },
  { value: "treemap", label: "Treemap" },
];

function FieldSelect({
  label,
  value,
  options,
  onChange,
}: {
  label: string;
  value: string;
  options: string[];
  onChange: (value: string) => void;
}) {
  return (
    <label className="grid min-w-0 gap-1.5 text-xs font-medium text-ink-muted">
      {label}
      <select className={CONTROL} value={value} onChange={(event) => onChange(event.target.value)}>
        {options.map((option) => (
          <option key={option} value={option}>
            {option}
          </option>
        ))}
      </select>
    </label>
  );
}

export function ModelPanel() {
  const result = useAppStore((state) => state.result)!;
  const addCalculatedColumn = useAppStore((state) => state.addCalculatedColumn);
  const addCustomMeasure = useAppStore((state) => state.addCustomMeasure);
  const addCustomChart = useAppStore((state) => state.addCustomChart);
  const numericColumns = result.cleanedNames.filter((name) =>
    result.cleanedRows.some((row) => typeof row[name] === "number"),
  );
  const firstNumeric = numericColumns[0] ?? "";
  const firstColumn = result.cleanedNames[0] ?? "";

  const [columnName, setColumnName] = useState("");
  const [leftColumn, setLeftColumn] = useState(firstNumeric);
  const [rightColumn, setRightColumn] = useState(numericColumns[1] ?? firstNumeric);
  const [operator, setOperator] = useState<CalculatedColumnOperator>("subtract");
  const [measureName, setMeasureName] = useState("");
  const [measureColumn, setMeasureColumn] = useState(firstColumn);
  const [aggregation, setAggregation] = useState<MeasureAggregation>("sum");
  const [chartTitle, setChartTitle] = useState("");
  const [chartType, setChartType] = useState<Exclude<ChartType, "heatmap">>("bar");
  const [xColumn, setXColumn] = useState(firstColumn);
  const [yColumn, setYColumn] = useState(firstNumeric);
  const [seriesColumn, setSeriesColumn] = useState(result.cleanedNames[1] ?? firstColumn);
  const [chartAggregation, setChartAggregation] = useState<MeasureAggregation>("sum");

  const needsNumericX = chartType === "scatter" || chartType === "histogram";
  const dimensionOptions = needsNumericX ? numericColumns : result.cleanedNames;
  const metricOptions = chartType === "scatter" ? numericColumns : result.cleanedNames;

  function createColumn() {
    if (!columnName.trim()) {
      toast.error("Enter a name for the calculated column.");
      return;
    }
    const added = addCalculatedColumn({
      name: columnName,
      leftColumn,
      operator,
      rightColumn,
    });
    if (!added) {
      toast.error("Use a unique column name and valid source fields.");
      return;
    }
    toast.success(`Calculated column “${columnName.trim()}” added.`);
    setColumnName("");
  }

  function createMeasure() {
    if (!measureName.trim() || !measureColumn) {
      toast.error("Enter a measure name and choose a field.");
      return;
    }
    if (aggregation !== "count" && aggregation !== "distinct" && !numericColumns.includes(measureColumn)) {
      toast.error("Sum, average, median, minimum, and maximum require a numeric field.");
      return;
    }
    const added = addCustomMeasure({
      id: uid("measure"),
      name: measureName,
      column: measureColumn,
      aggregation,
      value: 0,
    });
    if (!added) {
      toast.error("Measure names must be unique and the field must exist.");
      return;
    }
    toast.success(`Measure “${measureName.trim()}” saved.`);
    setMeasureName("");
  }

  function createChart() {
    if (!xColumn || ((chartType === "scatter" || chartType === "stacked-bar") && !yColumn)) {
      toast.error("Choose the fields required for this visual.");
      return;
    }
    if (
      yColumn &&
      chartType !== "scatter" &&
      chartType !== "histogram" &&
      chartAggregation !== "count" &&
      chartAggregation !== "distinct" &&
      !numericColumns.includes(yColumn)
    ) {
      toast.error("Choose a numeric value field, or use Count / Distinct count.");
      return;
    }
    const chart = buildCustomChart(result.cleanedRows, {
      id: `custom-${uid("chart")}`,
      title: chartTitle,
      type: chartType,
      xColumn,
      yColumn: chartType === "histogram" ? undefined : yColumn || undefined,
      aggregation: chartAggregation,
      seriesColumn: chartType === "stacked-bar" ? seriesColumn : undefined,
    });
    if (!addCustomChart(chart)) {
      toast.error("Could not add this visual.");
      return;
    }
    toast.success("Visual added to the dashboard.");
    setChartTitle("");
  }

  return (
    <div className="mx-auto max-w-6xl space-y-6">
      <header>
        <h2 className="font-display text-2xl font-medium tracking-tight">Model & charts</h2>
        <p className="mt-1 text-sm text-ink-muted">
          Create calculated fields and reusable measures, then build visuals from the cleaned table.
        </p>
      </header>

      <section aria-labelledby="calculated-columns-title">
        <Card>
          <CardHeader>
            <div>
              <CardTitle id="calculated-columns-title">Calculated columns</CardTitle>
              <CardDescription>Row-level arithmetic. Missing inputs and division by zero stay blank.</CardDescription>
            </div>
          </CardHeader>
          {numericColumns.length >= 2 ? (
            <div className="grid items-end gap-3 md:grid-cols-[1.2fr_1fr_auto_1fr_auto]">
              <label className="grid gap-1.5 text-xs font-medium text-ink-muted">
                Column name
                <Input value={columnName} onChange={(event) => setColumnName(event.target.value)} placeholder="Net amount" />
              </label>
              <FieldSelect label="First field" value={leftColumn} options={numericColumns} onChange={setLeftColumn} />
              <label className="grid gap-1.5 text-xs font-medium text-ink-muted">
                Operation
                <select className={CONTROL} value={operator} onChange={(event) => setOperator(event.target.value as CalculatedColumnOperator)}>
                  {OPERATORS.map((item) => <option key={item.value} value={item.value}>{item.label}</option>)}
                </select>
              </label>
              <FieldSelect label="Second field" value={rightColumn} options={numericColumns} onChange={setRightColumn} />
              <Button onClick={createColumn}><Plus />Add column</Button>
            </div>
          ) : (
            <p className="text-sm text-ink-muted">At least two numeric fields are required.</p>
          )}
          {result.calculatedColumns.length ? (
            <ul className="mt-4 divide-y divide-line border-t border-line">
              {result.calculatedColumns.map((column) => (
                <li key={column.name} className="flex flex-wrap items-center justify-between gap-2 py-2 text-sm">
                  <span className="font-medium">{column.name}</span>
                  <span className="text-ink-muted">{column.leftColumn} {OPERATORS.find((item) => item.value === column.operator)?.label.split(" ")[0]} {column.rightColumn}</span>
                </li>
              ))}
            </ul>
          ) : null}
        </Card>
      </section>

      <section aria-labelledby="measures-title">
        <Card>
          <CardHeader>
            <div>
              <CardTitle id="measures-title">Measures</CardTitle>
              <CardDescription>Save a dataset-level aggregation for quick reference and analysis.</CardDescription>
            </div>
          </CardHeader>
          <div className="grid items-end gap-3 md:grid-cols-[1.2fr_1fr_1fr_auto]">
            <label className="grid gap-1.5 text-xs font-medium text-ink-muted">
              Measure name
              <Input value={measureName} onChange={(event) => setMeasureName(event.target.value)} placeholder="Total loan amount" />
            </label>
            <FieldSelect label="Field" value={measureColumn} options={result.cleanedNames} onChange={setMeasureColumn} />
            <label className="grid gap-1.5 text-xs font-medium text-ink-muted">
              Aggregation
              <select className={CONTROL} value={aggregation} onChange={(event) => setAggregation(event.target.value as MeasureAggregation)}>
                {AGGREGATIONS.map((item) => <option key={item.value} value={item.value}>{item.label}</option>)}
              </select>
            </label>
            <Button variant="secondary" onClick={createMeasure}><Plus />Save measure</Button>
          </div>
          {result.customMeasures.length ? (
            <div className="mt-4 overflow-x-auto border-t border-line pt-3">
              <table className="w-full min-w-[480px] text-left text-sm">
                <thead className="text-xs text-ink-muted"><tr><th className="pb-2">Measure</th><th className="pb-2">Definition</th><th className="pb-2 text-right">Value</th></tr></thead>
                <tbody>
                  {result.customMeasures.map((measure) => (
                    <tr key={measure.id} className="border-t border-line">
                      <td className="py-2 font-medium">{measure.name}</td>
                      <td className="py-2 text-ink-muted">{AGGREGATIONS.find((item) => item.value === measure.aggregation)?.label} of {measure.column}</td>
                      <td className="py-2 text-right tabular">{measure.value.toLocaleString(undefined, { maximumFractionDigits: 2 })}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : null}
        </Card>
      </section>

      <section aria-labelledby="chart-builder-title">
        <Card>
          <CardHeader>
            <div>
              <CardTitle id="chart-builder-title">Visual builder</CardTitle>
              <CardDescription>Choose a chart, dimensions, and aggregation. New visuals appear on the dashboard.</CardDescription>
            </div>
            <ChartNoAxesCombined className="size-5 shrink-0 text-navy" />
          </CardHeader>
          <div className="grid items-end gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <label className="grid gap-1.5 text-xs font-medium text-ink-muted">
              Chart type
              <select className={CONTROL} value={chartType} onChange={(event) => setChartType(event.target.value as Exclude<ChartType, "heatmap">)}>
                {CHART_TYPES.map((item) => <option key={item.value} value={item.value}>{item.label}</option>)}
              </select>
            </label>
            <label className="grid gap-1.5 text-xs font-medium text-ink-muted">
              Chart title
              <Input value={chartTitle} onChange={(event) => setChartTitle(event.target.value)} placeholder="Auto title if blank" />
            </label>
            <FieldSelect label={chartType === "scatter" || chartType === "histogram" ? "Numeric field" : "Category / X field"} value={xColumn} options={dimensionOptions} onChange={setXColumn} />
            {chartType !== "histogram" ? (
              <FieldSelect label={chartType === "scatter" ? "Y field" : "Value field (optional)"} value={yColumn} options={metricOptions} onChange={setYColumn} />
            ) : null}
            {chartType === "stacked-bar" ? (
              <FieldSelect label="Stack by" value={seriesColumn} options={result.cleanedNames} onChange={setSeriesColumn} />
            ) : null}
            {chartType !== "histogram" && chartType !== "scatter" ? (
              <label className="grid gap-1.5 text-xs font-medium text-ink-muted">
                Aggregation
                <select className={CONTROL} value={chartAggregation} onChange={(event) => setChartAggregation(event.target.value as MeasureAggregation)}>
                  {AGGREGATIONS.map((item) => <option key={item.value} value={item.value}>{item.label}</option>)}
                </select>
              </label>
            ) : null}
            <Button onClick={createChart}><Plus />Add visual</Button>
          </div>
          <p className="mt-3 text-xs text-ink-subtle">
            Charts support up to 20 categories (top groups), six stack series, and an 800-point scatter sample.
          </p>
        </Card>
      </section>
    </div>
  );
}
