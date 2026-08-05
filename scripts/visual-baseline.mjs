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
export const SCREENS = {
  "Visão geral": "dashboard",
  Fornecedores: "expenses",
  "Cartão Corporativo": "cards",
  "Execução da Obra": "works",
  "Diário de obra": "worklogs",
  Máquinas: "assets",
  Administrativo: "people",
  "Cálculo de Salário": "payroll",
  "Cálculo de Férias": "vacations",
  Rescisão: "terminations",
  "Fiscal e Compliance": "compliance",
  Impostos: "taxes",
  Aluguéis: "rentals",
  Documentos: "documents",
  Integrações: "m365",
  "Manual do sistema": "manual",
  "Regime Tributário": "tax-profile",
  "Infraestrutura ERP": "infrastructure",
};

/*
 * Telas em que `visibleHeaderCount` igual a zero é o resultado correto, por
 * dois motivos diferentes:
 *
 *  - Execução da Obra e Máquinas ESCONDEM o cabeçalho genérico, porque já
 *    têm painel próprio acima. Hoje isso é feito por CSS (V101 e V107); na
 *    etapa final passa a ser uma condição declarada pelo React;
 *  - Visão geral e Infraestrutura ERP simplesmente não são telas de módulo
 *    e nunca tiveram cabeçalho.
 *
 * A distinção importa: a primeira dupla precisa continuar escondendo o
 * cabeçalho depois da migração, e a segunda não tem nada a preservar.
 */
export const SCREENS_WITH_HIDDEN_HEADER = new Set([
  "Execução da Obra",
  "Máquinas",
]);

export const SCREENS_WITHOUT_MODULE_HEADER = new Set([
  "Visão geral",
  "Infraestrutura ERP",
]);

/** Todas as telas em que não haver cabeçalho visível é esperado. */
export const SCREENS_WITHOUT_GENERIC_HEADER = new Set([
  ...SCREENS_WITH_HIDDEN_HEADER,
  ...SCREENS_WITHOUT_MODULE_HEADER,
]);

/** Desktop comum, desktop largo, notebook com escala, tablet e celular. */
export const WIDTHS = [1920, 1536, 1366, 768, 390];

/*
 * Executado dentro do navegador: lê o resultado final da cascata.
 *
 * O detalhe aqui é proposital. As três variantes do cabeçalho se distinguem
 * por GEOMETRIA, não por cor: a clara usa grid onde as outras usam flex, com
 * ícone de 78px contra 64px. Reconstruí-las nas etapas seguintes exige ter
 * esses números registrados de antes, senão "ficou igual" vira opinião.
 */
function readScreenStyles() {
  const pick = (element, properties) => {
    if (!element) return null;
    const computed = getComputedStyle(element);
    return Object.fromEntries(properties.map((p) => [p, computed[p]]));
  };

  const visivel = (element) => {
    const computed = getComputedStyle(element);
    const box = element.getBoundingClientRect();
    return (
      computed.display !== "none" &&
      computed.visibility !== "hidden" &&
      box.width > 0 &&
      box.height > 0
    );
  };

  const headers = [...document.querySelectorAll('[data-ui="module-header"]')];
  const visibleHeaders = headers.filter(visivel);
  const heading = visibleHeaders[0] ?? null;

  const title = heading?.querySelector("h1") ?? null;
  const eyebrow = heading?.querySelector(".eyebrow") ?? null;
  const icon = heading?.querySelector(".module-big-icon") ?? null;
  /* Bloco de ações: tudo que vem depois do título, à direita. */
  const actions = heading?.children?.[1] ?? null;
  const guide = document.querySelector(".module-guide");
  const pageArea = document.querySelector(".page-area");

  return {
    executiveModule: pageArea?.getAttribute("data-executive-module") ?? null,
    variant: heading?.dataset?.variant ?? null,
    accent: heading?.dataset?.accent ?? null,
    moduleId: heading?.dataset?.module ?? null,

    /*
     * Execução da Obra e Máquinas escondem o cabeçalho genérico de
     * propósito, porque já têm painel próprio acima — nessas telas o
     * esperado é zero. Mais de um visível significa cabeçalho duplicado.
     */
    headerCount: headers.length,
    visibleHeaderCount: visibleHeaders.length,

    heading: pick(heading, [
      "display",
      "flexDirection",
      "gridTemplateColumns",
      "alignItems",
      "justifyContent",
      "gap",
      "paddingTop",
      "paddingRight",
      "paddingBottom",
      "paddingLeft",
      "minHeight",
      "borderRadius",
      "borderTopColor",
      "backgroundImage",
      "backgroundColor",
      "color",
      "boxShadow",
    ]),
    icon: pick(icon, [
      "display",
      "width",
      "height",
      "minWidth",
      "borderRadius",
      "fontSize",
      "alignItems",
      "justifyContent",
      "color",
      "backgroundImage",
      "backgroundColor",
    ]),
    actions: pick(actions, ["display", "flexDirection", "alignItems", "gap"]),
    title: pick(title, [
      "color",
      "fontFamily",
      "fontSize",
      "fontWeight",
      "letterSpacing",
      "lineHeight",
      "margin",
    ]),
    titleText: title?.textContent?.trim() ?? null,
    eyebrow: pick(eyebrow, ["color", "fontSize", "fontWeight", "letterSpacing"]),
    guide: pick(guide, ["backgroundImage", "backgroundColor", "color"]),

    /* Transbordo horizontal: sintoma clássico de cabeçalho quebrado. */
    overflowsHorizontally:
      document.documentElement.scrollWidth > document.documentElement.clientWidth,
    headingWidth: heading ? Math.round(heading.getBoundingClientRect().width) : null,
  };
}

