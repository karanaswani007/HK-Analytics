import type { ColumnKind, ColumnProfile, DatasetProfile, ParsedDataset } from "./types";
import {
  asText,
  bytesLabel,
  isBlank,
  parseDate,
  parseNumber,
} from "./format";
import { iqrBounds, mean, median, minMax, modeString, quantile, skewness, stdev, topK } from "./stats";

const ID_RE = /(^id$|_id$|id$|uuid|guid|record.?id|customer.?id|loan.?id|user.?id|key$)/i;
const TARGET_RE = /(status|target|label|churn|approved|outcome|result|default|survived|class|loan_status)$/i;
const AMOUNT_RE = /(amount|revenue|sales|income|price|cost|profit|loan|balance|fee|total|value|payment)/i;
const BOOL_SET = new Set(["true", "false", "yes", "no", "y", "n", "0", "1", "t", "f"]);

function columnValues(rows: Record<string, unknown>[], name: string): unknown[] {
  return rows.map((r) => r[name]);
}

function inferKind(
  name: string,
  values: unknown[],
  unique: number,
  nonNull: number,
): ColumnKind {
  if (nonNull === 0) return "text";
  const uniqueRatio = unique / nonNull;
  if (unique <= 1) return "constant";

  const texts = values.filter((v) => !isBlank(v)).map((v) => asText(v).toLowerCase());
  const boolHits = texts.filter((t) => BOOL_SET.has(t)).length;
  if (boolHits / texts.length > 0.95 && unique <= 4) return "boolean";

  const numHits = values.filter((v) => parseNumber(v) !== null && !isBlank(v)).length;
  const dateHits = values.filter((v) => parseDate(v) !== null && !isBlank(v)).length;

  const numRatio = numHits / nonNull;
  const dateRatio = dateHits / nonNull;

  if (dateRatio > 0.85 && numRatio < 0.95) return "datetime";
  if (dateRatio > 0.85 && unique > 8) return "datetime";

  if (numRatio > 0.9) {
    if (ID_RE.test(name) && uniqueRatio > 0.9) return "identifier";
    if (uniqueRatio > 0.98 && unique > 50 && Number.isInteger(parseNumber(values.find((v) => !isBlank(v))) ?? 0.5)) {
      if (ID_RE.test(name)) return "identifier";
    }
    if (unique <= 12 && uniqueRatio < 0.05) return "categorical";
    return "numeric";
  }

  if (ID_RE.test(name) && uniqueRatio > 0.9) return "identifier";
  if (uniqueRatio > 0.98 && unique > 40) return "identifier";
  if (unique <= Math.max(20, Math.round(nonNull * 0.12))) return "categorical";
  if (uniqueRatio > 0.6) return "text";
  return "categorical";
}

export function profileDataset(data: ParsedDataset): DatasetProfile {
  const { rows, names, originalNames } = data;
  const rowCount = rows.length;
  const columns: ColumnProfile[] = names.map((name, idx) => {
    const originalName = originalNames[idx] ?? name;
    const values = columnValues(rows, name);
    const missingCount = values.filter(isBlank).length;
    const present = values.filter((v) => !isBlank(v));
    const texts = present.map(asText);
    const uniqueSet = new Set(texts);
    const uniqueCount = uniqueSet.size;
    const nonNull = present.length;
    const kind = inferKind(name, values, uniqueCount, nonNull);
    const isConstant = uniqueCount <= 1;
    const isNearConstant = nonNull > 0 && uniqueCount <= 2 && (uniqueCount / nonNull) < 0.02;
    const isHighCardinality = uniqueCount > 50 && uniqueCount / Math.max(1, nonNull) > 0.5;
    const isIdentifier = kind === "identifier";
    const isLikelyTarget = TARGET_RE.test(name) || TARGET_RE.test(originalName);
    const isLikelyAmount = AMOUNT_RE.test(name) || AMOUNT_RE.test(originalName);

    const col: ColumnProfile = {
      name,
      originalName,
      kind,
      missingCount,
      missingPct: rowCount ? (missingCount / rowCount) * 100 : 0,
      uniqueCount,
      cardinality: uniqueCount,
      isHighCardinality,
      isIdentifier,
      isConstant,
      isNearConstant,
      isLikelyTarget,
      isLikelyAmount,
      sampleValues: texts.slice(0, 6),
    };

    if (kind === "numeric" || kind === "boolean") {
      const nums = present.map(parseNumber).filter((n): n is number => n !== null);
      const mm = minMax(nums);
      const bounds = iqrBounds(nums);
      col.min = mm?.min;
      col.max = mm?.max;
      col.mean = mean(nums) ?? undefined;
      col.median = median(nums) ?? undefined;
      col.std = stdev(nums) ?? undefined;
      col.q1 = quantile(nums, 0.25) ?? undefined;
      col.q3 = quantile(nums, 0.75) ?? undefined;
      col.iqr = bounds?.iqr;
      col.skewness = skewness(nums) ?? undefined;
      col.zeros = nums.filter((n) => n === 0).length;
      col.negatives = nums.filter((n) => n < 0).length;
      if (kind === "boolean") {
        col.topValues = topK(texts.map((t) => t.toLowerCase()), 4);
        col.mode = modeString(texts.map((t) => t.toLowerCase())) ?? undefined;
      }
    } else if (kind === "datetime") {
      const dates = present.map(parseDate).filter((d): d is Date => d !== null);
      if (dates.length) {
        dates.sort((a, b) => a.getTime() - b.getTime());
        col.dateMin = dates[0]!.toISOString().slice(0, 10);
        col.dateMax = dates[dates.length - 1]!.toISOString().slice(0, 10);
      }
    } else {
      col.topValues = topK(texts, 8);
      col.mode = modeString(texts) ?? undefined;
    }
    return col;
  });

  let emptyRowCount = 0;
  for (const row of rows) {
    if (names.every((n) => isBlank(row[n]))) emptyRowCount += 1;
  }
  const emptyColumnCount = columns.filter((c) => c.missingCount === rowCount).length;

  const key = names.filter((n) => !columns.find((c) => c.name === n)?.isConstant);
  const seen = new Set<string>();
  let duplicateCount = 0;
  for (const row of rows) {
    const sig = key.map((n) => asText(row[n])).join("\u0001");
    if (seen.has(sig)) duplicateCount += 1;
    else seen.add(sig);
  }

  const targetCandidates = columns.filter(
    (c) =>
      (c.isLikelyTarget || c.kind === "boolean" || (c.kind === "categorical" && c.uniqueCount <= 6)) &&
      !c.isIdentifier &&
      c.uniqueCount >= 2 &&
      c.uniqueCount <= 8,
  );
  const likelyTarget =
    targetCandidates.find((c) => c.isLikelyTarget)?.name ??
    targetCandidates.sort((a, b) => a.uniqueCount - b.uniqueCount)[0]?.name;

  const likelyDate = columns.find((c) => c.kind === "datetime")?.name;
  const identifierColumns = columns.filter((c) => c.isIdentifier).map((c) => c.name);

  const memoryBytes = JSON.stringify(rows.slice(0, 20)).length * (rows.length / 20);

  return {
    rowCount,
    columnCount: names.length,
    memoryBytes,
    duplicateCount,
    emptyRowCount,
    emptyColumnCount,
    columns,
    likelyTarget,
    likelyDate,
    identifierColumns,
  };
}

export function memoryLabel(bytes: number): string {
  return bytesLabel(bytes);
}
