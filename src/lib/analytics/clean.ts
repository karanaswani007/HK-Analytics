import type {
  CleanedDataset,
  CleaningLog,
  DatasetProfile,
  OutlierReport,
  ParsedDataset,
} from "./types";
import { asText, isBlank, parseDate, parseNumber } from "./format";
import { iqrBounds, median, modeString } from "./stats";

function log(
  logs: CleaningLog[],
  operation: string,
  column: string | null,
  rowsAffected: number,
  reason: string,
  method: string,
) {
  if (rowsAffected <= 0 && operation !== "standardize_names") return;
  logs.push({ operation, column, rowsAffected, reason, method });
}

export function cleanDataset(data: ParsedDataset, profile: DatasetProfile): CleanedDataset {
  const logs: CleaningLog[] = [];
  const strategyNotes: string[] = [];
  const outlierReports: OutlierReport[] = [];

  const keepCols = profile.columns.filter((c) => c.missingCount < data.rows.length);
  const droppedCols = profile.columns.filter((c) => c.missingCount === data.rows.length);
  if (droppedCols.length) {
    log(
      logs,
      "drop_empty_columns",
      droppedCols.map((c) => c.originalName).join(", "),
      droppedCols.length,
      "Column had no values in any row.",
      "all-null drop",
    );
  }

  const names = keepCols.map((c) => c.name);
  const originalNames = keepCols.map((c) => c.originalName);
  log(
    logs,
    "standardize_names",
    null,
    names.length,
    "Column names were normalized for analysis (spaces and symbols replaced).",
    "sanitize identifiers",
  );

  let rows = data.rows.map((r) => {
    const o: Record<string, unknown> = {};
    for (const n of names) o[n] = r[n] ?? null;
    return o;
  });

  const beforeEmpty = rows.length;
  rows = rows.filter((r) => names.some((n) => !isBlank(r[n])));
  log(
    logs,
    "drop_empty_rows",
    null,
    beforeEmpty - rows.length,
    "Row was empty across all remaining columns.",
    "all-null drop",
  );

  const keyNames = names.filter((n) => keepCols.find((c) => c.name === n)?.kind !== "constant");
  const seen = new Set<string>();
  const beforeDup = rows.length;
  rows = rows.filter((r) => {
    const sig = keyNames.map((n) => asText(r[n])).join("\u0001");
    if (seen.has(sig)) return false;
    seen.add(sig);
    return true;
  });
  log(
    logs,
    "drop_duplicate_rows",
    null,
    beforeDup - rows.length,
    "Exact duplicate of an earlier row.",
    "full-row hash",
  );

  const colByName = new Map(keepCols.map((c) => [c.name, c]));

  for (const name of names) {
    const col = colByName.get(name);
    if (!col) continue;

    if (col.kind === "datetime") {
      let n = 0;
      for (const r of rows) {
        if (isBlank(r[name])) continue;
        const d = parseDate(r[name]);
        if (d) {
          r[name] = d.toISOString().slice(0, 10);
          n += 1;
        }
      }
      log(logs, "parse_dates", name, n, "Parsed values into ISO dates (YYYY-MM-DD).", "date parse");
    }

    if (col.kind === "numeric" || col.kind === "boolean") {
      let n = 0;
      for (const r of rows) {
        if (isBlank(r[name])) continue;
        const num = parseNumber(r[name]);
        if (num !== null) {
          r[name] = num;
          n += 1;
        }
      }
      log(
        logs,
        "coerce_numeric",
        name,
        n,
        "Converted numeric-like strings (currency, commas) into numbers.",
        "numeric coerce",
      );
    }

    if (col.kind === "boolean") {
      for (const r of rows) {
        if (isBlank(r[name])) continue;
        const t = asText(r[name]).toLowerCase();
        if (["true", "yes", "y", "t", "1"].includes(t) || r[name] === 1) r[name] = "Yes";
        else if (["false", "no", "n", "f", "0"].includes(t) || r[name] === 0) r[name] = "No";
      }
    }
  }

  for (const name of names) {
    const col = colByName.get(name);
    if (!col || col.kind !== "numeric") continue;
    const present = rows.map((r) => r[name]).filter((v) => typeof v === "number") as number[];
    const med = median(present);
    if (med === null) continue;
    let filled = 0;
    for (const r of rows) {
      if (isBlank(r[name])) {
        r[name] = med;
        filled += 1;
      }
    }
    log(
      logs,
      "impute_numeric",
      name,
      filled,
      `Missing numeric values filled with the column median (${med}).`,
      "median impute",
    );
    strategyNotes.push(
      `${col.originalName}: missing numbers filled with median. Outliers were flagged, not deleted.`,
    );

    const bounds = iqrBounds(present);
    if (bounds) {
      const examples: number[] = [];
      let count = 0;
      for (const v of present) {
        if (v < bounds.lower || v > bounds.upper) {
          count += 1;
          if (examples.length < 5) examples.push(v);
        }
      }
      if (count) {
        outlierReports.push({
          column: name,
          method: "IQR",
          lower: bounds.lower,
          upper: bounds.upper,
          count,
          pct: (count / present.length) * 100,
          examples,
        });
        log(
          logs,
          "flag_outliers",
          name,
          count,
          `Values outside [${bounds.lower.toFixed(2)}, ${bounds.upper.toFixed(2)}] (1.5×IQR). Kept in the dataset.`,
          "IQR 1.5",
        );
      }
    }
  }

  for (const name of names) {
    const col = colByName.get(name);
    if (!col) continue;
    if (col.kind === "identifier" || col.kind === "numeric" || col.kind === "datetime" || col.kind === "constant") {
      continue;
    }
    const present = rows.map((r) => r[name]).filter((v) => !isBlank(v)).map(asText);
    const missingPct = col.missingPct;
    const fillWith =
      missingPct >= 5 && missingPct <= 80 ? "Unknown" : (modeString(present) ?? "Unknown");
    let filled = 0;
    for (const r of rows) {
      if (isBlank(r[name])) {
        r[name] = fillWith;
        filled += 1;
      } else {
        r[name] = asText(r[name]);
      }
    }
    log(
      logs,
      "impute_categorical",
      name,
      filled,
      fillWith === "Unknown"
        ? "Missing categories labeled “Unknown” so records are retained."
        : `Missing categories filled with the mode (“${fillWith}”).`,
      fillWith === "Unknown" ? "explicit Unknown" : "mode impute",
    );
  }

  strategyNotes.unshift(
    "Original data is preserved in the upload preview. Cleaning never drops outliers automatically.",
  );
  strategyNotes.push("Empty rows/columns and exact duplicate rows were removed when present.");

  return { names, originalNames, rows, logs, outlierReports, strategyNotes };
}
