import { parseCsvText } from "./parse";
import type { ParsedDataset } from "./types";

function mulberry32(seed: number) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function pick<T>(rng: () => number, items: T[]): T {
  return items[Math.floor(rng() * items.length)]!;
}

function maybe<T>(rng: () => number, value: T, p: number): T | "" {
  return rng() < p ? "" : value;
}

function round(n: number): number {
  return Math.round(n);
}

/** Realistic loan-application sample with planted associations (not causation). */
export function buildSampleLoanCsv(): string {
  const rng = mulberry32(20260927);
  const genders = ["Male", "Female"] as const;
  const yn = ["Yes", "No"] as const;
  const deps = ["0", "1", "2", "3+"] as const;
  const areas = ["Urban", "Semiurban", "Rural"] as const;
  const headers = [
    "Loan_ID",
    "Gender",
    "Married",
    "Dependents",
    "Education",
    "Self_Employed",
    "ApplicantIncome",
    "CoapplicantIncome",
    "LoanAmount",
    "Loan_Amount_Term",
    "Credit_History",
    "Property_Area",
    "Loan_Status",
  ];
  const lines = [headers.join(",")];
  const n = 240;
  for (let i = 0; i < n; i++) {
    const gender = pick(rng, [...genders]);
    const married = pick(rng, [...yn]);
    const dependents = pick(rng, [...deps]);
    const education = rng() < 0.72 ? "Graduate" : "Not Graduate";
    const selfEmp = rng() < 0.14 ? "Yes" : "No";
    const area = pick(rng, [...areas]);
    const income =
      education === "Graduate"
        ? round(2800 + rng() * 9000 + (rng() < 0.04 ? rng() * 25000 : 0))
        : round(1800 + rng() * 4500);
    const co =
      married === "Yes" && rng() < 0.7 ? round(rng() * 3500) : rng() < 0.15 ? round(rng() * 1800) : 0;
    const credit = rng() < 0.82 ? 1 : 0;
    const term = pick(rng, [360, 360, 360, 180, 240, 120, 84]);
    const loan = round(Math.max(40, (income + co) * (0.018 + rng() * 0.03) + rng() * 40));
    const ratio = loan / Math.max(1, (income + co) / 100);

    let p = 0.22;
    if (credit === 1) p += 0.48;
    else p -= 0.12;
    if (education === "Graduate") p += 0.07;
    if (area === "Semiurban") p += 0.1;
    if (area === "Rural") p -= 0.08;
    if (ratio > 3.2) p -= 0.16;
    if (married === "Yes") p += 0.04;
    if (selfEmp === "Yes") p -= 0.03;
    p = Math.min(0.94, Math.max(0.04, p));
    const status = rng() < p ? "Y" : "N";

    const row = [
      `LP${String(100000 + i).slice(1)}`,
      maybe(rng, gender, 0.04),
      married,
      maybe(rng, dependents, 0.03),
      education,
      maybe(rng, selfEmp, 0.08),
      String(income),
      String(co),
      maybe(rng, String(loan), 0.05),
      String(term),
      maybe(rng, String(credit), 0.07),
      area,
      status,
    ];
    lines.push(row.join(","));
  }
  // Two exact duplicates and one empty-ish trailing pattern
  lines.push(lines[12]!);
  lines.push(lines[12]!);
  return lines.join("\n");
}

export function sampleLoanDataset(): ParsedDataset {
  return parseCsvText(buildSampleLoanCsv(), "loan-applications.csv");
}

export const SAMPLE_LOAN_DESCRIPTION =
  "240 loan applications with credit history, income, property area, and approval status — including missing values and a few duplicate rows.";
