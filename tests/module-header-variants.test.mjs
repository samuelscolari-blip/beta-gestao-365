/*
 * Variantes declaradas do cabeçalho.
 *
 * `.module-heading` esconde TRÊS estruturas visuais diferentes. Medidas no
 * navegador, a 1366px:
 *
 *   executive  flex · altura 132px · ícone 64px
 *   financial  flex · altura 164px · ícone 64px
 *   standard   GRID · altura 166px · ícone 78px
 *
 * A diferença entre flex e grid não é ajuste fino — é outra estrutura. Por
 * isso a variante passou a ser declarada pelo React, e não deduzida por
 * `:has()` ou pela barra lateral, que foi como os defeitos de cabeçalho
 * desta sessão nasceram.
 *
 * A conferência de que cada tela recebeu a variante certa é feita contra a
 * geometria real do navegador; aqui garantimos apenas que ninguém volte a
 * renderizar um cabeçalho sem declarar a estrutura.
 */
import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import test from "node:test";

const COMPONENT_PATH = "app/ui/ModuleHeader/ModuleHeader.tsx";
const component = readFileSync(COMPONENT_PATH, "utf8");

function listTsxFiles(directory = "app") {
  return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const path = join(directory, entry.name);
    if (entry.isDirectory()) return listTsxFiles(path);
    return entry.name.endsWith(".tsx") ? [path] : [];
  });
}

test("o componente declara as três estruturas e os acentos semânticos", () => {
  assert.match(
    component,
    /ModuleHeaderVariant\s*=\s*"executive"\s*\|\s*"financial"\s*\|\s*"standard"/,
  );
  for (const acento of ["payroll", "compliance", "admin", "tax"]) {
    assert.ok(
      component.includes(`"${acento}"`),
      `Acento semântico ausente: ${acento}`,
    );
  }
});

test("o componente expõe identidade estável no DOM", () => {
  // `data-ui` é âncora para testes e para o CSS Module das próximas etapas;
  // `data-variant` e `data-accent` levam ao CSS o que o React já sabe.
  assert.match(component, /data-ui="module-header"/);
  assert.match(component, /data-variant=\{variant\}/);
  assert.match(component, /data-accent=\{accent\}/);
});

test("nenhum ponto de renderização deixa de declarar a estrutura", () => {
  const semVariante = [];

  for (const path of listTsxFiles().filter((p) => p !== COMPONENT_PATH)) {
    const fonte = readFileSync(path, "utf8");
    for (const uso of fonte.match(/<ModuleHeader\b[\s\S]{0,160}/g) ?? []) {
      if (!/\bvariant=/.test(uso)) semVariante.push(path);
    }
    /* O ModulePage repassa a variante de quem o chama; ele não deduz. */
    for (const uso of fonte.match(/<ModulePage\b[\s\S]{0,120}/g) ?? []) {
      if (!/\bvariant=/.test(uso)) semVariante.push(`${path} (ModulePage)`);
    }
  }

  assert.deepEqual(
    semVariante,
    [],
    "Cabeçalho renderizado sem declarar a estrutura. Passe " +
      'variant="executive" | "financial" | "standard" — o CSS não deve ' +
      "descobrir isso sozinho.",
  );
});

test("a classe global continua sendo emitida nesta etapa", () => {
  /*
   * Ainda é preparação: as 152 regras legadas dependem de `.module-heading`.
   * Remover a classe aqui, antes de o CSS Module existir, quebraria todas as
   * telas de uma vez. A troca acontece variante por variante.
   */
  assert.match(component, /className=\{variantClass \? `module-heading /);
});
