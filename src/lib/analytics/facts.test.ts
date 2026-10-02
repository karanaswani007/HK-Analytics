import assert from "node:assert/strict";
import { test } from "node:test";
import type { AnalysisResult } from "./types";
import { computeFacts } from "./facts.ts";

const result = {
  cleanedNames: ["Gender", "Loan_Status", "Income_Difference"],
  cleanedRowCount: 5,
  cleanedColCount: 2,
  cleanedRows: [
    { Gender: "Male", Loan_Status: "Yes", Income_Difference: 1 },
    { Gender: "Male", Loan_Status: "Yes", Income_Difference: 3 },
    { Gender: "Male", Loan_Status: "No", Income_Difference: 5 },
    { Gender: "Female", Loan_Status: "Yes", Income_Difference: 7 },
    { Gender: "Female", Loan_Status: "No", Income_Difference: 9 },
  ],
  fileName: "loans.csv",
  profile: {
    likelyTarget: "Loan_Status",
    columns: [
      {
        name: "Gender",
        originalName: "Gender",
        kind: "categorical",
        topValues: [
          { value: "Male", count: 3, pct: 60 },
          { value: "Female", count: 2, pct: 40 },
        ],
        sampleValues: ["Male", "Female"],
      },
      {
        name: "Loan_Status",
        originalName: "Loan_Status",
        kind: "categorical",
        topValues: [
          { value: "Yes", count: 3, pct: 60 },
          { value: "No", count: 2, pct: 40 },
        ],
        sampleValues: ["Yes", "No"],
      },
    ],
  },
  statistics: { correlations: [], associationTests: [] },
  insights: [],
  customMeasures: [],
} as unknown as AnalysisResult;

test("computes an exact approval rate for a category named in the question", () => {
  const facts = computeFacts("What percentage of male got loan approval?", result);
  const rate = facts.find((fact) => fact.label === "Observed Yes rate by Gender");
  assert.ok(rate);
  assert.match(rate.value, /Male: 66\.7% \(2\/3\)/);
  assert.match(rate.value, /Female: 50% \(1\/2\)/);
  assert.deepEqual(facts.filter((fact) => fact.label.endsWith("records in Gender")).map((fact) => fact.label), [
    "Male records in Gender",
  ]);
});

test("computes metrics for a user-created numeric column", () => {
  const facts = computeFacts("What is the average Income_Difference?", result);
  assert.ok(facts.some((fact) => fact.label === "Mean Income_Difference" && fact.value === "5"));
});
