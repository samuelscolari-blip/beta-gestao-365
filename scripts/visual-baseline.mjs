/*
 * Linha de base visual — registra como as telas estão AGORA que estão certas.
 *
 * Existe para provar que uma refatoração "sem mudança visual" realmente não
 * mudou nada. Sem um "antes" registrado, essa afirmação é só confiança.
 *
 * Mede estilo computado do navegador de verdade (Chromium), não o CSS-fonte:
 * o que interessa é o resultado final da cascata, que foi exatamente onde os
 * bugs desta sessão se esconderam — regras de arquivos diferentes disputando
 * o mesmo elemento, com o vencedor decidido por detalhes invisíveis na
 * leitura do código.
 *
 * Screenshots são gravadas em disco para inspeção humana, mas NÃO são
 * versionadas: são binários grandes que mudariam a cada ajuste. O que fica
 * versionado é o JSON de estilos computados, que é preciso e legível em diff.
 *
 * Uso:
 *   node scripts/visual-baseline.mjs --capture   (regrava a linha de base)
 *   node scripts/visual-baseline.mjs --check     (compara o estado atual)
 */
import { spawn } from "node:child_process";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);

export const BASELINE_PATH = "visual-baseline.json";
const SCREENSHOT_DIR = ".visual-baseline";
const PORT = 5199;
const ORIGIN = `http://localhost:${PORT}`;
const CHROMIUM = "/opt/pw-browsers/chromium";
const PLAYWRIGHT = "/opt/node22/lib/node_modules/playwright";

/*
 * Telas críticas, pelo rótulo exato do botão na barra lateral.
 *
 * A lista cobre deliberadamente os dois temas. As três últimas usam o
 * cabeçalho CLARO e são as que mais importam numa mudança global: foram
 * exatamente elas que o V105 quebrou ao aplicar o tema escuro sem condição,
 * e o defeito passou despercebido porque ninguém as conferiu.
 *
 * Limitação conhecida: a captura roda em modo visitante, então telas
 * exclusivas de administrador (ex.: Administração) não entram. Elas
 * continuam dependendo de conferência manual.
 */
export const SCREENS = [
  "Visão geral",
  "Fornecedores",
  "Cartão Corporativo",
  "Execução da Obra",
  "Diário de obra",
  "Máquinas",
  "Administrativo",
  "Cálculo de Salário",
  "Cálculo de Férias",
  "Rescisão",
  "Fiscal e Compliance",
  "Impostos",
  "Aluguéis",
  "Documentos",
  "Manual do sistema",
  "Regime Tributário",
  "Infraestrutura ERP",
];

/** Desktop comum, desktop largo, notebook com escala, tablet e celular. */
export const WIDTHS = [1920, 1536, 1366, 768, 390];

/* Executado dentro do navegador: lê o resultado final da cascata. */
function readScreenStyles() {
  const pick = (element, properties) => {
    if (!element) return null;
    const computed = getComputedStyle(element);
    return Object.fromEntries(properties.map((p) => [p, computed[p]]));
  };

  const heading = document.querySelector(".module-heading");
  const title = document.querySelector(".module-heading h1");
  const eyebrow = document.querySelector(".module-heading .eyebrow");
  const guide = document.querySelector(".module-guide");
  const pageArea = document.querySelector(".page-area");

  return {
    executiveModule: pageArea?.getAttribute("data-executive-module") ?? null,
    heading: pick(heading, [
      "backgroundImage",
      "backgroundColor",
      "borderTopColor",
      "borderRadius",
      "color",
    ]),
    title: pick(title, [
      "color",
      "fontFamily",
      "fontSize",
      "fontWeight",
      "letterSpacing",
      "lineHeight",
    ]),
    titleText: title?.textContent?.trim() ?? null,
    eyebrow: pick(eyebrow, ["color", "fontSize", "fontWeight"]),
    guide: pick(guide, ["backgroundImage", "backgroundColor", "color"]),
    /* Transbordo horizontal: sintoma clássico de cabeçalho quebrado. */
    overflowsHorizontally:
      document.documentElement.scrollWidth > document.documentElement.clientWidth,
    headingWidth: heading ? Math.round(heading.getBoundingClientRect().width) : null,
  };
}

