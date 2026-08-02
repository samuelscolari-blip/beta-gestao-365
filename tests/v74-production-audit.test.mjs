import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const source = (path) => readFile(new URL(`../${path}`, import.meta.url), "utf8");

test("V74 is loaded after all previous visual layers", async () => {
  const layout = await source("app/layout.tsx");
  const v73 = layout.indexOf('import "./v73-pr36-followup.css";');
  const v74 = layout.indexOf('import "./v74-production-audit.css";');
  assert.ok(v73 >= 0);
  assert.ok(v74 > v73);
});

test("the construction executive uses a continuous dark surface", async () => {
  const css = await source("app/v74-production-audit.css");
  assert.match(css, /construction-executive\.construction-executive-v2/);
  assert.match(css, /linear-gradient\(150deg, #062642 0%, #082f4b 52%, #0a3855 100%\)/);
  assert.match(css, /construction-stage-track/);
  assert.match(css, /grid-template-columns: repeat\(10, minmax\(0, 1fr\)\)/);
});

test("financial KPI values cannot wrap and empty fleet has readable contrast", async () => {
  const css = await source("app/v74-production-audit.css");
  assert.match(css, /white-space: nowrap !important/);
  assert.match(css, /construction-machine-empty/);
  assert.match(css, /color: #ffffff/);
  assert.match(css, /color: #b9d8e3/);
  assert.match(css, /color: #85e3f1/);
});

test("the live diagnostic only measures fleet contrast when a row exists", async () => {
  const diagnostic = await source("scripts/live-browser-diagnostic.mjs");
  assert.match(
    diagnostic,
    /state\.layout\?\.fleetRow && state\.layout\?\.fleetContrast < 4\.5/,
  );
});

test("the production layout does not generate unreachable vinext font assets", async () => {
  const layout = await source("app/layout.tsx");
  assert.doesNotMatch(layout, /next\/font\/google/);
  assert.doesNotMatch(layout, /Geist(?:_Mono)?\(/);
  assert.match(layout, /ui-sans-serif/);
  assert.match(layout, /Segoe UI/);
});
