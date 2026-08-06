/*
 * Contracheque — as colunas que a conferência exige.
 *
 * Modelo de referência trazido por Samuel Scolari: o contracheque real da
 * empresa, com código da verba e uma coluna de referência que mostra
 * quantidade ou alíquota — não o valor base repetido em toda linha.
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const betaApp = readFileSync("app/components/BetaApp.tsx", "utf8");
const motor = readFileSync("packages/payroll-core/src/index.ts", "utf8");

test("o código da verba é coluna fixa, não depende de mostrar códigos", () => {
  /*
   * O código da rubrica é por onde a folha é conferida contra a
   * contabilidade, e quem recebe o demonstrativo espera encontrá-lo. A
   * regra de ocultar códigos INTERNOS continua valendo para os
   * identificadores de registro dos outros módulos — são coisas
   * diferentes com o mesmo nome.
   */
  const inicio = betaApp.indexOf("<th>Verba</th>");
  const tabela = betaApp.slice(inicio, betaApp.indexOf("</tfoot>", inicio));

  assert.ok(tabela, "A tabela do contracheque sumiu.");
  assert.match(tabela, /<td className="statement-code">\{line\.code\}<\/td>/);
  assert.doesNotMatch(
    tabela,
    /showInternalCodes \? <t[dh]>/,
    "O código da verba voltou a depender do botão de mostrar códigos.",
  );
});

test("referência e base são colunas separadas", () => {
  /*
   * Antes existia uma coluna só, "Referência / base", que mostrava a base
   * em reais — o mesmo número repetido em quase toda linha, sem serventia
   * para conferir. Agora referência mostra quantidade ou alíquota, e a
   * base continua disponível ao lado.
   */
  /* A busca do fim precisa partir do início do trecho: há outras tabelas
     no arquivo, e procurar `</thead>` desde o começo devolvia vazio. */
  const inicio = betaApp.indexOf("<th>Verba</th>");
  const cabecalho = betaApp.slice(inicio, betaApp.indexOf("</thead>", inicio));
  assert.match(cabecalho, /<th>Referência<\/th>/);
  assert.match(cabecalho, /<th>Base de cálculo<\/th>/);
  assert.doesNotMatch(cabecalho, /Referência \/ base/);
});

test("o motor informa a referência de cada verba medida", () => {
  for (const [verba, trecho] of [
    ["salário", "reference: input.monthlyHours"],
    ["horas extras", "reference: input.overtimeHours"],
    ["INSS", "reference: aliquota(inss, taxableGross)"],
    ["IRRF", "reference: aliquota(irrf, irrfBase)"],
    ["FGTS", "reference: money(fgtsRate * 100)"],
    ["patronal", "reference: input.employerInssPercent"],
    ["RAT", "reference: ratAdjustedPercent"],
    ["terceiros", "reference: input.thirdPartiesPercent"],
  ]) {
    assert.ok(
      motor.includes(trecho),
      `A verba de ${verba} não informa referência.`,
    );
  }
});

test("a alíquota mostrada é a EFETIVA, não a da tabela", () => {
  /*
   * INSS e IRRF são progressivos: a alíquota de tabela não corresponde ao
   * que foi descontado. Mostrar a efetiva é o que permite conferir — 14,00
   * num salário de faixa alta indica que as faixas foram aplicadas; a
   * alíquota nominal esconderia um erro de cálculo.
   */
  assert.match(
    motor,
    /const aliquota = \(valor: number, sobre: number\) =>\s*sobre > 0 \? money\(\(valor \/ sobre\) \* 100\) : 0;/,
  );
});

test("verba de valor fixo aparece como uma ocorrência", () => {
  /* É como o contracheque de referência apresenta: 1,00. */
  assert.match(
    betaApp,
    /const numero = line\.reference \?\? \(line\.amount \? 1 : 0\);/,
  );
  assert.match(betaApp, /minimumFractionDigits: 2/);
});

test("os nomes das verbas seguem a terminologia do eSocial", () => {
  /* Definido por Samuel Scolari: nomes conforme eSocial. */
  for (const nome of [
    "Contribuição previdenciária do segurado",
    "Imposto de renda retido na fonte",
    "Contribuição previdenciária patronal",
    "Contribuições a outras entidades e fundos",
    "Verbas de natureza indenizatória",
  ]) {
    assert.ok(motor.includes(nome), `Nome fora do padrão eSocial: ${nome}`);
  }

  assert.ok(
    !motor.includes('label: "INSS do empregado"'),
    "Nome antigo do INSS ainda presente.",
  );
});
