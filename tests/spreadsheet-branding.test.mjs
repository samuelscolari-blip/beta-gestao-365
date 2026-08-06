/*
 * Identidade visual das planilhas — e a dependência que ela cria.
 *
 * A faixa "BETA CONSTRUTORA" ocupa a primeira linha do arquivo, então o
 * cabeçalho deixa de ser a linha 1. Isso SÓ funciona porque o importador
 * procura o cabeçalho nas 25 primeiras linhas em vez de assumir a
 * primeira.
 *
 * São dois arquivos diferentes, e nada no código de um avisa que o outro
 * depende dele. Se alguém "otimizar" a busca para olhar só a linha 1, a
 * exportação continua bonita e a importação para de reconhecer o próprio
 * arquivo do sistema — em silêncio, porque coluna não reconhecida é
 * ignorada, não acusada.
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const planilha = readFileSync("app/lib/spreadsheet.ts", "utf8");

test("a faixa da empresa abre toda planilha exportada", () => {
  assert.match(planilha, /const AZUL_BETA = "#17324d";/);
  assert.match(planilha, /value: "BETA CONSTRUTORA"/);
  assert.match(planilha, /textColor: "#ffffff"/);

  /* Modelo, exportação de módulo e backup completo. */
  const usos = planilha.match(/faixaDaEmpresa\(/g) ?? [];
  assert.ok(
    usos.length >= 4,
    `A faixa aparece em ${usos.length} lugares; esperado ao menos 4 ` +
      "(definição, modelo, aba de instruções, exportação e backup).",
  );
});

test("a faixa pinta a linha inteira, não só a primeira célula", () => {
  /*
   * A biblioteca de Excel não mescla células. Sem pintar as demais, a cor
   * pararia na primeira coluna e o resultado pareceria erro de formatação.
   */
  const fn = planilha.match(/function faixaDaEmpresa[\s\S]*?\n\}/)?.[0] ?? "";
  assert.ok(fn, "A faixa sumiu.");
  assert.match(fn, /Array\.from\(\{ length: Math\.max\(0, colunas - 1\) \}/);
  assert.match(fn, /backgroundColor: AZUL_BETA/);
});

test("o importador continua procurando o cabeçalho além da primeira linha", () => {
  /*
   * A dependência que a faixa cria. Se este laço voltar a olhar só a linha
   * 1, toda planilha gerada pelo sistema deixa de ser importável por ele
   * mesmo.
   */
  assert.match(
    planilha,
    /for \(let rowIndex = 0; rowIndex < Math\.min\(rows\.length, 25\); rowIndex \+= 1\)/,
    "A busca do cabeçalho precisa varrer as primeiras linhas: a faixa da " +
      "empresa ocupa a linha 1.",
  );
});

test("a faixa e o cabeçalho ficam fixos ao rolar", () => {
  /*
   * Com a faixa, congelar uma linha só deixaria o cabeçalho rolar para
   * fora da tela — e numa planilha de milhares de linhas isso obriga a
   * subir toda hora para lembrar qual coluna é qual.
   */
  const congeladas = planilha.match(/stickyRowsCount: (\d+)/g) ?? [];
  assert.ok(congeladas.length > 0, "A configuração de linhas fixas sumiu.");
  for (const item of congeladas) {
    assert.equal(
      item,
      "stickyRowsCount: 2",
      "Com a faixa no topo, são duas linhas a congelar: faixa e cabeçalho.",
    );
  }
});

test("a cor da empresa está num lugar só", () => {
  /*
   * Antes o azul aparecia solto em cada cabeçalho. Repetido, mudar a
   * identidade visual exigiria caçar ocorrências — e uma esquecida deixa a
   * planilha com duas cores.
   */
  const semDefinicao = planilha.replace(/const AZUL_BETA = "#17324d";/, "");
  assert.doesNotMatch(
    semDefinicao,
    /#17324d/,
    "O azul da empresa precisa vir de AZUL_BETA, não repetido no arquivo.",
  );
});
