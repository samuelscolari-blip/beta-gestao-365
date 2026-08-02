import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const source = (path) => readFile(new URL(`../${path}`, import.meta.url), "utf8");

test("V67 moves proven productivity to the top of Machines", async () => {
  const app = await source("app/components/BetaApp.tsx");

  assert.match(app, /function MachineProductivityPanel/);
  assert.match(app, /Horas produzidas e causas de perda/);
  assert.match(
    app,
    /activeView === "assets"[\s\S]*?<MachineProductivityPanel[\s\S]*?<MachineExecutivePanel/,
  );
  assert.doesNotMatch(app, /LEITURA DA OBRA/);
  assert.doesNotMatch(app, /Positivo e negativo/);
  assert.doesNotMatch(app, /construction-loss-card/);
});

test("V67 aligns executive panels and prevents financial agenda overlap", async () => {
  const layout = await source("app/layout.tsx");
  const css = await source("app/v67.css");

  assert.match(layout, /import "\.\/v65\.css";\s*import "\.\/v67\.css";/);
  assert.match(css, /--v67-editorial-width:\s*1200px/);
  assert.match(css, /\.management-overview \.missing\s*\{\s*display:\s*grid !important/);
  assert.match(css, /repeat\(auto-fit, minmax\(210px, 1fr\)\)/);
  assert.match(
    css,
    /grid-template-columns:\s*112px minmax\(0, 1fr\) minmax\(150px, auto\) 18px/,
  );
  assert.match(css, /\.deadline-date[\s\S]*?border-right:\s*1px solid/);
  assert.match(css, /container-name:\s*deadline-v67/);
});

