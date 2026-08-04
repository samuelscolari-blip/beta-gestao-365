import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const cssPath = new URL("../app/v102-vacations-executive-blue.css", import.meta.url);
const layoutPath = new URL("../app/layout.tsx", import.meta.url);

test("Cálculo de Férias usa o azul executivo com texto legível", async () => {
  const css = await readFile(cssPath, "utf8");

  assert.match(css, /vacations-page > section\.module-heading/);
  assert.match(css, /background-color:\s*#082b46\s*!important/);
  assert.match(css, /h1\s*\{[\s\S]*color:\s*#ffffff\s*!important/);
  assert.match(css, /p\s*\{[\s\S]*color:\s*#c9e4ef\s*!important/);
});

test("V102 é carregada depois de todas as camadas anteriores", async () => {
  const layout = await readFile(layoutPath, "utf8");

  assert.match(
    layout,
    /v101-machines-header-dedup\.css";\nimport "\.\/v102-vacations-executive-blue\.css";/,
  );
});
