/*
 * Ações rápidas do Administrativo.
 *
 * Regressão real, encontrada em produção: "Cadastrar funcionário" parou de
 * abrir a ficha. O atalho navegava até a tela e então procurava no DOM o
 * botão "Novo registro" do cabeçalho para clicar nele. Quando o cabeçalho de
 * Administrativo deixou de exibir esse botão — e o de Máquinas deixou de ser
 * renderizado —, o seletor não achou alvo e a função terminou em silêncio:
 * clique sem efeito, sem erro no console, sem pista.
 *
 * O que estes testes protegem é a natureza da correção. Não basta o atalho
 * voltar a funcionar hoje: ele não pode voltar a depender de um detalhe
 * visual, senão a próxima mudança de layout o quebra de novo do mesmo jeito.
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const v52 = readFileSync("app/components/BetaAppV52.tsx", "utf8");
const secureV52 = readFileSync("app/components/SecureBetaAppV52.tsx", "utf8");
const betaApp = readFileSync("app/components/BetaApp.tsx", "utf8");
const contrato = readFileSync("app/lib/quick-actions.ts", "utf8");

test("nenhum atalho abre cadastro clicando no botão do cabeçalho", () => {
  /*
   * Este é o teste que teria pego o defeito. O seletor é a doença: amarra
   * uma função a um elemento que existe por decisão de layout.
   */
  for (const [nome, fonte] of [
    ["BetaAppV52", v52],
    ["SecureBetaAppV52", secureV52],
  ]) {
    assert.doesNotMatch(
      fonte,
      /\[data-ui="module-header"\][^\n]*\.button\.primary/,
      `${nome} voltou a procurar o botão do cabeçalho para abrir cadastro. ` +
        "Use pedirNovoRegistro(moduleId): o pedido não depende de o botão existir.",
    );
  }
});

test("o atalho pede o cadastro pelo nome do módulo", () => {
  assert.match(contrato, /export const NOVO_REGISTRO_EVENTO = "beta:novo-registro"/);
  assert.match(contrato, /export function pedirNovoRegistro\(moduleId: string\)/);
  assert.match(v52, /pedirNovoRegistro\(moduleId\)/);
  assert.match(v52, /pedirNovoRegistro\("purchases"\)/);
  assert.match(secureV52, /pedirNovoRegistro\("suppliers"\)/);
});

test("a tela atende o pedido abrindo o formulário do módulo", () => {
  assert.match(betaApp, /window\.addEventListener\(NOVO_REGISTRO_EVENTO/);
  assert.match(betaApp, /window\.removeEventListener\(NOVO_REGISTRO_EVENTO/);
  assert.match(betaApp, /setModalModule\(moduleMap\[moduleId\]\)/);
});

test("o atalho respeita o acesso somente leitura", () => {
  /*
   * O caminho antigo herdava a proteção de graça: o botão do cabeçalho nem
   * era renderizado para quem não é administrador. O caminho novo não passa
   * por lá, então precisa recusar por conta própria — senão o modo consulta
   * ganharia um formulário de cadastro pelo atalho.
   */
  const ouvinte = betaApp.match(/function abrirCadastro\(event: Event\)[\s\S]*?\n    \}/)?.[0] ?? "";
  assert.ok(ouvinte, "O ouvinte do pedido sumiu.");
  assert.match(ouvinte, /if \(!isAdmin\)/);
  assert.match(ouvinte, /somente para consulta/);
});

test("módulo desconhecido não abre formulário vazio", () => {
  /*
   * `setModalModule(undefined)` deixaria a tela num estado sem definição, com
   * o formulário aberto e sem campos.
   */
  assert.match(betaApp, /if \(!moduleId \|\| !moduleMap\[moduleId\]\) return;/);
});

test("as telas que perderam o botão continuam com atalho", () => {
  /*
   * São exatamente as duas que quebraram: Administrativo esconde a ação
   * primária, Máquinas nem renderiza o cabeçalho.
   */
  assert.match(betaApp, /hidePrimaryAction=\{activeView === "people"\}/);
  assert.match(
    betaApp,
    /hideHeading=\{activeView === "works" \|\| activeView === "assets"\}/,
  );
  assert.match(v52, /\["people", "Cadastrar funcionário"/);
  assert.match(v52, /\["assets", "Abrir máquinas"/);
});
