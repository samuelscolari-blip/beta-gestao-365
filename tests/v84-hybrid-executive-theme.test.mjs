import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const cssPath = new URL("../app/v84-hybrid-executive-theme.css", import.meta.url);
const layoutPath = new URL("../app/layout.tsx", import.meta.url);

function relativeLuminance(hex) {
  const normalized = hex.replace("#", "");
  const channels = [0, 2, 4].map((offset) => {
    const value = Number.parseInt(normalized.slice(offset, offset + 2), 16) / 255;
    return value <= 0.03928
      ? value / 12.92
      : ((value + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * channels[0] + 0.7152 * channels[1] + 0.0722 * channels[2];
}

function contrast(foreground, background) {
  const lighter = Math.max(relativeLuminance(foreground), relativeLuminance(background));
  const darker = Math.min(relativeLuminance(foreground), relativeLuminance(background));
  return (lighter + 0.05) / (darker + 0.05);
}

test("V84 é carregada depois da V79 para restaurar a base clara", async () => {
  const layout = await readFile(layoutPath, "utf8");
  const v78 = layout.indexOf('import "./v78-status-colors.css";');
  const v79 = layout.indexOf('import "./v79-executive-dark-theme.css";');
  const v84 = layout.indexOf('import "./v84-hybrid-executive-theme.css";');

  assert.ok(v78 >= 0, "V78 deve continuar carregada");
  assert.ok(v79 > v78, "V79 deve continuar preservada");
  assert.ok(v84 > v79, "V84 deve prevalecer sobre o tema global escuro");
});

test("V84 mantém base clara e limita o escuro aos painéis executivos", async () => {
  const css = await readFile(cssPath, "utf8");

  assert.match(css, /--v84-canvas:\s*#eef3f6/);
  assert.match(css, /--v84-surface:\s*#ffffff/);
  assert.match(css, /body[\s\S]*background:\s*var\(--v84-canvas\)\s*!important/);
  assert.match(css, /\.page-area[\s\S]*#f5f8fa[\s\S]*var\(--v84-canvas\)/);

  const darkHighlights = [
    ".v52-module-strip",
    ".cost-composition-card",
    ".management-heading",
    ".construction-executive-v2",
  ];

  for (const selector of darkHighlights) {
    assert.ok(css.includes(selector), `Destaque executivo ausente: ${selector}`);
  }

  assert.match(css, /\.page-area \.module-heading[\s\S]*#ffffff/);
  assert.match(css, /\.page-area \.deadline-card/);
  assert.match(css, /\.page-area \.management-center[\s\S]*#ffffff/);
});

test("V84 remove a limitação lateral sem aplicar reset global indiscriminado", async () => {
  const css = await readFile(cssPath, "utf8");

  assert.match(css, /\.page-stack > :is\(/);
  assert.match(css, /\.integrated-view-stack > :is\(/);
  assert.match(css, /\.v52-floating-layer > :is\(/);
  assert.match(css, /max-width:\s*none\s*!important/);
  assert.doesNotMatch(css, /\*\s*\{[\s\S]*margin:\s*0\s*!important/);
});

test("V84 preserva status suaves de validação, rejeição e aprovação", async () => {
  const css = await readFile(cssPath, "utf8");

  assert.match(css, /article\.validation[\s\S]*#fff8e7/);
  assert.match(css, /article\.rejected[\s\S]*#fff1f1/);
  assert.match(css, /article\.approved[\s\S]*#effbf5/);
  assert.match(css, /\.v77-approved-panel[\s\S]*#f8fcfa/);
});

test("contrastes do painel escuro e da base clara permanecem legíveis", () => {
  assert.ok(contrast("#ffffff", "#0b2a44") >= 7);
  assert.ok(contrast("#b9d4df", "#061c2e") >= 7);
  assert.ok(contrast("#173b4f", "#ffffff") >= 10);
  assert.ok(contrast("#345569", "#ffffff") >= 7);
});

test("V84 é somente visual e não substitui dados reais por mockups", async () => {
  const css = await readFile(cssPath, "utf8");

  assert.doesNotMatch(css, /R\$\s*[\d.]+/);
  assert.doesNotMatch(css, /Nova Compra/);
  assert.doesNotMatch(css, /Registros.*3/s);
  assert.doesNotMatch(css, /Samuel Guerra Scolari/);
  assert.doesNotMatch(css, /CORE_HEADERS_MAP/);
});
