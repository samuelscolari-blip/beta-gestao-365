/*
 * ModuleHeader — extração mecânica do cabeçalho de módulo.
 *
 * Nesta etapa o componente ainda emite a classe global `.module-heading`,
 * de propósito: mover código e mudar aparência são riscos de naturezas
 * diferentes, e juntá-los tornaria impossível saber qual dos dois causou
 * uma eventual regressão. A troca por CSS Module vem na etapa seguinte.
 */
import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import test from "node:test";

const COMPONENT_PATH = "app/ui/ModuleHeader/ModuleHeader.tsx";
const component = readFileSync(COMPONENT_PATH, "utf8");

/** Percorre app/ inteiro: a versão anterior lia só o BetaApp.tsx. */
function listTsxFiles(directory = "app") {
  return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const path = join(directory, entry.name);
    if (entry.isDirectory()) return listTsxFiles(path);
    return entry.name.endsWith(".tsx") ? [path] : [];
  });
}

test("nenhum arquivo monta o cabeçalho à mão, em lugar nenhum de app/", () => {
  /*
   * A versão anterior deste teste lia apenas o BetaApp.tsx e afirmava que
   * "todas as telas usam o componente". Por isso não viu que o
   * TerminationStudio.tsx continuava montando o cabeçalho manualmente — deu
   * falsa segurança justamente sobre o que deveria garantir. Agora percorre
   * app/ inteiro, recursivamente.
   */
  const manuais = listTsxFiles()
    .filter((path) => path !== COMPONENT_PATH)
    .filter((path) =>
      /className\s*=\s*["'`][^"'`]*\bmodule-heading\b/.test(
        readFileSync(path, "utf8"),
      ),
    );

  assert.deepEqual(
    manuais,
    [],
    "Cabeçalho montado à mão. Use <ModuleHeader>: com o HTML repetido em " +
      "vários lugares, treze arquivos CSS disputam a mesma classe global e " +
      "ninguém consegue prever qual regra vence.",
  );
});

test("os oito pontos de renderização usam o componente", () => {
  const usos = listTsxFiles()
    .filter((path) => path !== COMPONENT_PATH)
    .reduce(
      (total, path) =>
        total + (readFileSync(path, "utf8").match(/<ModuleHeader\b/g)?.length ?? 0),
      0,
    );

  assert.equal(
    usos,
    8,
    "Sete pontos vivem no BetaApp.tsx e um no TerminationStudio.tsx.",
  );
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
  const fontes = listTsxFiles()
    .filter((path) => path !== COMPONENT_PATH)
    .map((path) => readFileSync(path, "utf8"))
    .join("\n");

  for (const variante of [
    "compliance-heading",
    "payroll-heading",
    "manual-heading",
    "admin-heading",
    "tax-heading",
    // A Rescisão acumula duas classes na mesma tela.
    "payroll-heading termination-heading",
  ]) {
    assert.ok(
      fontes.includes(`variantClass="${variante}"`),
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
