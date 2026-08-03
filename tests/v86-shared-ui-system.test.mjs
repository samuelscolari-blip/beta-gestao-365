import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const cssPath = new URL("../app/v86-shared-ui-system.css", import.meta.url);
const layoutPath = new URL("../app/layout.tsx", import.meta.url);
const componentPath = new URL(
  "../app/components/SummaryCard.tsx",
  import.meta.url,
);

test("V86 é carregada depois da V84 e ativa Inter no layout", async () => {
  const layout = await readFile(layoutPath, "utf8");
  const v84 = layout.indexOf('import "./v84-hybrid-executive-theme.css";');
  const v86 = layout.indexOf('import "./v86-shared-ui-system.css";');

  assert.ok(v84 >= 0, "V84 deve continuar preservada");
  assert.ok(v86 > v84, "V86 deve prevalecer sobre os estilos compartilhados");
  assert.match(layout, /import \{ Inter \} from "next\/font\/google"/);
  assert.match(layout, /variable:\s*"--font-inter"/);
  assert.match(layout, /className="v86-root antialiased"/);
  assert.doesNotMatch(layout, /fonts\.googleapis\.com/);
});

test("SummaryCard mantém faixa interna e API sem dados fictícios", async () => {
  const component = await readFile(componentPath, "utf8");
  const css = await readFile(cssPath, "utf8");

  assert.match(component, /type SummaryCardTone/);
  assert.match(component, /v86-summary-card__body/);
  assert.match(component, /v86-summary-card__strip/);
  assert.match(css, /\.v86-summary-card[\s\S]*overflow:\s*hidden/);
  assert.match(css, /\.v86-summary-card__strip[\s\S]*border-top/);
  assert.doesNotMatch(component, /R\$\s*1\.851/);
  assert.doesNotMatch(component, /value="0"/);
});

test("mini-kpis usam o mesmo padrão e a faixa permanece dentro do raio", async () => {
  const css = await readFile(cssPath, "utf8");

  assert.match(css, /\.page-area \.mini-kpis article[\s\S]*overflow:\s*hidden/);
  assert.match(css, /\.page-area \.mini-kpis article::after/);
  assert.match(css, /bottom:\s*0/);
  assert.match(css, /height:\s*4px/);
  assert.match(css, /border-bottom-width:\s*1px\s*!important/);
});

test("badges e chips recebem escala mínima legível", async () => {
  const css = await readFile(cssPath, "utf8");

  assert.ok(css.includes(".construction-machine-status"));
  assert.ok(css.includes(".construction-machine-priority"));
  assert.match(css, /min-height:\s*30px/);
  assert.match(css, /font-size:\s*12px/);
  assert.match(
    css,
    /\.construction-executive-v2 \.construction-kpi-v56 > span[\s\S]*min-height:\s*32px/,
  );
});

test("coluna Prioridade tem largura, contraste e resposta estrutural", async () => {
  const css = await readFile(cssPath, "utf8");

  assert.match(css, /minmax\(132px,\s*0\.62fr\)/);
  assert.match(
    css,
    /\.construction-machine-priority[\s\S]*min-width:\s*108px[\s\S]*min-height:\s*34px/,
  );
  assert.match(css, /\.construction-machine-priority\.critical/);
  assert.match(css, /\.construction-machine-priority\.warning/);
  assert.match(css, /\.construction-machine-priority\.success/);
  assert.match(css, /@container construction-executive \(max-width: 1040px\)/);
  assert.match(css, /@container construction-executive \(max-width: 620px\)/);
});

test("V86 permanece visual e não introduz lógica paralela", async () => {
  const css = await readFile(cssPath, "utf8");
  const component = await readFile(componentPath, "utf8");
  const combined = `${css}\n${component}`;

  assert.doesNotMatch(combined, /localStorage/);
  assert.doesNotMatch(combined, /CORE_HEADERS_MAP/);
  assert.doesNotMatch(combined, /calculatePayroll/);
  assert.doesNotMatch(combined, /CLOUDFLARE_API_TOKEN/);
  assert.doesNotMatch(combined, /auto-?login/i);
});
