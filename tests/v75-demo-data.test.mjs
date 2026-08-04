import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const source = (path) => readFile(new URL(`../${path}`, import.meta.url), "utf8");

test("registros fictícios continuam disponíveis nas abas operacionais", async () => {
  const app = await source("app/components/BetaApp.tsx");
  assert.match(
    app,
    /records\.filter\(\(record\) => Boolean\(moduleMap\[record\.module\]\)\)/,
  );
  assert.doesNotMatch(
    app,
    /operationalRecords[\s\S]{0,240}(?:isDemo|demonstracao|ficticio|tst-)/i,
  );
});

test("a Central aceita pedidos reais e fictícios", async () => {
  const app = await source("app/components/BetaApp.tsx");
  assert.match(app, /function isManagementRequest\(record: StoredRecord\)/);
  assert.match(app, /return managementModules\.has\(record\.module\)/);
  assert.doesNotMatch(app, /function isRealManagementRequest/);
  assert.match(app, /Dados reais e fictícios/);
  assert.match(app, /managementDemoCount/);
});

test("listas de aprovados administrativa e pública não excluem testes", async () => {
  for (const path of [
    "app/components/SecureBetaAppV65.tsx",
    "app/components/SecureBetaAppV66.tsx",
  ]) {
    const content = await source(path);
    assert.doesNotMatch(content, /function isRealRecord/);
    assert.doesNotMatch(content, /isRealRecord\(record\)/);
    assert.match(content, /decisionModules\.has\(record\.module\)/);
    assert.match(content, /isApproved\(record\)/);
  }
});

test("o rodapé da Central apresenta quatro informações completas", async () => {
  const app = await source("app/components/BetaApp.tsx");
  const css = await source("app/v75-demo-data.css");
  assert.match(app, /Registros na fila/);
  assert.match(app, /Dados de teste/);
  assert.match(app, /Integridade/);
  assert.match(app, /Valor total da fila/);
  assert.match(app, /Registros fictícios permanecem visíveis em todo o sistema/);
  assert.match(css, /grid-template-columns: repeat\(4, minmax\(0, 1fr\)\)/);
  assert.match(css, /management-footer-stat/);
});

test("a camada V75 é carregada depois das correções anteriores", async () => {
  const layout = await source("app/layout.tsx");
  const v74 = layout.indexOf('import "./v74-production-audit.css";');
  const v75 = layout.indexOf('import "./v75-demo-data.css";');
  assert.ok(v74 >= 0);
  assert.ok(v75 > v74);
});
