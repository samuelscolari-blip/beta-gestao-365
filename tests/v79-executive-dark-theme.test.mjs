import assert from "node:assert/strict";
import test from "node:test";
import { readFile } from "node:fs/promises";

const cssPath = new URL("../app/v79-executive-dark-theme.css", import.meta.url);
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

test("V79 é carregada por último para padronizar todas as telas", async () => {
  const layout = await readFile(layoutPath, "utf8");
  const importV78 = layout.indexOf('import "./v78-status-colors.css";');
  const importV79 = layout.indexOf('import "./v79-executive-dark-theme.css";');

  assert.ok(importV78 >= 0, "V78 deve continuar preservada");
  assert.ok(importV79 > importV78, "V79 deve ser carregada depois das camadas anteriores");
});

test("V79 cobre estrutura global, módulos, agenda, custos, obra e modais", async () => {
  const css = await readFile(cssPath, "utf8");
  const requiredSelectors = [
    ".app-shell",
    ".page-area",
    /* `.module-heading` saiu na etapa 5D: o cabeçalho tem CSS próprio. */
    ".mini-kpis article",
    ".module-guide",
    ".table-wrap",
    ".deadline-row.overdue",
    ".consolidated-card",
    ".cost-composition-card",
    ".management-overview article.validation",
    ".management-overview article.rejected",
    ".management-overview article.approved",
    ".construction-executive-header",
    ".modal-panel",
    ".detail-panel",
    ".confirm-dialog",
  ];

  for (const selector of requiredSelectors) {
    assert.ok(css.includes(selector), `Seletor obrigatório ausente: ${selector}`);
  }
});

test("V79 preserva cores semânticas dentro da base escura", async () => {
  const css = await readFile(cssPath, "utf8");
  const tokens = await readFile("app/styles/tokens.css", "utf8");

  /*
   * Parte destas cores agora vem por apelido dos tokens oficiais em
   * app/styles/tokens.css. O valor final é o mesmo — o que mudou foi a
   * origem, não o resultado. Por isso o teste segue a referência até o
   * token quando o valor não está mais escrito literalmente aqui.
   */
  const resolve = (nome) => {
    const literal = css.match(new RegExp(`${nome}:\\s*(#[0-9a-f]{3,8})`, "i"));
    if (literal) return literal[1].toLowerCase();

    const apelido = css.match(new RegExp(`${nome}:\\s*var\\((--[\\w-]+)\\)`));
    if (!apelido) return null;

    const token = tokens.match(
      new RegExp(`${apelido[1]}:\\s*(#[0-9a-f]{3,8})`, "i"),
    );
    return token ? token[1].toLowerCase() : null;
  };

  /* #fff e #ffffff são o mesmo valor; normaliza para comparar. */
  const igual = (obtido, esperado) =>
    obtido === esperado ||
    (obtido === "#fff" && esperado === "#ffffff") ||
    (obtido === "#ffffff" && esperado === "#fff");

  const esperado = {
    "--v79-canvas": "#041421",
    "--v79-card": "#0b2a44",
    "--v79-cyan": "#7bd0e6",
    "--v79-green": "#65dda7",
    "--v79-orange": "#e8a838",
    "--v79-red": "#ff7972",
  };

  for (const [nome, cor] of Object.entries(esperado)) {
    const obtido = resolve(nome);
    assert.ok(
      igual(obtido, cor),
      `${nome} deveria resultar em ${cor}, resultou em ${obtido}`,
    );
  }
});

test("textos principais mantêm contraste executivo legível", () => {
  assert.ok(contrast("#ffffff", "#0b2a44") >= 7);
  assert.ok(contrast("#d4e8f0", "#061c2e") >= 7);
  assert.ok(contrast("#7bd0e6", "#041421") >= 7);
  assert.ok(contrast("#041421", "#7bd0e6") >= 7);
});

test("V79 é somente visual e não introduz conteúdo ou números fictícios", async () => {
  const css = await readFile(cssPath, "utf8");

  assert.doesNotMatch(css, /R\$\s*[\d.]+/);
  assert.doesNotMatch(css, /Nova Compra/);
  assert.doesNotMatch(css, /Registros.*3/s);
  assert.doesNotMatch(css, /min-h-screen|grid-cols-|text-\[/);
});
