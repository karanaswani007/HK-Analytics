import Papa from "papaparse";
import type { ParsedDataset } from "./types";
import { asText, isBlank, uniqueNames } from "./format";

export const MAX_UPLOAD_BYTES = 12 * 1024 * 1024;
export const MAX_ROWS = 40_000;
const ALLOWED = new Set(["csv", "xlsx", "xls"]);

export function fileExtension(name: string): string {
  const i = name.lastIndexOf(".");
  return i >= 0 ? name.slice(i + 1).toLowerCase() : "";
}

export function validateFile(file: File): string | null {
  const ext = fileExtension(file.name);
  if (!ALLOWED.has(ext)) {
    return "Please upload a CSV or Excel file (.csv, .xlsx, .xls).";
  }
  if (file.size <= 0) return "That file is empty.";
  if (file.size > MAX_UPLOAD_BYTES) {
    return "This preview environment caps uploads at 12 MB. Split the file or filter rows, then try again.";
  }
  return null;
}

function decodeBuffer(buf: ArrayBuffer): { text: string; encoding: string } {
  const bytes = new Uint8Array(buf);
  const tryDec = (label: string) => {
    try {
      const decoder = new TextDecoder(label, { fatal: false });
      return decoder.decode(bytes);
    } catch {
      return null;
    }
  };
  const utf8 = tryDec("utf-8") ?? "";
  const replacement = (utf8.match(/\uFFFD/g) ?? []).length;
  if (replacement > utf8.length * 0.002 && replacement > 4) {
    const win = tryDec("windows-1252");
    if (win) return { text: win.replace(/^\uFEFF/, ""), encoding: "windows-1252" };
  }
  return { text: utf8.replace(/^\uFEFF/, ""), encoding: "utf-8" };
}

function rowsFromMatrix(matrix: unknown[][], fileName: string, sheetName?: string): ParsedDataset {
  const warnings: string[] = [];
  const parseErrors: string[] = [];
  if (!matrix.length) {
    throw new Error("No rows were found in the file.");
  }
  const headerRow = matrix[0] ?? [];
  let originalNames = headerRow.map((c, i) => {
    const t = asText(c);
    return t || `Column_${i + 1}`;
  });
  if (originalNames.every((n) => /^Column_\d+$/.test(n))) {
    warnings.push("No header row detected. Columns were labeled automatically.");
  }
  originalNames = originalNames.map((n) => n.replace(/^\uFEFF/, ""));
  const names = uniqueNames(originalNames);
  const body = matrix.slice(1);
  if (body.length > MAX_ROWS) {
    warnings.push(`Only the first ${MAX_ROWS.toLocaleString()} rows were analyzed.`);
  }
  const sliced = body.slice(0, MAX_ROWS);
  const rows: Record<string, unknown>[] = [];
  for (let r = 0; r < sliced.length; r++) {
    const line = sliced[r] ?? [];
    const rec: Record<string, unknown> = {};
    let any = false;
    for (let c = 0; c < names.length; c++) {
      const key = names[c]!;
      const raw = line[c];
      if (isBlank(raw)) rec[key] = null;
      else {
        rec[key] = typeof raw === "string" ? raw.trim() : raw;
        any = true;
      }
    }
    if (any) rows.push(rec);
  }
  if (!rows.length) throw new Error("The file contained headers but no data rows.");
  if (names.length === 0) throw new Error("No columns were detected.");
  return { fileName, sheetName, originalNames, names, rows, warnings, parseErrors };
}

export async function parseFile(file: File): Promise<ParsedDataset> {
  const err = validateFile(file);
  if (err) throw new Error(err);
  const ext = fileExtension(file.name);
  const buf = await file.arrayBuffer();

  if (ext === "csv") {
    const { text, encoding } = decodeBuffer(buf);
    const result = Papa.parse<string[]>(text, {
      skipEmptyLines: "greedy",
      comments: false,
    });
    const errors = (result.errors ?? [])
      .slice(0, 8)
      .map((e) => e.message)
      .filter(Boolean);
    const matrix = (result.data ?? []).filter((row) => row.some((c) => asText(c) !== ""));
    const parsed = rowsFromMatrix(matrix, file.name);
    parsed.encoding = encoding;
    parsed.parseErrors = errors;
    if (errors.length) parsed.warnings.push("Some rows had parse warnings and were skipped or repaired.");
    return parsed;
  }

  const XLSX = await import("xlsx");
  const wb = XLSX.read(buf, { type: "array", cellDates: true, dense: true });
  const sheetName = wb.SheetNames[0];
  if (!sheetName) throw new Error("The workbook has no sheets.");
  const sheet = wb.Sheets[sheetName];
  if (!sheet) throw new Error("The first sheet could not be read.");
  const matrix = XLSX.utils.sheet_to_json<(string | number | boolean | Date | null)[]>(sheet, {
    header: 1,
    defval: null,
    raw: true,
    blankrows: false,
  }) as unknown[][];
  const parsed = rowsFromMatrix(matrix, file.name, sheetName);
  if (wb.SheetNames.length > 1) {
    parsed.warnings.push(`Using the first sheet (“${sheetName}”). Other sheets were ignored.`);
  }
  return parsed;
}

export function parseCsvText(text: string, fileName: string): ParsedDataset {
  const result = Papa.parse<string[]>(text, { skipEmptyLines: "greedy" });
  const matrix = (result.data ?? []).filter((row) => row.some((c) => asText(c) !== ""));
  const parsed = rowsFromMatrix(matrix, fileName);
  parsed.encoding = "utf-8";
  return parsed;
}
