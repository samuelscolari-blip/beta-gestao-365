import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const cssPath = new URL(
  "../app/v86-machine-priority-responsive.css",
  import.meta.url,
);
const layoutPath = new URL("../app/layout.tsx", import.meta.url);

test("a correção responsiva é carregada depois do Design System V86", async () => {
  const layout = await readFile(layoutPath, "utf8");
  const designSystem = layout.indexOf('import "./v86-shared-ui-system.css";');
  const responsiveFix = layout.indexOf(
    'import "./v86-machine-priority-responsive.css";',
  );

  assert.ok(designSystem >= 0);
  assert.ok(responsiveFix > designSystem);
});

test("a própria tabela mede a largura e possui fallback de notebook", async () => {
  const css = await readFile(cssPath, "utf8");

  assert.match(css, /container-name:\s*v86-machine-table/);
  assert.match(css, /container-type:\s*inline-size/);
  assert.match(css, /@container v86-machine-table \(max-width: 1040px\)/);
  assert.match(css, /@container v86-machine-table \(max-width: 620px\)/);
  assert.match(css, /@media \(max-width: 1440px\)/);
  assert.match(css, /@media \(max-width: 720px\)/);
});

test("desktop amplo não recebe grid-area implícita", async () => {
  const css = await readFile(cssPath, "utf8");
  const responsiveStart = css.indexOf(
    "@container v86-machine-table (max-width: 1040px)",
  );

  assert.ok(responsiveStart > 0);
  const desktopRules = css.slice(0, responsiveStart);
  assert.doesNotMatch(desktopRules, /grid-area\s*:/);
  assert.match(
    desktopRules,
    /grid-template-columns:[\s\S]*minmax\(150px, 1fr\)[\s\S]*minmax\(175px, 1\.3fr\)/,
  );
});

test("a linha estreita usa áreas explícitas para todos os campos", async () => {
  const css = await readFile(cssPath, "utf8");

  for (const area of [
    "machine-main",
    "machine-operation",
    "machine-stop",
    "machine-impact",
    "machine-priority",
    "machine-arrow",
  ]) {
    assert.match(css, new RegExp(`grid-area:\\s*${area}`));
  }

  assert.match(
    css,
    /grid-template-columns:\s*minmax\(0, 1fr\) minmax\(118px, 140px\) 18px/,
  );
  assert.match(css, /width:\s*100%\s*!important/);
  assert.match(css, /max-width:\s*100%\s*!important/);
});

test("cada célula pode encolher e textos internos quebram com segurança", async () => {
  const css = await readFile(cssPath, "utf8");

  assert.match(
    css,
    /\.construction-machine-row > \*[\s\S]*min-width:\s*0[\s\S]*max-width:\s*100%/,
  );
  assert.match(css, /white-space:\s*normal\s*!important/);
  assert.match(css, /overflow-wrap:\s*anywhere/);
  assert.match(css, /word-break:\s*normal/);
});

test("a grade ampla evita mínimos que excedam o painel operacional", async () => {
  const css = await readFile(cssPath, "utf8");

  assert.match(css, /minmax\(150px, 1fr\)/);
  assert.match(css, /minmax\(175px, 1\.3fr\)/);
  assert.match(css, /minmax\(108px, 0\.56fr\)/);
  assert.doesNotMatch(css, /minmax\(240px, 1\.45fr\)/);
});
