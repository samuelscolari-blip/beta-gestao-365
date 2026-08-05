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

test("as três variantes têm CSS próprio", () => {
  /*
   * A migração terminou de subir: nenhuma variante depende mais das 152
   * regras globais. O caminho legado continua no arquivo como rede — se
   * alguma tela aparecer errada em produção, tirar uma variante da lista
   * abaixo devolve ela ao comportamento antigo em uma linha. Some na
   * etapa 5D, junto com as regras.
   */
  const linha = component.match(/const migrada =[\s\S]*?;/)?.[0] ?? "";
  const migradas = [...linha.matchAll(/variant === "(\w+)"/g)].map((m) => m[1]);

  assert.deepEqual(
    migradas.sort(),
    ["executive", "financial", "standard"],
    "Toda variante precisa de CSS próprio. Uma que fique de fora volta a " +
      "depender das regras globais, que é o problema que a reforma resolve.",
  );

  // A rede: enquanto as regras legadas existirem, o caminho antigo fica.
  assert.match(
    component,
    /root: variantClass \? `module-heading \$\{variantClass\}` : "module-heading"/,
  );
});

test("cada variante declarada tem um bloco no CSS Module", () => {
  /*
   * O componente escolhe a classe por `styles[variant]`. Se um nome de
   * variante não existir no CSS Module, isso vira `undefined` em silêncio
   * e a tela sai sem estilo nenhum — sem erro de compilação, sem aviso.
   */
  const css = readFileSync(
    "app/ui/ModuleHeader/ModuleHeader.module.css",
    "utf8",
  );
  const declaradas =
    component
      .match(/ModuleHeaderVariant\s*=\s*([^;]+);/)?.[1]
      .match(/"(\w+)"/g)
      ?.map((v) => v.replaceAll('"', "")) ?? [];

  assert.ok(declaradas.length === 3, "As três variantes sumiram do tipo.");
  for (const variante of declaradas) {
    /*
     * Basta a classe existir em ALGUM seletor: `.executive` mora num
     * seletor agrupado com `.financial`, porque as duas compartilham
     * fundo e sombra, e um CSS Module exporta a classe do mesmo jeito.
     * Exigir bloco exclusivo reprovaria um agrupamento correto.
     */
    assert.match(
      css,
      new RegExp(`\\.${variante}[\\s,:.{]`),
      `A variante "${variante}" não aparece no CSS Module: styles.` +
        `${variante} sairia undefined e a tela ficaria sem estilo.`,
    );
  }
});
