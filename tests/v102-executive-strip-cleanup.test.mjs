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
  assert.match(betaAppV52, /moduleMap\[activeModule\] \? \(/);
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
