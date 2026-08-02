import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const source = (path) =>
  readFile(new URL(`../${path}`, import.meta.url), "utf8");

test("the V72 executive panel stylesheet is loaded after previous visual layers", async () => {
  const layout = await source("app/layout.tsx");
  assert.match(layout, /import "\.\/v72-executive-panel\.css";/);
  assert.ok(
    layout.indexOf('import "./v72-executive-panel.css";') >
      layout.indexOf('import "./v66.css";'),
  );
});

test("the executive panel uses available width without clipping financial values", async () => {
  const css = await source("app/v72-executive-panel.css");
  assert.match(css, /width: calc\(100% \+ 12px\)/);
  assert.match(css, /construction-kpi-v56 > strong/);
  assert.match(css, /white-space: nowrap/);
  assert.match(css, /font-variant-numeric: tabular-nums/);
  assert.match(css, /construction-budget-card-v56 h3/);
});

test("the panel keeps compact responsive cards on narrow containers", async () => {
  const css = await source("app/v72-executive-panel.css");
  assert.match(css, /@container construction-executive \(max-width: 1080px\)/);
  assert.match(css, /@container construction-executive \(max-width: 620px\)/);
  assert.match(css, /grid-template-columns: minmax\(0, 1fr\)/);
});
