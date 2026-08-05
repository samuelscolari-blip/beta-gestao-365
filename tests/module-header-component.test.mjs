/*
 * ModuleHeader — extração mecânica do cabeçalho de módulo.
 *
 * Nesta etapa o componente ainda emite a classe global `.module-heading`,
 * de propósito: mover código e mudar aparência são riscos de naturezas
 * diferentes, e juntá-los tornaria impossível saber qual dos dois causou
 * uma eventual regressão. A troca por CSS Module vem na etapa seguinte.
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const component = readFileSync("app/ui/ModuleHeader/ModuleHeader.tsx", "utf8");
const betaApp = readFileSync("app/components/BetaApp.tsx", "utf8");

test("todas as telas usam o componente, nenhuma monta o cabeçalho à mão", () => {
  assert.doesNotMatch(
    betaApp,
    /<section className="module-heading/,
    "Alguma tela voltou a montar o cabeçalho manualmente. Use <ModuleHeader>: " +
      "com o HTML repetido em vários lugares, treze arquivos CSS disputavam a " +
      "mesma classe global e ninguém conseguia prever qual regra venceria.",
  );

  const usos = betaApp.match(/<ModuleHeader\b/g) ?? [];
  assert.equal(usos.length, 7, "Esperados 7 pontos de renderização.");
});

test("o componente preserva a estrutura de DOM que o CSS existente espera", () => {
  // A cascata atual depende desta árvore exata. Alterá-la agora quebraria
  // regras de treze arquivos ao mesmo tempo.
  for (const marcador of [
    'className="module-title-wrap"',
    "`module-heading ${variantClass}`",
    "`module-big-icon ${iconClass}`",
    "<h1>{title}</h1>",
    "<p>{description}</p>",
    'className="eyebrow"',
  ]) {
    assert.ok(
      component.includes(marcador),
      `Estrutura esperada ausente do componente: ${marcador}`,
    );
  }
});

test("as classes semânticas de cada tela continuam sendo emitidas", () => {
  for (const variante of [
    "compliance-heading",
    "payroll-heading",
    "manual-heading",
    "admin-heading",
    "tax-heading",
  ]) {
    assert.ok(
      betaApp.includes(`variantClass="${variante}"`),
      `Variante perdida na extração: ${variante}`,
    );
  }
});

test("o componente não introduz envoltório extra nem !important", () => {
  assert.doesNotMatch(component, /!important/);
  // Um <div> a mais entre a section e o module-title-wrap mudaria o
  // resultado de seletores com combinador filho no CSS legado.
  assert.match(
    component,
    /<section[\s\S]{0,220}<div className="module-title-wrap">/,
  );
});
