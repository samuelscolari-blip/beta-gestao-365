import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const css = readFileSync("app/v105-force-executive-module-format.css", "utf8");
const layout = readFileSync("app/layout.tsx", "utf8");
const betaApp = readFileSync("app/components/BetaApp.tsx", "utf8");
const v52 = readFileSync("app/v52.css", "utf8");

test("V105 aplica o azul executivo somente quando data-executive-module=true", () => {
  /*
   * A asserção sobre `.module-heading` saiu na etapa 5D: o cabeçalho tem
   * CSS próprio e nenhum elemento carrega mais essa classe, então a regra
   * que o V105 mantinha para ele era código morto. O que o V105 ainda
   * estiliza — a caixa de orientação e os KPIs — continua vivo e condicionado
   * ao mesmo atributo.
   */
  assert.match(css, /\.page-area\[data-executive-module="true"\] \.module-guide/);
  assert.match(css, /\.page-area\[data-executive-module="true"\] \.mini-kpis article/);
});

test("o V105 não estiliza mais o cabeçalho", () => {
  /*
   * A trava que impede o problema de voltar: se alguém reintroduzir uma
   * regra global para `.module-heading` aqui, ela não teria efeito nenhum
   * (a classe não é emitida) e voltaria a confundir quem lê o CSS
   * procurando onde o cabeçalho é estilizado. O dono é
   * `app/ui/ModuleHeader/ModuleHeader.module.css`.
   */
  assert.doesNotMatch(
    css.replace(/\/\*[\s\S]*?\*\//g, ""),
    /\.module-heading/,
    "O cabeçalho pertence ao seu CSS Module. Estilize por lá.",
  );
});

test("V105 não depende mais de :has(.v52-module-strip) (a faixa é renderizada fora da árvore de .page-area, então esse seletor nunca casava de verdade)", () => {
  const cssWithoutComments = css.replace(/\/\*[\s\S]*?\*\//g, "");
  assert.doesNotMatch(cssWithoutComments, /:has\(\.v52-module-strip\)/);
});

test("BetaApp expõe data-executive-module em .page-area usando o mesmo estado (activeModule) que decide a faixa executiva", () => {
  assert.match(
    betaApp,
    /<div className="page-area" data-executive-module=\{activeModule \? "true" : "false"\}>/,
  );
});

test("V105 não força o padrão executivo em telas sem a faixa (Admin, Manual, Regime Tributário)", () => {
  assert.doesNotMatch(css, /^\.page-area \.module-heading/m);
  assert.doesNotMatch(css, /^\.page-area \.module-guide/m);
  assert.doesNotMatch(css, /^\.page-area \.mini-kpis/m);
});

test("as folhas V93 e V94 deixaram de existir", () => {
  /*
   * Elas existiam só para o cabeçalho: 20 e 32 regras, todas apontando
   * para `.module-heading`. Removidas essas, sobraram arquivos com
   * comentários e nada mais, e o import de cada um permanecia no layout
   * carregando ar.
   *
   * A disputa que este teste vigiava — V93 e V94 contra o V105 pelo fundo
   * do cabeçalho — não existe mais porque nenhum dos três estiliza o
   * cabeçalho. Quem estiliza é o CSS Module do componente, sozinho.
   */
  assert.doesNotMatch(layout, /v93-financial-header-approved\.css/);
  assert.doesNotMatch(layout, /v94-global-header-standard\.css/);
});

test("V52 não força mais fundo claro no cabeçalho via body:has(.sidebar button.active span:nth-child(2)) — esse seletor tinha especificidade (0,4,3), maior que o V105 (0,3,0), e casava em praticamente qualquer tela (todo botão do menu é <svg/><span>, então o span é sempre o 2º filho)", () => {
  assert.doesNotMatch(v52, /body:has\(\.sidebar button\.active span:nth-child\(2\)\)/);
});

test("V105 reaproveita variáveis de cor únicas (--exec-*) em vez de valores soltos repetidos", () => {
  assert.match(css, /--exec-navy-950/);
  assert.match(css, /--exec-line/);
  assert.match(css, /--exec-title/);
});

test("V104 foi removido e substituído pelo V105", () => {
  assert.doesNotMatch(layout, /v104-executive-panel-continuation\.css/);
});

test("V105 carrega antes das correções pontuais V106/V107, que fecham o layout", () => {
  const v105 = layout.indexOf('import "./v105-force-executive-module-format.css";');
  const v106 = layout.indexOf('import "./v106-management-center-contrast.css";');
  const v107 = layout.indexOf('import "./v107-works-header-dedup.css";');
  const metadata = layout.indexOf("export const metadata");

  assert.ok(v105 >= 0);
  assert.ok(v106 > v105);
  assert.ok(v107 > v106);
  assert.ok(v107 < metadata);
  assert.equal(
    layout.slice(v105, metadata).match(/import\s+"\.\/.*\.css";/g)?.length,
    3,
  );
});
