import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const wrapper = readFileSync(
  "app/components/SecureBetaAppV101.tsx",
  "utf8",
);
const page = readFileSync("app/page.tsx", "utf8");
const betaApp = readFileSync("app/components/BetaApp.tsx", "utf8");

test("o importador canônico continua sendo o da barra da tabela", () => {
  assert.match(
    betaApp,
    /\.table-toolbar[\s\S]*exportImportTemplate\(module\)[\s\S]*onClick=\{onImport\}/,
  );
  assert.match(wrapper, /\.table-toolbar button/);
  assert.match(wrapper, /buttonLabel\(button\) === "importar"/);
});

test("a chamada grande Modelo padrão é retirada quando estiver no DOM", () => {
  assert.match(wrapper, /buttonLabel\(button\) === "baixar modelo"/);
  assert.match(wrapper, /buttonLabel\(button\) === "importar planilha"/);
  assert.match(wrapper, /if \(card\) card\.remove\(\)/);
});

test("atalhos repetidos do estado vazio não recriam uma segunda importação", () => {
  assert.match(
    wrapper,
    /if \(buttonLabel\(button\) === "importar planilha"\) button\.remove\(\)/,
  );
});

test("a aplicação publicada usa a camada V101", () => {
  assert.match(page, /import SecureBetaAppV101/);
  assert.match(page, /<SecureBetaAppV101/);
});
