/*
 * Integridade da linha de base visual.
 *
 * A comparação real contra o navegador é `npm run baseline:check`: ela sobe
 * o app e leva alguns minutos, então não roda a cada `npm test`. Estes testes
 * são o guarda rápido — garantem que o retrato continua completo e coerente,
 * para que ninguém apague ou esvazie a linha de base sem perceber e depois
 * "prove" que nada mudou comparando contra o vazio.
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

import { SCREENS, WIDTHS } from "../scripts/visual-baseline.mjs";

const baseline = JSON.parse(readFileSync("visual-baseline.json", "utf8"));

test("a linha de base cobre todas as telas críticas em todas as larguras", () => {
  const faltando = [];

  for (const tela of SCREENS) {
    const capturas = baseline.screens[tela];
    if (!capturas) {
      faltando.push(tela);
      continue;
    }
    for (const largura of WIDTHS) {
      if (!capturas[String(largura)]) faltando.push(`${tela} @ ${largura}`);
    }
  }

  assert.deepEqual(
    faltando,
    [],
    "Linha de base incompleta. Regrave com: npm run baseline:capture",
  );
});

test("a linha de base cobre os dois temas de cabeçalho", () => {
  const valores = Object.values(baseline.screens).map(
    (larguras) => larguras[String(WIDTHS[0])]?.executiveModule,
  );

  assert.ok(
    valores.includes("true"),
    "Nenhuma tela com o cabeçalho executivo escuro foi capturada.",
  );
  assert.ok(
    valores.includes("false"),
    "Nenhuma tela com o cabeçalho claro foi capturada. São justamente elas " +
      "que quebraram quando o V105 aplicou o tema escuro sem condição.",
  );
});

test("a linha de base registra as telas claras que já quebraram antes", () => {
  // Manual do sistema e Regime Tributário foram duas das três telas
  // danificadas pelo V105. Precisam estar sempre sob vigilância.
  for (const tela of ["Manual do sistema", "Regime Tributário"]) {
    const captura = baseline.screens[tela]?.[String(WIDTHS[0])];
    assert.ok(captura, `Tela clara ausente da linha de base: ${tela}`);
    assert.equal(
      captura.executiveModule,
      "false",
      `${tela} deveria usar o cabeçalho claro.`,
    );
  }
});

/*
 * Transbordo horizontal já existente, encontrado por esta linha de base.
 *
 * "Manual do sistema" e "Regime Tributário" produzem barra de rolagem
 * lateral em TODAS as larguras medidas, inclusive 1920px. É defeito real e
 * anterior a este trabalho — as mesmas duas telas que o V105 já havia
 * danificado, aparentemente as menos conferidas do sistema.
 *
 * Não é corrigido aqui de propósito: esta etapa é só instrumentação e não
 * altera CSS. Fica registrado para que o teste continue pegando qualquer
 * transbordo NOVO, sem esconder estes.
 */
const TRANSBORDOS_CONHECIDOS = new Set(
  ["Manual do sistema", "Regime Tributário"].flatMap((tela) =>
    WIDTHS.map((largura) => `${tela} @ ${largura}`),
  ),
);

test("nenhuma tela nova passou a transbordar horizontalmente", () => {
  const novos = [];

  for (const [tela, larguras] of Object.entries(baseline.screens)) {
    for (const [largura, captura] of Object.entries(larguras)) {
      const chave = `${tela} @ ${largura}`;
      if (captura.overflowsHorizontally && !TRANSBORDOS_CONHECIDOS.has(chave)) {
        novos.push(chave);
      }
    }
  }

  assert.deepEqual(
    novos,
    [],
    "Tela nova com barra de rolagem horizontal — provavelmente um cabeçalho " +
      "ou tabela estourando a largura disponível.",
  );
});

test("os títulos capturados têm cor, peso e tamanho registrados", () => {
  const incompletos = [];

  for (const [tela, larguras] of Object.entries(baseline.screens)) {
    for (const [largura, captura] of Object.entries(larguras)) {
      if (!captura.title) continue; // telas sem h1 são legítimas
      const { color, fontWeight, fontSize } = captura.title;
      if (!color || !fontWeight || !fontSize) {
        incompletos.push(`${tela} @ ${largura}`);
      }
    }
  }

  assert.deepEqual(incompletos, []);
});
