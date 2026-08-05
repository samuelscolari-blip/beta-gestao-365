import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const cssPath = new URL("../app/v101-machines-header-dedup.css", import.meta.url);
const layoutPath = new URL("../app/layout.tsx", import.meta.url);

test("a tela de Máquinas mantém somente o cabeçalho executivo", async () => {
  /*
   * A garantia continua a mesma; mudou quem a cumpre.
   *
   * O V101 escondia o cabeçalho genérico com `display: none`, ou seja,
   * ele era renderizado e depois apagado. Desde a etapa 5A quem decide é
   * o React, que simplesmente não o renderiza — mais barato e imune à
   * remoção das classes globais, que foi o que quebrou o mecanismo
   * equivalente do V107.
   *
   * O que sobra nesta folha é o espaçamento da pilha, que continua vivo.
   */
  const css = await readFile(cssPath, "utf8");
  const betaApp = await readFile("app/components/BetaApp.tsx", "utf8");

  assert.doesNotMatch(
    css.replace(/\/\*[\s\S]*?\*\//g, ""),
    /\.module-heading/,
    "A ocultação voltou para o CSS. Ela pertence ao React.",
  );
  assert.match(css, /\.machines-unified-active \.page-stack/);
  assert.match(betaApp, /hideHeading=\{activeView === "works" \|\| activeView === "assets"\}/);
});

test("a correção V101 é carregada depois da unificação V100", async () => {
  const layout = await readFile(layoutPath, "utf8");

  assert.match(
    layout,
    /v100-unified-machines\.css";\nimport "\.\/v101-machines-header-dedup\.css";/,
  );
});
