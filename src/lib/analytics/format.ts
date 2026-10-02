export function clamp(n: number, lo: number, hi: number): number {
  return Math.min(hi, Math.max(lo, n));
}

export function round(n: number, digits = 2): number {
  if (!Number.isFinite(n)) return n;
  const f = 10 ** digits;
  return Math.round(n * f) / f;
}

export function fmtNumber(n: number | undefined | null, digits = 2): string {
  if (n === undefined || n === null || !Number.isFinite(n)) return "—";
  const abs = Math.abs(n);
  if (abs >= 1_000_000_000) return `${round(n / 1_000_000_000, 2)}B`;
  if (abs >= 1_000_000) return `${round(n / 1_000_000, 2)}M`;
  if (abs >= 10_000) return `${Math.round(n).toLocaleString()}`;
  if (abs >= 100) return round(n, 1).toLocaleString();
  if (Number.isInteger(n)) return n.toLocaleString();
  return round(n, digits).toLocaleString();
}

export function fmtPct(n: number | undefined | null, digits = 1): string {
  if (n === undefined || n === null || !Number.isFinite(n)) return "—";
  return `${round(n, digits)}%`;
}

export function fmtP(p: number): string {
  if (!Number.isFinite(p)) return "—";
  if (p < 0.001) return "< 0.001";
  if (p < 0.01) return p.toFixed(3);
  return p.toFixed(3);
}

export function strengthFromP(p: number): "high" | "medium" | "low" {
  if (p < 0.01) return "high";
  if (p < 0.05) return "medium";
  return "low";
}

export function sanitizeName(name: string): string {
  const cleaned = name
    .trim()
    .replace(/^\uFEFF/, "")
    .replace(/[^\w]+/g, "_")
    .replace(/^_+|_+$/g, "");
  return cleaned || "column";
}

export function uniqueNames(names: string[]): string[] {
  const seen = new Map<string, number>();
  return names.map((raw) => {
    const base = sanitizeName(raw) || "column";
    const n = seen.get(base) ?? 0;
    seen.set(base, n + 1);
    return n === 0 ? base : `${base}_${n + 1}`;
  });
}

export function isBlank(v: unknown): boolean {
  if (v === null || v === undefined) return true;
  if (typeof v === "number") return Number.isNaN(v);
  if (typeof v === "string") {
    const s = v.trim();
    return s === "" || s.toLowerCase() === "na" || s.toLowerCase() === "n/a" || s === "-";
  }
  return false;
}

export function asText(v: unknown): string {
  if (v === null || v === undefined) return "";
  if (v instanceof Date) return v.toISOString();
  return String(v).trim();
}

export function parseNumber(v: unknown): number | null {
  if (typeof v === "number" && Number.isFinite(v)) return v;
  if (typeof v === "boolean") return v ? 1 : 0;
  if (v instanceof Date) return Number.isNaN(v.getTime()) ? null : v.getTime();
  if (typeof v !== "string") return null;
  let s = v.trim();
  if (!s) return null;
  s = s.replace(/,/g, "");
  s = s.replace(/^[$€£¥₹]\s?/, "");
  s = s.replace(/%$/, "");
  if (s === "" || s === "-" || s.toLowerCase() === "na") return null;
  const n = Number(s);
  return Number.isFinite(n) ? n : null;
}

const DATE_HINT = /(\d{4}[-/]\d{1,2}[-/]\d{1,2})|(\d{1,2}[-/]\d{1,2}[-/]\d{2,4})/;

export function parseDate(v: unknown): Date | null {
  if (v instanceof Date && !Number.isNaN(v.getTime())) return v;
  if (typeof v === "number" && Number.isFinite(v)) {
    // Excel serial date (days since 1899-12-30)
    if (v > 20000 && v < 80000) {
      const d = new Date(Date.UTC(1899, 11, 30) + v * 86400000);
      return Number.isNaN(d.getTime()) ? null : d;
    }
    if (v > 1e11 && v < 2e13) {
      const d = new Date(v);
      return Number.isNaN(d.getTime()) ? null : d;
    }
  }
  if (typeof v !== "string") return null;
  const s = v.trim();
  if (!s || s.length < 6) return null;
  if (!DATE_HINT.test(s) && !/\d{4}/.test(s)) return null;
  const d = new Date(s);
  if (Number.isNaN(d.getTime())) return null;
  const y = d.getUTCFullYear();
  if (y < 1900 || y > 2100) return null;
  return d;
}

export function isoDate(d: Date): string {
  return d.toISOString().slice(0, 10);
}

export function bytesLabel(n: number): string {
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${round(n / 1024, 1)} KB`;
  return `${round(n / (1024 * 1024), 1)} MB`;
}

export function uid(prefix = "id"): string {
  return `${prefix}_${Math.random().toString(36).slice(2, 10)}`;
}

export function yieldFrame(): Promise<void> {
  return new Promise((resolve) => {
    if (typeof requestAnimationFrame === "function") {
      requestAnimationFrame(() => resolve());
    } else {
      setTimeout(resolve, 0);
    }
  });
}

export function titleCase(s: string): string {
  return s
    .replace(/[_-]+/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .replace(/\b\w/g, (c) => c.toUpperCase());
}
