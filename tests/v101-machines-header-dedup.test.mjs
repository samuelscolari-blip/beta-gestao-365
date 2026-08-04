import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const cssPath = new URL("../app/v101-machines-header-dedup.css", import.meta.url);
const layoutPath = new URL("../app/layout.tsx", import.meta.url);

test("a tela de Máquinas mantém somente o cabeçalho executivo", async () => {
  const css = await readFile(cssPath, "utf8");

  assert.match(
    css,
    /\.machines-unified-active\s+\.module-heading\s*\{[\s\S]*display:\s*none\s*!important/,
  );
  assert.doesNotMatch(css, /^\s*\.module-heading\s*\{/m);
});

test("a correção V101 é carregada depois da unificação V100", async () => {
  const layout = await readFile(layoutPath, "utf8");

  assert.match(
    layout,
    /v100-unified-machines\.css";\nimport "\.\/v101-machines-header-dedup\.css";/,
  );
});
