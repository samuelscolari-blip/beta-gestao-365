/*
 * Folga de Campo — a tela e o que a alimenta.
 *
 * O motor tem testes próprios em `field-leave.test.mjs`. Aqui o que se
 * verifica é a ligação: o cadastro abre o direito, a tela existe no lugar
 * certo, e nada disso encosta em férias.
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const modules = readFileSync("app/lib/modules.ts", "utf8");
const wrapper = readFileSync("app/components/SecureBetaAppV97.tsx", "utf8");
const betaApp = readFileSync("app/components/BetaApp.tsx", "utf8");
const painel = readFileSync(
  "app/ui/FieldLeaveSummary/FieldLeaveSummary.tsx",
  "utf8",
);

test("o Cadastro de Funcionários abre o direito à Folga de Campo", () => {
  /*
   * É daqui que tudo começa: sem a marcação no cadastro, não há como saber
   * quem mora fora da cidade da obra.
   */
  assert.match(
    modules,
    /key: "livesOutOfTown"[^}]*label: "Residência fora da cidade da obra"/,
  );
  assert.match(modules, /key: "livesOutOfTown"[^}]*options: \["Não", "Sim"\]/);
  assert.match(modules, /key: "homeCity"[^}]*label: "Cidade onde mora"/);
});

test("a cidade só é perguntada depois do Sim", () => {
  /*
   * Perguntar a cidade de origem a quem mora na própria cidade da obra
   * convida a preencher um dado que não vale para o caso — e que depois
   * vira dúvida na hora de conferir a ficha.
   */
  for (const campo of ["homeCity", "fieldLeaveCountFrom"]) {
    assert.match(
      modules,
      new RegExp(
        `key: "${campo}"[^}]*showWhen: \\{ field: "livesOutOfTown", equals: "Sim" \\}`,
      ),
      `O campo ${campo} precisa aparecer só quando a residência for fora da cidade.`,
    );
  }
});

test("o formulário respeita o campo condicional", () => {
  /*
   * Declarar `showWhen` sem o formulário obedecer deixaria o campo sempre
   * visível, e a declaração viraria enfeite.
   */
  assert.match(betaApp, /field\.showWhen/);
  assert.match(
    betaApp,
    /String\(payload\[field\.showWhen\.field\] \?\? ""\)\.trim\(\) ===\s*field\.showWhen\.equals/,
    "A condição precisa ler o valor do formulário aberto, para o campo " +
      "surgir no mesmo instante em que a pessoa marca Sim.",
  );
});

test("os três campos entram na aba onde já mora o endereço", () => {
  const contatos = betaApp.match(/id: "contacts",[\s\S]*?\n  \},/)?.[0] ?? "";
  for (const campo of ["livesOutOfTown", "homeCity", "fieldLeaveCountFrom"]) {
    assert.ok(
      contatos.includes(`"${campo}"`),
      `Campo fora da aba Contatos: ${campo}. Declarado no módulo mas ` +
        "ausente da seção, ele nunca apareceria na tela.",
    );
  }
});

test("a tela existe, no grupo de RH, com as verbas de custo", () => {
  assert.match(wrapper, /id: "field_leave"/);
  assert.match(wrapper, /label: "Folga de Campo"/);

  for (const campo of [
    "ticketOut",
    "ticketReturn",
    "mealsOut",
    "mealsReturn",
    "hotel",
    "purchaseAmount",
  ]) {
    assert.ok(
      wrapper.includes(`key: "${campo}"`),
      `Verba ausente da tela: ${campo}.`,
    );
  }
});

test("as despesas de viagem somem quando a folga é comprada", () => {
  /*
   * Folga comprada não tem viagem. O motor já ignora esses valores; a tela
   * precisa parar de pedi-los, senão convida a preencher despesa que não
   * aconteceu e depois some do total sem explicação.
   */
  for (const campo of ["ticketOut", "hotel", "leaveStart"]) {
    assert.match(
      wrapper,
      new RegExp(
        `key: "${campo}"[^}]*showWhen: \\{ field: "resolution", equals: "Folga concedida" \\}`,
      ),
      `O campo ${campo} deveria aparecer só na folga concedida.`,
    );
  }
  assert.match(
    wrapper,
    /key: "purchaseAmount"[^}]*showWhen: \{ field: "resolution", equals: "Comprada pela empresa" \}/,
  );
});

test("comprar e vender são uma operação só", () => {
  /*
   * Decisão de Samuel Scolari: a empresa compra a folga, e o colaborador
   * vender é o mesmo negócio visto do outro lado. Duas opções separadas
   * criariam dois caminhos para o mesmo fato e dois números para conciliar.
   */
  const opcoes =
    wrapper.match(/key: "resolution"[^}]*options: \[([^\]]*)\]/)?.[1] ?? "";
  assert.equal(
    opcoes.trim(),
    '"Folga concedida", "Comprada pela empresa"',
    "A resolução tem duas saídas: conceder ou comprar. Não existe 'venda'.",
  );
});

test("o painel usa o mesmo motor que os testes exercitam", () => {
  /*
   * Se o painel refizer a conta por conta própria, passam a existir dois
   * números verdadeiros para a mesma pergunta — e só um deles é testado.
   */
  assert.match(painel, /from "\.\.\/\.\.\/lib\/field-leave\.mjs"/);
  assert.match(painel, /calculateFieldLeave\(/);
});

test("a Folga de Campo não encosta em férias", () => {
  /*
   * A regra de produto que sustenta o módulo. Se a tela passar a citar
   * férias, período aquisitivo ou 30 dias, alguém está misturando dois
   * institutos com contagens, durações e efeitos legais diferentes.
   */
  const semComentarios = (fonte) => fonte.replace(/\/\*[\s\S]*?\*\//g, "");
  const definicao =
    wrapper.match(/const fieldLeaveDefinition[\s\S]*?\n\};/)?.[0] ?? "";

  assert.ok(definicao, "A definição da tela sumiu.");
  assert.doesNotMatch(definicao, /vacation|férias|aquisitivo|terço/i);
  assert.doesNotMatch(semComentarios(painel), /vacation|férias/i);
});
