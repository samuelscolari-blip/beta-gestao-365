import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const wrapperV101 = readFileSync(
  "app/components/SecureBetaAppV101.tsx",
  "utf8",
);
const wrapperV102 = readFileSync(
  "app/components/SecureBetaAppV102.tsx",
  "utf8",
);
const page = readFileSync("app/page.tsx", "utf8");
const betaApp = readFileSync("app/components/BetaApp.tsx", "utf8");

test("o importador canônico continua sendo o da barra da tabela", () => {
  const toolbar = betaApp.slice(
    betaApp.indexOf('className="table-toolbar"'),
    betaApp.indexOf('className="empty-state"'),
  );

  assert.match(toolbar, /exportImportTemplate\(module\)/);
  assert.match(toolbar, /onClick=\{onImport\}/);
  assert.match(wrapperV101, /\.table-toolbar button/);
  assert.match(wrapperV101, /buttonLabel\(button\) === "importar"/);
});

test("a chamada grande Modelo padrão é retirada quando estiver no DOM", () => {
  assert.match(wrapperV101, /buttonLabel\(button\) === "baixar modelo"/);
  assert.match(wrapperV101, /buttonLabel\(button\) === "importar planilha"/);
  assert.match(wrapperV101, /if \(card\) card\.remove\(\)/);
});

test("atalhos repetidos do estado vazio não recriam uma segunda importação", () => {
  assert.match(
    wrapperV101,
    /if \(buttonLabel\(button\) === "importar planilha"\) button\.remove\(\)/,
  );
});

test("a aplicação publicada usa V102 e preserva a camada V101", () => {
  assert.match(page, /import SecureBetaAppV102/);
  assert.match(page, /<SecureBetaAppV102/);
  assert.match(wrapperV102, /import SecureBetaAppV101/);
  assert.match(wrapperV102, /<SecureBetaAppV101/);
});
