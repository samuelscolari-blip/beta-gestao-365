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

import {
  SCREENS,
  SCREENS_WITHOUT_GENERIC_HEADER,
  WIDTHS,
} from "../scripts/visual-baseline.mjs";

const baseline = JSON.parse(readFileSync("visual-baseline.json", "utf8"));

test("a linha de base cobre todas as telas críticas em todas as larguras", () => {
  const faltando = [];

  for (const tela of Object.keys(SCREENS)) {
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
 * Nenhuma tela pode ter rolagem horizontal.
 *
 * Quando esta linha de base foi criada, "Manual do sistema" e "Regime
 * Tributário" transbordavam em todas as larguras, inclusive 1920px, e o
 * defeito ficou registrado aqui como exceção conhecida. A causa era o
 * círculo decorativo do `::after` no cabeçalho claro: ele usa
 * `right: -56px`, mas o elemento pai não tinha `position: relative`, então
 * o pseudo-elemento se ancorava na viewport e o `overflow: hidden` do pai
 * não o cortava. Corrigido no V94; a exceção deixou de ser necessária.
 */
test("nenhuma tela transborda horizontalmente", () => {
  const transbordos = [];

  for (const [tela, larguras] of Object.entries(baseline.screens)) {
    for (const [largura, captura] of Object.entries(larguras)) {
      if (captura.overflowsHorizontally) transbordos.push(`${tela} @ ${largura}`);
    }
  }

  assert.deepEqual(
    transbordos,
    [],
    "Tela com barra de rolagem horizontal. Suspeite de elemento posicionado " +
      "fora do fluxo sem pai com `position: relative` — foi essa a causa da " +
      "última vez — ou de tabela estourando a largura disponível.",
  );
});

test("nenhuma tela exibe mais de um cabeçalho ao mesmo tempo", () => {
  /*
   * Cabeçalho duplicado foi um defeito real deste projeto: telas com painel
   * próprio mostravam também o cabeçalho genérico, e a correção da época foi
   * escondê-lo por CSS — no V101 com uma classe posta por JavaScript, no
   * V107 com `:has()`. As duas folhas somem na etapa final, quando a
   * condição passa a ser declarada pelo React; esta verificação é o que
   * garante que os títulos duplicados não voltem junto.
   */
  const duplicados = [];
  const inesperadamenteAusentes = [];

  for (const [tela, larguras] of Object.entries(baseline.screens)) {
    for (const [largura, captura] of Object.entries(larguras)) {
      const visiveis = captura.visibleHeaderCount;
      if (visiveis === undefined) continue;

      if (visiveis > 1) duplicados.push(`${tela} @ ${largura}: ${visiveis}`);
      if (visiveis === 0 && !SCREENS_WITHOUT_GENERIC_HEADER.has(tela)) {
        /* Sem cabeçalho só é aceitável onde há painel próprio no lugar. */
        inesperadamenteAusentes.push(`${tela} @ ${largura}`);
      }
    }
  }

  assert.deepEqual(duplicados, [], "Tela com mais de um cabeçalho visível.");
  assert.deepEqual(
    inesperadamenteAusentes,
    [],
    "Tela sem cabeçalho visível e sem painel próprio declarado.",
  );
});

test("a linha de base registra a geometria que distingue as três variantes", () => {
  /*
   * Cor não distingue as variantes; geometria sim. Sem estes campos
   * gravados, "ficou igual" na migração seria opinião, não medição.
   */
  const captura = baseline.screens["Cartão Corporativo"]?.["1366"];
  assert.ok(captura, "Tela de referência ausente da linha de base.");

  for (const campo of ["display", "paddingTop", "minHeight", "borderRadius"]) {
    assert.ok(
      captura.heading?.[campo],
      `Geometria do cabeçalho não registrada: ${campo}`,
    );
  }
  for (const campo of ["width", "height", "borderRadius"]) {
    assert.ok(captura.icon?.[campo], `Geometria do ícone não registrada: ${campo}`);
  }
  assert.ok(captura.variant, "Variante não registrada na linha de base.");
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
