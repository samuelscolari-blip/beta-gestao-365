/*
 * Identificação por CPF na importação.
 *
 * O caso que motivou: a folha da empresa tem milhares de linhas e o RH
 * monta a planilha com o CPF, que é o que eles têm na mão. O código do
 * colaborador é gerado aqui dentro — exigir esse código obrigaria a
 * exportar antes só para descobrir o de cada pessoa.
 *
 * Sem casar por CPF, cada reimportação criaria o quadro inteiro de novo,
 * em silêncio, e o erro só apareceria como número dobrado num relatório.
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const arquivo = readFileSync("db/records.ts", "utf8");
/*
 * Só o corpo de `createMany`: `db/records.ts` tem outras rotinas com
 * UPDATE e com `const existing =`, e procurar no arquivo inteiro devolvia
 * o trecho errado — o teste passava ou falhava por acidente.
 */
const registros = arquivo.slice(
  arquivo.indexOf("export async function createMany"),
);
const planilha = readFileSync("app/lib/spreadsheet.ts", "utf8");

test("o CPF é comparado só por dígitos", () => {
  /*
   * A mesma pessoa aparece como "123.456.789-00" numa planilha e
   * "12345678900" em outra. Comparar o texto cru faria a segunda virar
   * cadastro novo.
   */
  /* `onlyDigits` é utilitário de módulo, declarado antes de createMany. */
  assert.match(arquivo, /function onlyDigits\(value: unknown\): string/);
  assert.match(arquivo, /replace\(\/\\D\/g, ""\)/);
  assert.match(registros, /const cpf = onlyDigits\(payload\.cpf\)/);
  assert.match(registros, /cpf\.length !== 11/);
});

test("a linha é casada por código primeiro, e por CPF depois", () => {
  /*
   * A ordem importa: o código é a chave própria do sistema e não muda; o
   * CPF é a alternativa para quem não tem o código. Inverter faria uma
   * linha com código explícito ser resolvida por outro caminho.
   */
  const trecho =
    registros.match(/const existing =[\s\S]*?;\n/)?.[0] ?? "";
  assert.ok(trecho, "A resolução do registro existente sumiu.");

  const posImportKey = trecho.indexOf("existingByImportKey");
  const posReferencia = trecho.indexOf("existingByReference");
  const posCpf = trecho.indexOf("existingByCpf");

  assert.ok(posImportKey > -1 && posReferencia > -1 && posCpf > -1);
  assert.ok(
    posImportKey < posReferencia && posReferencia < posCpf,
    "O CPF precisa ser a última alternativa, não a primeira.",
  );
});

test("CPF repetido em dois cadastros não atualiza nenhum", () => {
  /*
   * Se dois cadastros têm o mesmo CPF, escolher um deles às cegas mexeria
   * na pessoa errada — e o erro seria invisível. A linha vira cadastro
   * novo e a duplicidade fica à vista para ser resolvida à mão.
   */
  assert.match(
    registros,
    /if \(existingByCpf\.has\(chave\)\) existingByCpf\.set\(chave, null as never\);/,
  );
  assert.match(registros, /existingByCpf\.get\(`\$\{input\.module\}::\$\{cpfDaLinha\}`\) \|\| null/);
});

test("atualizar por CPF não apaga o código do colaborador", () => {
  /*
   * O defeito mais perigoso desta mudança: a linha identificada por CPF não
   * traz o código, e gravar a referência vazia apagaria a chave que liga o
   * cadastro a folha, rescisão e importações futuras. O registro ficaria
   * órfão sem ninguém perceber.
   */
  assert.match(
    registros,
    /const reference = input\.reference \|\| existing\.reference;/,
  );
  assert.match(
    registros,
    /mergedPayload\[referenceField\] =\s*previousPayload\[referenceField\] \?\? existing\.reference;/,
  );

  /* E o UPDATE precisa gravar a referência preservada, não a de entrada. */
  const update = registros.slice(
    registros.indexOf("UPDATE records"),
    registros.indexOf("updated += 1"),
  );
  assert.match(update, /\n            reference,\n/);
  assert.doesNotMatch(update, /input\.reference,/);
});

test("o CPF abre a planilha e é marcado como identificador", () => {
  const modelo =
    planilha.match(/export async function exportImportTemplate[\s\S]*?\n\}/)?.[0] ??
    "";
  assert.match(modelo, /const chaveCpf = module\.fields\.find/);
  assert.match(modelo, /\.\.\.\(chaveCpf \? \[chaveCpf\] : \[\]\)/);
  assert.match(planilha, /IDENTIFICA A PESSOA/);
  assert.match(planilha, /com ou sem pontos/);
});

test("o CPF entra na lista do que o cálculo exige", () => {
  const bloco =
    planilha.match(/CAMPOS_QUE_O_CALCULO_EXIGE[\s\S]*?\n\};/)?.[0] ?? "";
  assert.ok(
    bloco.includes('"cpf"'),
    "Sem CPF destacado, a planilha de milhares de linhas volta sem chave.",
  );
});
