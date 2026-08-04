import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const cssPath = new URL("../app/v95-unified-light-theme.css", import.meta.url);
const layoutPath = new URL("../app/layout.tsx", import.meta.url);

function relativeLuminance(hex) {
  const rgb = hex
    .replace("#", "")
    .match(/.{2}/g)
    .map((value) => Number.parseInt(value, 16) / 255)
    .map((value) =>
      value <= 0.04045
        ? value / 12.92
        : ((value + 0.055) / 1.055) ** 2.4,
    );

  return 0.2126 * rgb[0] + 0.7152 * rgb[1] + 0.0722 * rgb[2];
}

function contrastRatio(foreground, background) {
  const first = relativeLuminance(foreground);
  const second = relativeLuminance(background);
  const light = Math.max(first, second);
  const dark = Math.min(first, second);

  return (light + 0.05) / (dark + 0.05);
}

test("a V95 é a última camada visual carregada", async () => {
  const layout = await readFile(layoutPath, "utf8");
  const previous = layout.indexOf('import "./v92-payroll-statement-redesign.css";');
  const v95 = layout.indexOf('import "./v95-unified-light-theme.css";');

  assert.ok(previous >= 0);
  assert.ok(v95 > previous);
  assert.equal(layout.lastIndexOf('import "./v95-unified-light-theme.css";'), v95);
});

test("a base, a navegação e a barra superior usam a mesma família clara", async () => {
  const css = await readFile(cssPath, "utf8");

  assert.match(css, /--v95-canvas:\s*#eef3f6/);
  assert.match(css, /\.sidebar\s*\{[\s\S]*linear-gradient\(180deg, #ffffff 0%, #f6fafb 58%, #eef5f7 100%\)/);
  assert.match(css, /\.nav-group button\.active\s*\{[\s\S]*background:\s*#e2f2f7/);
  assert.match(css, /\.topbar\s*\{[\s\S]*background:\s*rgba\(255, 255, 255, 0\.96\)/);
});

test("os painéis que eram escuros passam a superfícies claras", async () => {
  const css = await readFile(cssPath, "utf8");

  assert.match(css, /\.v52-module-strip\s*\{[\s\S]*linear-gradient\(135deg, #ffffff 0%, #f3f9fb 100%\)/);
  assert.match(css, /\.cost-composition-card\s*\{[\s\S]*linear-gradient\(180deg, #ffffff 0%, #f7fafb 100%\)/);
  assert.match(css, /\.management-heading\s*\{[\s\S]*linear-gradient\(135deg, #ffffff 0%, #f1f8fa 100%\)/);
  assert.match(css, /\.construction-executive-v2[\s\S]*background:\s*transparent !important/);
  assert.match(css, /\.construction-dashboard-v56,[\s\S]*\.construction-fleet-v2[\s\S]*linear-gradient\(180deg, #ffffff 0%, #f7fafb 100%\)/);
});

test("o rodapé da Central de Decisões não mantém texto claro sobre fundo claro", async () => {
  const css = await readFile(cssPath, "utf8");

  assert.match(css, /\.management-footer-v75\s*\{[\s\S]*linear-gradient\(180deg, #f8fbfc 0%, #f1f6f8 100%\)/);
  assert.match(css, /\.management-footer-stat\s*\{[\s\S]*background:\s*#ffffff/);
  assert.match(css, /\.management-footer-stat small,[\s\S]*color:\s*var\(--v95-ink\) !important/);
  assert.match(css, /\.management-footer-stat small\s*\{[\s\S]*color:\s*var\(--v95-muted\) !important/);
  assert.match(css, /\.management-footer-note[\s\S]*color:\s*var\(--v95-muted\) !important/);
});

test("texto principal, texto auxiliar e status atendem contraste de leitura", () => {
  assert.ok(contrastRatio("#17394d", "#ffffff") >= 7);
  assert.ok(contrastRatio("#3f5f71", "#ffffff") >= 4.5);
  assert.ok(contrastRatio("#566f7f", "#f4f8fa") >= 4.5);
  assert.ok(contrastRatio("#0f6f8c", "#eaf7fb") >= 4.5);
  assert.ok(contrastRatio("#8b5a06", "#fff7df") >= 4.5);
  assert.ok(contrastRatio("#a23b3b", "#fff0f0") >= 4.5);
  assert.ok(contrastRatio("#1f704f", "#effaf4") >= 4.5);
});

test("alerta, reprovação e aprovação permanecem semânticos e suaves", async () => {
  const css = await readFile(cssPath, "utf8");

  assert.match(css, /--v95-warning:\s*#8b5a06/);
  assert.match(css, /--v95-warning-soft:\s*#fff7df/);
  assert.match(css, /--v95-danger:\s*#a23b3b/);
  assert.match(css, /--v95-danger-soft:\s*#fff0f0/);
  assert.match(css, /--v95-success:\s*#1f704f/);
  assert.match(css, /--v95-success-soft:\s*#effaf4/);
});

test("a V95 não reintroduz as superfícies azul-marinho antigas", async () => {
  const css = await readFile(cssPath, "utf8");

  assert.doesNotMatch(
    css,
    /#061c2e|#062642|#082f50|#0a3a5b|#0a2034|#113d58/i,
  );
});

test("a alteração permanece somente visual e responsiva", async () => {
  const css = await readFile(cssPath, "utf8");

  assert.doesNotMatch(css, /display:\s*none/);
  assert.doesNotMatch(css, /content:\s*["'][^"']+["']/);
  assert.match(css, /@media \(max-width: 900px\)/);
  assert.match(css, /@media \(max-width: 560px\)/);
});
