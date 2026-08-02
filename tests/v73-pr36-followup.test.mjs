import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const source = (path) =>
  readFile(new URL(`../${path}`, import.meta.url), "utf8");

test("the PR36 follow-up loads after the executive panel refinement", async () => {
  const layout = await source("app/layout.tsx");
  assert.match(layout, /import "\.\/v73-pr36-followup\.css";/);
  assert.ok(
    layout.indexOf('import "./v73-pr36-followup.css";') >
      layout.indexOf('import "./v72-executive-panel.css";'),
  );
});

test("machine productivity responds to its real available width", async () => {
  const css = await source("app/v73-pr36-followup.css");
  assert.match(css, /container-name:\s*machine-productivity-v73/);
  assert.match(css, /container-type:\s*inline-size/);
  assert.match(
    css,
    /@container machine-productivity-v73 \(max-width: 840px\)[\s\S]*grid-template-columns:\s*minmax\(0, 1fr\)/,
  );
});

test("the productivity controls and KPIs collapse safely on narrow panels", async () => {
  const css = await source("app/v73-pr36-followup.css");
  assert.match(css, /@container machine-productivity-v73 \(max-width: 620px\)/);
  assert.match(css, /\.machine-productivity-actions[\s\S]*flex-direction:\s*column/);
  assert.match(css, /\.machine-productivity-kpis[\s\S]*grid-template-columns:\s*minmax\(0, 1fr\)/);
});
