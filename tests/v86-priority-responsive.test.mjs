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

test("a própria tabela mede a largura disponível", async () => {
  const css = await readFile(cssPath, "utf8");

  assert.match(css, /container-name:\s*v86-machine-table/);
  assert.match(css, /container-type:\s*inline-size/);
  assert.match(css, /@container v86-machine-table \(max-width: 1040px\)/);
  assert.match(css, /@container v86-machine-table \(max-width: 620px\)/);
});

test("a linha estreita usa áreas explícitas para todos os campos", async () => {
  const css = await readFile(cssPath, "utf8");

  for (const area of [
    "machine",
    "operation",
    "stop",
    "impact",
    "priority",
    "arrow",
  ]) {
    assert.match(css, new RegExp(`grid-area:\\s*${area}`));
  }

  assert.match(css, /grid-template-columns:\s*minmax\(0, 1fr\) minmax\(122px, 148px\) 20px/);
  assert.match(css, /max-width:\s*100%/);
  assert.match(css, /overflow:\s*hidden/);
});

test("a grade ampla evita mínimos que excedam o painel operacional", async () => {
  const css = await readFile(cssPath, "utf8");

  assert.match(css, /minmax\(160px, 1fr\)/);
  assert.match(css, /minmax\(190px, 1\.35fr\)/);
  assert.match(css, /minmax\(116px, 0\.58fr\)/);
  assert.doesNotMatch(css, /minmax\(240px, 1\.45fr\)/);
});
