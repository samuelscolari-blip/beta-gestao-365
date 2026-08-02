import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const source = (path) => readFile(new URL(`../${path}`, import.meta.url), "utf8");

test("V64 is loaded last and responds to the available workspace", async () => {
  const layout = await source("app/layout.tsx");
  const css = await source("app/professional-layout-v64.css");

  assert.match(
    layout,
    /import "\.\/v61\.css";\s*import "\.\/professional-layout-v64\.css";/,
  );
  assert.match(css, /container-name:\s*construction-executive/);
  assert.match(css, /@container construction-executive \(max-width: 1080px\)/);
  assert.match(css, /grid-template-columns:\s*repeat\(2, minmax\(0, 1fr\)\)/);
  assert.match(css, /background-color:\s*#0d3a58/);
  assert.match(css, /-webkit-line-clamp:\s*unset/);
});

test("the live diagnostic rejects clipping, poor contrast and uneven panels", async () => {
  const diagnostic = await source("scripts/live-browser-diagnostic.mjs");

  assert.match(diagnostic, /horizontalOverflow/);
  assert.match(diagnostic, /costToConstructionRatio < 0\.9/);
  assert.match(diagnostic, /fleetContrast < 4\.5/);
  assert.match(diagnostic, /costFooterRatio > 1\.12/);
  assert.match(diagnostic, /Emulation\.setDeviceMetricsOverride/);
});
