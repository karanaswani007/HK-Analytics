import type {
  CalculatedColumnDefinition,
  ChartSpec,
  ChartType,
  MeasureAggregation,
} from "./types";

export interface CustomChartInput {
  id: string;
  title: string;
  type: Exclude<ChartType, "heatmap">;
  xColumn: string;
  yColumn?: string;
  aggregation: MeasureAggregation;
  seriesColumn?: string;
}

function numberValue(value: unknown): number | null {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string" && value.trim() !== "") {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : null;
  }
  return null;
}

export function calculateColumnValues(
  rows: Record<string, unknown>[],
  definition: CalculatedColumnDefinition,
): (number | null)[] {
  return rows.map((row) => {
    const left = numberValue(row[definition.leftColumn]);
    const right = numberValue(row[definition.rightColumn]);
    if (left === null || right === null) return null;

    let value: number;
    switch (definition.operator) {
      case "add":
        value = left + right;
        break;
      case "subtract":
        value = left - right;
        break;
      case "multiply":
        value = left * right;
        break;
      case "divide":
        if (right === 0) return null;
        value = left / right;
        break;
    }
    return Number.isFinite(value) ? value : null;
  });
}

export function aggregateValues(values: unknown[], aggregation: MeasureAggregation): number {
  if (aggregation === "count") {
    return values.filter((value) => value !== null && value !== undefined && value !== "").length;
  }
  if (aggregation === "distinct") {
    return new Set(values.filter((value) => value !== null && value !== undefined && value !== "").map(String)).size;
  }

  const numbers = values.map(numberValue).filter((value): value is number => value !== null);
  if (!numbers.length) return 0;
  if (aggregation === "sum") return numbers.reduce((sum, value) => sum + value, 0);
  if (aggregation === "min") return numbers.reduce((minimum, value) => Math.min(minimum, value), Infinity);
  if (aggregation === "max") return numbers.reduce((maximum, value) => Math.max(maximum, value), -Infinity);
  const sorted = [...numbers].sort((a, b) => a - b);
  if (aggregation === "median") {
    const middle = Math.floor(sorted.length / 2);
    return sorted.length % 2 ? sorted[middle]! : (sorted[middle - 1]! + sorted[middle]!) / 2;
  }
  return numbers.reduce((sum, value) => sum + value, 0) / numbers.length;
}

function groupedRows(rows: Record<string, unknown>[], column: string) {
  const groups = new Map<string, Record<string, unknown>[]>();
  for (const row of rows) {
    const key = String(row[column] ?? "Unknown");
    const group = groups.get(key) ?? [];
    group.push(row);
    groups.set(key, group);
  }
  return [...groups.entries()].sort((a, b) => b[1].length - a[1].length);
}

function histogramData(rows: Record<string, unknown>[], column: string) {
  const values = rows
    .map((row) => numberValue(row[column]))
    .filter((value): value is number => value !== null);
  if (!values.length) return [];
  const min = values.reduce((minimum, value) => Math.min(minimum, value), Infinity);
  const max = values.reduce((maximum, value) => Math.max(maximum, value), -Infinity);
  const binCount = Math.min(12, Math.max(1, Math.ceil(Math.sqrt(values.length))));
  const width = max === min ? 1 : (max - min) / binCount;
  const bins = Array.from({ length: binCount }, (_, index) => ({
    label: max === min ? String(min) : `${(min + index * width).toFixed(1)}–${(min + (index + 1) * width).toFixed(1)}`,
    count: 0,
  }));
  for (const value of values) {
    const index = max === min ? 0 : Math.min(binCount - 1, Math.floor((value - min) / width));
    bins[index]!.count += 1;
  }
  return bins;
}

export function buildCustomChart(
  rows: Record<string, unknown>[],
  input: CustomChartInput,
): ChartSpec {
  const title = input.title.trim() || `${input.type} by ${input.xColumn}`;
  const base = {
    id: input.id,
    type: input.type,
    title,
    usefulness: 100,
    description: "User-created visual from the cleaned dataset.",
    xKey: "label",
    xLabel: input.xColumn,
    yLabel: input.yColumn ? `${input.aggregation} ${input.yColumn}` : "Records",
  } as const;

  if (input.type === "histogram") {
    return {
      ...base,
      yKey: "count",
      data: histogramData(rows, input.xColumn),
      description: `Distribution of ${input.xColumn} across cleaned records.`,
      yLabel: "Records",
    };
  }

  if (input.type === "scatter") {
    const yColumn = input.yColumn ?? input.xColumn;
    const data = rows
      .map((row) => ({ x: numberValue(row[input.xColumn]), y: numberValue(row[yColumn]) }))
      .filter((point): point is { x: number; y: number } => point.x !== null && point.y !== null)
      .slice(0, 800);
    return {
      ...base,
      xKey: "x",
      yKey: "y",
      xLabel: input.xColumn,
      yLabel: yColumn,
      data,
      description: `Relationship between ${input.xColumn} and ${yColumn}. Correlation is not causation.`,
    };
  }

  if (input.type === "stacked-bar" && input.seriesColumn && input.yColumn) {
    const seriesGroups = groupedRows(rows, input.seriesColumn).slice(0, 6);
    const seriesKeys = seriesGroups.map(([label], index) => ({ key: `series${index}`, label }));
    const xGroups = groupedRows(rows, input.xColumn).slice(0, 20);
    const data = xGroups.map(([label, group]) => {
      const point: Record<string, string | number | null> = { label };
      for (const series of seriesKeys) {
        const values = group
          .filter((row) => String(row[input.seriesColumn!] ?? "Unknown") === series.label)
          .map((row) => row[input.yColumn!]);
        point[series.key] = aggregateValues(values, input.aggregation);
      }
      return point;
    });
    return {
      ...base,
      yKey: seriesKeys[0]?.key ?? "count",
      seriesKey: input.seriesColumn,
      seriesKeys,
      data,
      description: `${input.aggregation} ${input.yColumn} by ${input.xColumn}, segmented by ${input.seriesColumn}.`,
      note: groupedRows(rows, input.xColumn).length > 20 ? "Showing the 20 largest categories." : undefined,
    };
  }

  const groups = groupedRows(rows, input.xColumn);
  const shown = groups.slice(0, 20);
  const data = shown.map(([label, group]) => ({
    label,
    value: input.yColumn
      ? aggregateValues(group.map((row) => row[input.yColumn!]), input.aggregation)
      : group.length,
    count: group.length,
  }));
  return {
    ...base,
    yKey: "value",
    data,
    description: input.yColumn
      ? `${input.aggregation} ${input.yColumn} by ${input.xColumn}.`
      : `Record count by ${input.xColumn}.`,
    note: groups.length > 20 ? "Showing the 20 largest categories." : undefined,
  };
}
