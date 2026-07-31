import assert from "node:assert/strict";
import test from "node:test";

import {
  calculateWorkProductivity,
  normalizeDailyWorkHours,
} from "../app/lib/construction-metrics.ts";

test("converts recorded downtime into clear productive hours and equivalent days", () => {
  const metrics = calculateWorkProductivity(
    [
      { date: "2026-07-21", productivityStatus: "Produtivo", lostHours: 0 },
      { date: "2026-07-22", productivityStatus: "Produtivo", lostHours: 0 },
      {
        date: "2026-07-23",
        productivityStatus: "Parcialmente improdutivo",
        lostHours: 4,
        cause: "Maquinário quebrado",
      },
      { date: "2026-07-24", productivityStatus: "Produtivo", lostHours: 0 },
      {
        date: "2026-07-25",
        productivityStatus: "Improdutivo",
        lostHours: 8,
        cause: "Chuva",
      },
      {
        date: "2026-07-26",
        productivityStatus: "Parcialmente improdutivo",
        lostHours: 3,
        cause: "Operador ausente",
      },
      { date: "2026-07-27", productivityStatus: "Produtivo", lostHours: 0 },
    ],
    8,
  );

  assert.equal(metrics.recordedDays, 7);
  assert.equal(metrics.recordedHours, 56);
  assert.equal(metrics.lostHours, 15);
  assert.equal(metrics.productiveHours, 41);
  assert.equal(metrics.unproductiveDays, 1.875);
  assert.equal(metrics.productiveDays, 5.125);
  assert.ok(Math.abs(metrics.utilizationPercent - 73.2142857) < 0.0001);
  assert.deepEqual(
    metrics.causes.map(({ cause, hours }) => ({ cause, hours })),
    [
      { cause: "Chuva", hours: 8 },
      { cause: "Maquinário quebrado", hours: 4 },
      { cause: "Operador ausente", hours: 3 },
    ],
  );
});

test("caps one day at the configured operational journey and scales causes", () => {
  const metrics = calculateWorkProductivity(
    [
      { date: "2026-07-28", lostHours: 7, cause: "Chuva" },
      { date: "2026-07-28", lostHours: 5, cause: "Falta de material" },
    ],
    8,
  );

  assert.equal(metrics.recordedHours, 8);
  assert.equal(metrics.lostHours, 8);
  assert.equal(metrics.productiveHours, 0);
  assert.ok(
    Math.abs(metrics.causes.reduce((sum, item) => sum + item.hours, 0) - 8) <
      0.0001,
  );
  assert.ok(
    Math.abs(metrics.causes.reduce((sum, item) => sum + item.share, 0) - 100) <
      0.0001,
  );
});

test("uses an eight-hour default and accepts a configurable daily journey", () => {
  assert.equal(normalizeDailyWorkHours(undefined), 8);
  assert.equal(normalizeDailyWorkHours(0), 8);
  assert.equal(normalizeDailyWorkHours(10), 10);
  assert.equal(normalizeDailyWorkHours(30), 24);
});
