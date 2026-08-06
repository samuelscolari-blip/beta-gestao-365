/*
 * Modelo de importação do Cadastro de Funcionários.
 *
 * Existe porque o botão de exportar só serve quando JÁ há registros, e quem
 * mais precisa do modelo é justamente quem ainda não tem nenhum.
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const planilha = readFileSync("app/lib/spreadsheet.ts", "utf8");
const modules = readFileSync("app/lib/modules.ts", "utf8");
const betaApp = readFileSync("app/components/BetaApp.tsx", "utf8");

test("o modelo existe e traz uma aba explicando cada coluna", () => {
  assert.match(planilha, /export async function exportImportTemplate/);
  assert.match(planilha, /sheet: "Como preencher"/);
  /*
   * O nome passou a levar a marca e a tela de origem, sem acento: dez
   * exportações viram dez arquivos na área de trabalho, e o engenheiro que
   * abre depois precisa saber de onde cada um saiu.
   */
  assert.match(planilha, /Beta_Construtora_Modelo_\$\{nomeDeArquivo\(module\.shortLabel\)\}/);
});

test("o modelo destaca o que o cálculo exige", () => {
  /*
   * A diferença entre "cadastro preenchido" e "cadastro que calcula" não é
   * óbvia para quem preenche a planilha: sem salário o contracheque sai
   * zerado, sem data de admissão a rescisão não tem de onde contar o aviso
   * prévio. O modelo marca essas colunas em outra cor e diz SIM na aba de
   * instruções.
   */
  const bloco =
    planilha.match(/CAMPOS_QUE_O_CALCULO_EXIGE[\s\S]*?\n\};/)?.[0] ?? "";
  for (const campo of [
    "name",
    "salary",
    "monthlyHours",
    "admissionDate",
    "status",
    "role",
    "dependents",
  ]) {
    assert.ok(bloco.includes(`"${campo}"`), `Campo essencial ausente: ${campo}`);
  }
});

test("o cabeçalho do modelo usa os rótulos que o importador reconhece", () => {
  /*
   * O modelo escreve `field.label`, e é por `label` e `aliases` que a
   * importação casa as colunas. Gerar um cabeçalho diferente produziria uma
   * planilha bonita que o próprio sistema ignoraria.
   */
  const fn =
    planilha.match(/export async function exportImportTemplate[\s\S]*?\n\}/)?.[0] ??
    "";
  assert.match(fn, /value: field\.label/);
});

test("todo campo que o cálculo exige é importável por nome", () => {
  /*
   * Uma coluna cujo nome o importador não reconhece é ignorada em silêncio
   * — parece que "importou e não veio nada". Cada campo essencial precisa
   * de rótulo estável e apelidos para as variações que as planilhas reais
   * usam.
   */
  for (const campo of [
    "salary",
    "monthlyHours",
    "weeklyHours",
    "dependents",
    "admissionDate",
    "role",
    "status",
    "terminationDate",
    "livesOutOfTown",
    "homeCity",
  ]) {
    const declaracao =
      modules.match(new RegExp(`\\{ key: "${campo}",[^}]*\\}`))?.[0] ?? "";
    assert.ok(declaracao, `Campo sumiu do cadastro: ${campo}`);
    assert.match(
      declaracao,
      /aliases: \[/,
      `O campo ${campo} não tem apelidos de importação: uma planilha com o ` +
        "nome ligeiramente diferente seria ignorada sem avisar.",
    );
  }
});

test("o botão de modelo vem antes do de importar", () => {
  /* É a ordem do trabalho: baixar, preencher, importar. */
  /* A busca do fim parte do início do trecho: "internal-code-button"
     também aparece antes no arquivo, e procurar desde o começo devolvia
     uma fatia vazia. Mesmo tropeço já cometido no teste do contracheque. */
  const inicio = betaApp.indexOf("canEdit && isImportableModule(module.id) ?");
  const barra = betaApp.slice(
    inicio,
    betaApp.indexOf("internal-code-button", inicio),
  );
  assert.ok(barra.indexOf("exportImportTemplate") > -1, "Botão de modelo ausente.");
  assert.ok(
    barra.indexOf("exportImportTemplate") < barra.indexOf("onClick={onImport}"),
    "O modelo precisa vir antes do importar.",
  );
});
