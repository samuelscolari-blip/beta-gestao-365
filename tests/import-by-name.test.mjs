/*
 * Identificação por NOME na importação.
 *
 * Decisão de Samuel Scolari: as planilhas de RH da empresa trazem o nome do
 * funcionário na primeira coluna, então é por ele que a atualização precisa
 * funcionar. Pedir CPF obrigaria a remontar o arquivo que eles já usam.
 *
 * O risco que estes testes guardam: nome NÃO identifica pessoa. Homônimo
 * existe, e numa folha de milhares de linhas é questão de tempo. Atualizar
 * o salário do "José Carlos Santos" errado é um erro que ninguém percebe
 * olhando o total — por isso nome repetido não atualiza ninguém.
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const arquivo = readFileSync("db/records.ts", "utf8");
const registros = arquivo.slice(
  arquivo.indexOf("export async function createMany"),
);
const planilha = readFileSync("app/lib/spreadsheet.ts", "utf8");

test("o nome é comparado sem acento, sem caixa e sem espaço sobrando", () => {
  /*
   * A mesma pessoa vem como "José da Silva", "JOSE DA SILVA" e
   * "  José  da Silva " em planilhas diferentes. Comparar o texto cru faria
   * cada variação virar cadastro novo — o oposto do que se quer.
   */
  assert.match(arquivo, /function normalizeName\(value: unknown\): string/);
  assert.match(arquivo, /\.normalize\("NFD"\)/);
  assert.match(arquivo, /\[\\u0300-\\u036f\]/);
  assert.match(arquivo, /\.toLowerCase\(\)/);
  assert.match(arquivo, /replace\(\/\\s\+\/g, " "\)/);
});

test("nome repetido em dois cadastros NÃO atualiza nenhum", () => {
  /*
   * A trava mais importante deste arquivo. Com dois cadastros de mesmo
   * nome, escolher um deles mexeria no salário de quem não devia — e o
   * total da folha continuaria fechando, escondendo o erro.
   *
   * O comportamento seguro é recusar: a linha vira cadastro novo, o número
   * não fecha, e a duplicidade aparece para ser tratada à mão.
   */
  assert.match(
    registros,
    /if \(existingByName\.has\(chave\)\) existingByName\.set\(chave, null\);/,
  );
  assert.match(
    registros,
    /existingByName\.get\(`\$\{input\.module\}::\$\{nomeDaLinha\}`\) \|\| null/,
  );
});

test("o nome é a ÚLTIMA alternativa, depois de código e CPF", () => {
  /*
   * A ordem é a da confiabilidade. Código é chave própria do sistema e não
   * muda; CPF identifica a pessoa; nome é o que sobra. Inverter faria uma
   * linha com CPF preenchido ser resolvida pelo critério mais frágil.
   */
  const trecho = registros.match(/const existing =[\s\S]*?;\n/)?.[0] ?? "";
  assert.ok(trecho, "A resolução do registro existente sumiu.");

  const posImportKey = trecho.indexOf("existingByImportKey");
  const posReferencia = trecho.indexOf("existingByReference");
  const posCpf = trecho.indexOf("existingByCpf");
  const posNome = trecho.indexOf("existingByName");

  assert.ok(posNome > -1, "O nome não entrou na resolução.");
  assert.ok(
    posImportKey < posReferencia &&
      posReferencia < posCpf &&
      posCpf < posNome,
    "A ordem precisa ser código, CPF e só então nome.",
  );
});

test("nome curto demais não serve de chave", () => {
  /*
   * Uma célula com "A" ou "-" casaria com qualquer coisa parecida e
   * atualizaria um cadastro ao acaso.
   */
  assert.match(registros, /if \(nome\.length < 3\) continue;/);
  assert.match(registros, /nomeDaLinha\.length >= 3/);
});

test("o nome abre a planilha, seguido de CPF e código", () => {
  const modelo =
    planilha.match(/export async function exportImportTemplate[\s\S]*?\n\}/)?.[0] ??
    "";
  const posNome = modelo.indexOf("chaveNome ? [chaveNome]");
  const posCpf = modelo.indexOf("chaveCpf ? [chaveCpf]");
  const posRef = modelo.indexOf("referencia ? [referencia]");

  assert.ok(posNome > -1 && posCpf > -1 && posRef > -1);
  assert.ok(
    posNome < posCpf && posCpf < posRef,
    "A ordem das colunas precisa ser nome, CPF, código.",
  );
});

test("a planilha avisa o que acontece quando há homônimo", () => {
  /*
   * Quem preenche precisa saber que duas pessoas de mesmo nome não são
   * atualizadas, e o que fazer nesse caso. Sem o aviso, a linha some do
   * resultado esperado e parece defeito do sistema.
   */
  assert.match(planilha, /DUAS\s+" \+\s+"pessoas com o mesmo nome/);
  assert.match(planilha, /preencha o CPF ou o código/);
});
