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
const STYLES_PATH = "app/ui/ModuleHeader/ModuleHeader.module.css";
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

/** Remove comentários antes de procurar código: um `!important` citado em
 *  comentário não é um `!important` aplicado. Foi assim que a auditoria de
 *  dívida também contava errado, antes de passar a usar o parser. */
const semComentarios = (fonte) =>
  fonte.replace(/\/\*[\s\S]*?\*\//g, "").replace(/\/\/[^\n]*/g, "");

/** As quatro classes globais das quais o CSS legado depende. */
const CLASSES_LEGADAS = [
  "module-heading",
  "module-title-wrap",
  "module-big-icon",
  "eyebrow",
];

/*
 * Junta apenas o TEXTO que o componente pode emitir como classe: o conteúdo
 * de aspas e de crases, sem comentários.
 *
 * Procurar o nome no arquivo inteiro não serve: `eyebrow` aparece também em
 * `styles.eyebrow`, que é o caminho migrado — o oposto do que se quer achar.
 * Sobrar um pedaço de expressão de dentro de `${...}` não atrapalha: se um
 * nome legado aparecer ali, é justamente o caso a acusar.
 */
const literaisDe = (fonte) =>
  (semComentarios(fonte).match(/"[^"]*"|`[^`]*`/g) ?? []).join(" ");

test("o componente preserva a estrutura de DOM que o CSS existente espera", () => {
  /*
   * A versão anterior deste teste procurava os literais exatos do JSX
   * (`className="module-title-wrap"`, `<h1>{title}</h1>`). Isso amarrava o
   * teste à ESCRITA e não à estrutura: assim que a variante migrada passou
   * a escolher a classe em tempo de execução, ele falhou sem que nenhum
   * elemento tivesse mudado de lugar. É o mesmo erro de proxy frágil que
   * já custou uma correção no teste de envoltório, logo abaixo.
   *
   * O que importa é o contrato, e ele tem duas metades:
   */

  // 1. Os pontos de ancoragem no DOM, que não dependem de classe nenhuma.
  //    São eles que os consumidores em JS e a linha de base usam.
  for (const ancora of [
    "module-header",
    "module-header-title-wrap",
    "module-header-icon",
    "module-header-eyebrow",
  ]) {
    assert.match(
      component,
      new RegExp(`data-ui="${ancora}"`),
      `Âncora de DOM ausente do componente: data-ui="${ancora}"`,
    );
  }

  // 2. As classes globais que as variantes AINDA não migradas precisam
  //    receber — 152 regras legadas dependem delas. Só desaparecem quando
  //    a última variante sair do caminho antigo.
  for (const classeLegada of CLASSES_LEGADAS) {
    assert.ok(
      literaisDe(component).includes(classeLegada),
      `Classe legada perdida: ${classeLegada}. As variantes ainda não ` +
        "migradas dependem dela.",
    );
  }
});

test("nenhum elemento recebe as classes do módulo e a global ao mesmo tempo", () => {
  /*
   * A regra que sustenta a migração fatiada: uma variante usa o CSS Module
   * OU a classe global, nunca as duas. Juntas, recriariam exatamente a
   * disputa de regras que esta reforma existe para acabar — o cabeçalho
   * com fundo claro e texto branco nasceu assim.
   *
   * A conferência só é simples porque o componente concentra a escolha em
   * dois objetos, `proprias` e `legadas`. Se a escolha voltar a se espalhar
   * pelo JSX, este teste falha por não achar os blocos, que é o aviso certo.
   */
  const bloco = (nome) =>
    component.match(new RegExp(`const ${nome} = \\{[\\s\\S]*?\\n  \\};`))?.[0];

  const proprias = bloco("proprias");
  const legadas = bloco("legadas");

  assert.ok(
    proprias && legadas,
    "O componente não declara mais as duas famílias de classe em blocos " +
      "separados. Sem isso não há como garantir que não se misturem.",
  );

  for (const classeLegada of CLASSES_LEGADAS) {
    assert.ok(
      !literaisDe(proprias).includes(classeLegada),
      `A variante migrada emite a classe global "${classeLegada}": as ` +
        "regras legadas voltariam a valer por cima do CSS Module.",
    );
  }
  assert.doesNotMatch(
    legadas,
    /styles\.\w+/,
    "A variante legada recebeu classe do CSS Module.",
  );

  /* E o JSX não pode contornar os dois blocos escrevendo classe à mão. */
  const jsx = component.slice(component.indexOf("return ("));
  const manuais = jsx.match(/className=\{(?!cls\.\w+\})[^}]*\}/g) ?? [];
  assert.deepEqual(
    manuais,
    [],
    "Classe montada fora dos dois blocos — use cls.*, ou a garantia acima " +
      "deixa de valer.",
  );
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
  assert.doesNotMatch(semComentarios(component), /!important/);
  assert.doesNotMatch(
    semComentarios(readFileSync(STYLES_PATH, "utf8")),
    /!important/,
    "O CSS Module do componente precisa vencer por ser o dono do elemento, " +
      "não por !important.",
  );

  /*
   * Um elemento a mais entre a <section> e o wrapper do título mudaria o
   * resultado de seletores com combinador filho no CSS legado.
   *
   * Duas versões anteriores erraram aqui por medir proxies: primeiro a
   * DISTÂNCIA em caracteres entre os dois, depois o literal da classe —
   * ambos quebraram sem que nenhum elemento tivesse mudado de lugar. A
   * âncora `data-ui` não muda com a migração, e é a que os consumidores
   * usam de verdade.
   */
  const inicio = component.indexOf("<section");
  const wrap = component.indexOf('data-ui="module-header-title-wrap"');

  assert.ok(inicio > -1 && wrap > inicio, "Estrutura esperada não encontrada.");
  assert.doesNotMatch(
    semComentarios(
      component.slice(
        component.indexOf(">", component.indexOf("data-module=", inicio)) + 1,
        component.lastIndexOf("<div", wrap),
      ),
    ),
    /<[a-zA-Z]/,
    "Existe um elemento entre a <section> e o wrapper do título.",
  );
});