async function startDevServer() {
  const server = spawn("npx", ["vite", "--port", String(PORT)], {
    stdio: "ignore",
    detached: false,
  });

  const deadline = Date.now() + 90_000;
  while (Date.now() < deadline) {
    try {
      const response = await fetch(ORIGIN, { signal: AbortSignal.timeout(4000) });
      if (response.ok) return server;
    } catch {
      /* ainda subindo */
    }
    await new Promise((resolve) => setTimeout(resolve, 1500));
  }

  server.kill("SIGKILL");
  throw new Error("O servidor de desenvolvimento não respondeu a tempo.");
}

export async function capture({ screenshots = false } = {}) {
  const { chromium } = require(PLAYWRIGHT);
  const server = await startDevServer();
  const browser = await chromium.launch({ executablePath: CHROMIUM });
  const result = {};

  if (screenshots) mkdirSync(SCREENSHOT_DIR, { recursive: true });

  try {
    for (const width of WIDTHS) {
      const page = await browser.newPage({ viewport: { width, height: 900 } });
      await page.goto(ORIGIN, { waitUntil: "networkidle", timeout: 60_000 });
      await page.waitForTimeout(2500);

      for (const screen of SCREENS) {
        /*
         * Navega pelo próprio DOM em vez de clique físico: em larguras
         * estreitas a barra lateral fica fora da viewport e o clique real
         * falharia. O que se quer medir aqui é a renderização da tela, não
         * a acessibilidade do botão.
         */
        const navigated = await page.evaluate((label) => {
          const button = [...document.querySelectorAll(".sidebar nav button")].find(
            (candidate) => candidate.textContent?.includes(label),
          );
          if (!button) return false;
          button.click();
          return true;
        }, screen);

        if (!navigated) continue;
        await page.waitForTimeout(1200);

        result[screen] ??= {};
        result[screen][String(width)] = await page.evaluate(readScreenStyles);

        if (screenshots && width === 1366) {
          const safe = screen.normalize("NFD").replace(/[^\w]+/g, "-").toLowerCase();
          await page.screenshot({
            path: `${SCREENSHOT_DIR}/${safe}.png`,
            fullPage: false,
          });
        }
      }

      await page.close();
    }
  } finally {
    await browser.close();
    server.kill("SIGKILL");
  }

  return result;
}

/** Lista as diferenças entre dois retratos, em caminhos legíveis. */
export function diffBaselines(baseline, current) {
  const differences = [];

  const walk = (path, expected, actual) => {
    if (expected === actual) return;

    const bothObjects =
      expected && actual && typeof expected === "object" && typeof actual === "object";

    if (!bothObjects) {
      differences.push({ path, expected, actual });
      return;
    }

    for (const key of new Set([...Object.keys(expected), ...Object.keys(actual)])) {
      walk(path ? `${path} → ${key}` : key, expected[key], actual[key]);
    }
  };

  walk("", baseline, current);
  return differences;
}

export function readBaseline(path = BASELINE_PATH) {
  return JSON.parse(readFileSync(path, "utf8")).screens;
}

if (process.argv[1]?.endsWith("visual-baseline.mjs")) {
  const mode = process.argv.includes("--check") ? "check" : "capture";
  const screens = await capture({ screenshots: true });

  if (mode === "capture") {
    writeFileSync(
      BASELINE_PATH,
      `${JSON.stringify(
        {
          _comentario:
            "Retrato do resultado visual aprovado. Regravar apenas quando a mudança visual for intencional e revisada.",
          capturadoEm: new Date().toISOString().slice(0, 10),
          screens,
        },
        null,
        2,
      )}\n`,
    );
    const total = Object.keys(screens).length;
    console.log(`Linha de base gravada: ${total} telas × ${WIDTHS.length} larguras.`);
  } else {
    const differences = diffBaselines(readBaseline(), screens);
    if (differences.length > 0) {
      console.error(`Diferenças visuais detectadas (${differences.length}):\n`);
      for (const d of differences.slice(0, 40)) {
        console.error(`  ${d.path}\n    antes: ${d.expected}\n    agora: ${d.actual}`);
      }
      if (differences.length > 40) {
        console.error(`\n  ... e mais ${differences.length - 40}.`);
      }
      console.error(
        "\nSe a mudança for intencional, regrave com: npm run baseline:capture",
      );
      process.exit(1);
    }
    console.log("Nenhuma diferença visual em relação à linha de base.");
  }
}
