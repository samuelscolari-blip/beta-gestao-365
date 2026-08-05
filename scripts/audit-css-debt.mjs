/*
 * Auditoria da dívida de CSS — a "catraca".
 *
 * Mede o tamanho atual do problema e falha se ele crescer. Não exige que
 * nada seja consertado: só impede que piore enquanto a migração para
 * componentes acontece.
 *
 * A contagem usa o parser do PostCSS, não expressão regular. A diferença é
 * real: uma varredura por texto conta `!important` e `:has()` citados dentro
 * de comentários. Ao medir este projeto, o regex acusou 160 usos de `:has()`
 * quando existiam 158 — os dois extras eram menções num comentário
 * explicativo do próprio V105.
 *
 * As funções aqui recebem o conteúdo do CSS como texto, para que os testes
 * possam comprovar que a trava funciona sem manter um arquivo quebrado no
 * repositório.
 */
import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import postcss from "postcss";

export const APP_DIR = "app";
export const LAYOUT_PATH = join(APP_DIR, "layout.tsx");
export const BASELINE_PATH = "css-debt-baseline.json";

/** Diretório da arquitetura nova. CSS aqui dentro não conta como dívida. */
const NEW_ARCHITECTURE_PREFIX = "./styles/";

/** Reconhece nome versionado em qualquer posição: v52.css e construction-v54.css. */
export const VERSIONED_NAME = /v\d+/;

/** Conta declarações `!important` reais (ignora comentários e texto solto). */
export function countImportant(css, from = "<memória>") {
  let total = 0;
  postcss.parse(css, { from }).walkDecls((decl) => {
    if (decl.important) total += 1;
  });
  return total;
}

/** Conta usos de `:has()` em seletores reais (ignora comentários). */
export function countHasSelectors(css, from = "<memória>") {
  let total = 0;
  postcss.parse(css, { from }).walkRules((rule) => {
    total += (rule.selector.match(/:has\(/g) || []).length;
  });
  return total;
}

/** Lista os imports de CSS do layout, na ordem em que são carregados. */
export function extractCssImports(layoutSource) {
  return [...layoutSource.matchAll(/import\s+"(\.\/[^"]+\.css)";/g)].map(
    (match) => match[1],
  );
}

/**
 * Imports considerados dívida: tudo que não vive na arquitetura nova.
 * Assim a PR de tokens pode adicionar `./styles/tokens.css` sem ser
 * reprovada pela catraca, mas nenhuma camada global nova passa.
 */
export function extractLegacyImports(layoutSource) {
  return extractCssImports(layoutSource).filter(
    (file) => !file.startsWith(NEW_ARCHITECTURE_PREFIX),
  );
}

/** Arquivos CSS soltos em `app/` (a arquitetura antiga). */
export function listLegacyCssFiles(appDir = APP_DIR) {
  return readdirSync(appDir)
    .filter((name) => name.endsWith(".css"))
    .sort();
}

/** Mede o estado atual do repositório. */
export function auditRepository(appDir = APP_DIR, layoutPath = LAYOUT_PATH) {
  const files = listLegacyCssFiles(appDir);

  let important = 0;
  let hasSelectors = 0;
  for (const name of files) {
    const path = join(appDir, name);
    const css = readFileSync(path, "utf8");
    important += countImportant(css, path);
    hasSelectors += countHasSelectors(css, path);
  }

  const layout = readFileSync(layoutPath, "utf8");

  return {
    importantDeclarations: important,
    hasSelectors,
    legacyCssImports: extractLegacyImports(layout).length,
  };
}

export function readBaseline(path = BASELINE_PATH) {
  return JSON.parse(readFileSync(path, "utf8"));
}

/**
 * Compara o estado atual com o teto. Retorna a lista de métricas que
 * cresceram — vazia quando está tudo dentro do orçamento.
 */
export function compareWithBaseline(current, baseline) {
  const metrics = [
    ["importantDeclarations", "declarações !important"],
    ["hasSelectors", "seletores :has()"],
    ["legacyCssImports", "imports de CSS legado"],
  ];

  return metrics
    .filter(([key]) => current[key] > baseline.ceilings[key])
    .map(([key, label]) => ({
      key,
      label,
      current: current[key],
      ceiling: baseline.ceilings[key],
    }));
}

/* Execução direta: `npm run audit:css-debt` */
if (process.argv[1]?.endsWith("audit-css-debt.mjs")) {
  const current = auditRepository();
  const baseline = readBaseline();
  const exceeded = compareWithBaseline(current, baseline);

  for (const [key, value] of Object.entries(current)) {
    const ceiling = baseline.ceilings[key];
    const status = value > ceiling ? "ACIMA" : value < ceiling ? "abaixo" : "igual";
    console.log(`${key}: ${value} (teto ${ceiling}) — ${status}`);
  }

  if (exceeded.length > 0) {
    console.error("\nA dívida de CSS aumentou:\n");
    for (const item of exceeded) {
      console.error(`  ${item.label}: ${item.current} (teto ${item.ceiling})`);
    }
    console.error(
      "\nNÃO AUMENTE O TETO em css-debt-baseline.json para fazer o CI passar.",
    );
    console.error(
      "O teto existe para cair. Se você precisou de mais !important ou de mais",
    );
    console.error(
      "uma camada global, provavelmente há uma regra antiga disputando o mesmo",
    );
    console.error("elemento — remova-a em vez de empilhar outra por cima.\n");
    process.exit(1);
  }

  console.log("\nDívida de CSS dentro do orçamento.");
}
