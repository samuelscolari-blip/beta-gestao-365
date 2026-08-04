import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const secureV52 = await readFile(
  "app/components/SecureBetaAppV52.tsx",
  "utf8",
);
const betaAppV52 = await readFile(
  "app/components/BetaAppV52.tsx",
  "utf8",
);

test("V102 mostra a faixa executiva em qualquer módulo real", () => {
  assert.match(betaAppV52, /moduleMap\[activeView\] \? \(/);
  assert.doesNotMatch(
    betaAppV52,
    /\["purchases", "cards", "rentals", "food", "expenses"\]\.includes\(activeModule\)/,
  );
});

test("V102 remove os botões de Fornecedores ao sair da tela de Fornecedores", () => {
  assert.match(
    secureV52,
    /const existingLinks = strip\?\.querySelector<HTMLElement>\(".v52-financial-links"\)/,
  );
  assert.match(
    secureV52,
    /\} else if \(existingLinks\) \{\s*existingLinks\.remove\(\);/,
  );
});

test("A faixa executiva usa o estado real da tela (React) em vez de adivinhar pelo texto do menu", async () => {
  const app = await readFile("app/components/BetaApp.tsx", "utf8");

  assert.match(app, /onActiveViewChange\?\.\(activeView\)/);
  assert.match(betaAppV52, /onActiveViewChange=\{setActiveView\}/);
  assert.match(
    betaAppV52,
    /function V52Enhancer\(\{\s*isAdmin,\s*activeView,/,
  );
  assert.doesNotMatch(
    betaAppV52,
    /Object\.values\(moduleMap\)\.find\(\(module\) =>\s*activeText\.includes\(normalized\(module\.shortLabel\)\)/,
  );
});
