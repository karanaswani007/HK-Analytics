import assert from "node:assert/strict";
import { test } from "node:test";
import { aggregateValues, buildCustomChart, calculateColumnValues } from "./custom-model.ts";

test("calculates arithmetic columns without turning invalid values into numbers", () => {
  const rows = [
    { income: 120, loan: 30 },
    { income: 60, loan: 0 },
    { income: null, loan: 10 },
  ];
  assert.deepEqual(
    calculateColumnValues(rows, {
      name: "Remaining",
      leftColumn: "income",
      operator: "subtract",
      rightColumn: "loan",
    }),
    [90, 60, null],
  );
  assert.deepEqual(
    calculateColumnValues(rows, {
      name: "Ratio",
      leftColumn: "income",
      operator: "divide",
      rightColumn: "loan",
    }),
    [4, null, null],
  );
});

test("aggregates measures across numeric and categorical values", () => {
  assert.equal(aggregateValues([2, 4, 6], "sum"), 12);
  assert.equal(aggregateValues([2, 4, 6], "average"), 4);
  assert.equal(aggregateValues([2, 4, 6], "median"), 4);
  assert.equal(aggregateValues(["A", "A", "B", null], "count"), 3);
  assert.equal(aggregateValues(["A", "A", "B", null], "distinct"), 2);
});

test("builds grouped charts from selected dimensions and measures", () => {
  const rows = [
    { region: "North", status: "Yes", sales: 100 },
    { region: "North", status: "No", sales: 80 },
    { region: "South", status: "Yes", sales: 50 },
  ];
  const chart = buildCustomChart(rows, {
    id: "custom-1",
    title: "Sales by region",
    type: "stacked-bar",
    xColumn: "region",
    yColumn: "sales",
    aggregation: "sum",
    seriesColumn: "status",
  });
  assert.deepEqual(chart.seriesKeys, [
    { key: "series0", label: "Yes" },
    { key: "series1", label: "No" },
  ]);
  assert.deepEqual(chart.data, [
    { label: "North", series0: 100, series1: 80 },
    { label: "South", series0: 50, series1: 0 },
  ]);
});