/*
 * Estados interativos do botão de ação, medidos separadamente porque exigem
 * hover e foco reais.
 *
 * Em modo visitante o botão primário não existe — o cabeçalho renderiza um
 * selo de consulta no lugar. Nesse caso não há o que medir, e devolver nulo
 * é o resultado correto, não uma falha.
 */
async function readInteractiveStates(page) {
  const seletor = '[data-ui="module-header"] .button.primary';
  const botao = page.locator(seletor).first();
  if ((await botao.count()) === 0) return null;

  const repouso = await page.evaluate((s) => {
    const c = getComputedStyle(document.querySelector(s));
    return { background: c.backgroundImage, color: c.color, border: c.borderTopColor };
  }, seletor);

  await botao.hover();
  await page.waitForTimeout(250);
  const hover = await page.evaluate((s) => {
    const c = getComputedStyle(document.querySelector(s));
    return { background: c.backgroundImage, color: c.color, border: c.borderTopColor };
  }, seletor);

  await botao.focus();
  await page.waitForTimeout(150);
  const foco = await page.evaluate((s) => {
    const c = getComputedStyle(document.querySelector(s));
    return { outline: c.outline, outlineOffset: c.outlineOffset, boxShadow: c.boxShadow };
  }, seletor);

  return { repouso, hover, foco };
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

      for (const [screen, viewId] of Object.entries(SCREENS)) {
        /*
         * Navega pelo próprio DOM, por `data-view`, em vez de clique físico
         * sobre o texto do botão. Dois motivos: em larguras estreitas a
         * barra lateral sai da viewport e o clique real falharia; e comparar
         * o rótulo faria a medição quebrar assim que uma tela fosse
         * renomeada — que é o mesmo defeito que a tela de Férias tinha.
         */
        const navigated = await page.evaluate((id) => {
          const button = document.querySelector(`.sidebar nav button[data-view="${id}"]`);
          if (!button) return false;
          button.click();
          return true;
        }, viewId);

        if (!navigated) continue;

        /*
         * Espera a tela certa aparecer em vez de dormir um tempo fixo. Sem
         * isso, uma máquina lenta mediria a tela anterior e gravaria o
         * resultado errado como se fosse verdade.
         */
        await page
          .waitForFunction(
            (id) => {
              const active = document.querySelector(".sidebar nav button.active");
              return active?.getAttribute("data-view") === id;
            },
            viewId,
            { timeout: 15_000 },
          )
          .catch(() => {});
        await page.waitForTimeout(700);

        result[screen] ??= {};
        result[screen][String(width)] = {
          ...(await page.evaluate(readScreenStyles)),
          /* Estados interativos só no tamanho de referência: exigem hover real. */
          interactive: width === 1366 ? await readInteractiveStates(page) : undefined,
        };

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
