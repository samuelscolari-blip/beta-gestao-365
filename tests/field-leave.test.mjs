/*
 * Folga de Campo — regra dos 90 dias, dos 9 dias corridos e do custo.
 *
 * O que estes testes protegem, em ordem de importância:
 *  1. a folga NUNCA se confundir com férias;
 *  2. 9 dias corridos serem 9, e não 10;
 *  3. folga comprada não gerar custo de viagem que não aconteceu.
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

/*
 * O motor é JavaScript puro, como `ibs-cbs.js`, justamente para o teste
 * carregar a MESMA função que roda em produção — sem passo de compilação e
 * sem cópia intermediária que possa divergir. Os tipos moram no `.d.ts` ao
 * lado.
 *
 * A primeira versão deste teste tentava remover as anotações de tipo do
 * arquivo `.ts` com expressões regulares e avaliar o resultado. Quebrou na
 * primeira execução, e com razão: o que estaria sendo testado seria um
 * texto reescrito por regex, não o motor.
 */
import {
  DIAS_DE_FOLGA,
  DIAS_PARA_NOVA_FOLGA,
  calculateFieldLeave,
  temDireitoAFolgaDeCampo,
} from "../app/lib/field-leave.mjs";

const fonte = readFileSync("app/lib/field-leave.mjs", "utf8");

test("a folga nasce 90 dias depois do marco inicial", () => {
  const r = calculateFieldLeave({ contagemDesde: "2026-01-01" });
  assert.equal(DIAS_PARA_NOVA_FOLGA, 90);
  assert.equal(r.direitoEm, "2026-04-01");
});

test("nove dias corridos terminam no nono dia, não no décimo", () => {
  /*
   * O erro clássico: somar 9 ao dia de início. Quem sai no dia 1º volta no
   * dia 9 — são 9 dias contando o primeiro. Somar 9 daria dez dias de folga
   * e um dia a mais de custo em toda folga do sistema.
   */
  const r = calculateFieldLeave({
    contagemDesde: "2026-01-01",
    inicioDaFolga: "2026-04-01",
  });
  assert.equal(DIAS_DE_FOLGA, 9);
  assert.equal(r.fimDaFolga, "2026-04-09");
});

test("a contagem atravessa a virada do mês e do ano sem errar", () => {
  const virada = calculateFieldLeave({
    contagemDesde: "2025-12-28",
    inicioDaFolga: "2026-12-28",
  });
  assert.equal(virada.direitoEm, "2026-03-28");
  assert.equal(virada.fimDaFolga, "2027-01-05");

  /* 2028 é bissexto: fevereiro tem 29 dias. */
  const bissexto = calculateFieldLeave({ contagemDesde: "2027-12-02" });
  assert.equal(bissexto.direitoEm, "2028-03-01");
});

test("o custo soma passagem, alimentação dos dois percursos e hotel", () => {
  const r = calculateFieldLeave({
    contagemDesde: "2026-01-01",
    inicioDaFolga: "2026-04-01",
    passagemIda: 480,
    passagemVolta: 510,
    alimentacaoIda: 90,
    alimentacaoVolta: 85,
    hotel: 240,
  });

  assert.equal(r.custoTotal, 1405);
  assert.equal(r.custoDeDeslocamento, 1405);
  assert.deepEqual(
    r.linhas.map((l) => l.rotulo),
    [
      "Passagem — ida",
      "Passagem — volta",
      "Alimentação no percurso — ida",
      "Alimentação no percurso — volta",
      "Hotel",
    ],
  );
});

test("hotel é opcional e não aparece quando não houve", () => {
  const r = calculateFieldLeave({
    contagemDesde: "2026-01-01",
    inicioDaFolga: "2026-04-01",
    passagemIda: 300,
    passagemVolta: 300,
  });

  assert.equal(r.custoTotal, 600);
  assert.ok(!r.linhas.some((l) => l.rotulo === "Hotel"));
});

test("folga comprada não gera custo de viagem que não aconteceu", () => {
  /*
   * Se a empresa compra a folga, o colaborador não viaja. Aceitar passagem
   * e hotel aqui inventaria despesa e inflaria o custo da obra.
   */
  const r = calculateFieldLeave({
    contagemDesde: "2026-01-01",
    resolucao: "Comprada pela empresa",
    valorDaCompra: 1800,
    passagemIda: 480,
    hotel: 240,
  });

  assert.equal(r.custoDeDeslocamento, 0);
  assert.equal(r.custoTotal, 1800);
  assert.deepEqual(r.linhas, [{ rotulo: "Compra da folga", valor: 1800 }]);
  assert.ok(
    r.avisos.some((a) => a.includes("desconsiderados")),
    "O usuário precisa saber que os valores de viagem foram ignorados.",
  );
});

test("a compra avisa que a natureza tributária precisa da contabilidade", () => {
  /*
   * O motor NÃO decide se o valor entra na base de INSS e IRRF. Essa é uma
   * definição contábil, e chutá-la produziria folha errada com aparência de
   * certa. O aviso existe para que a decisão seja tomada por quem pode.
   */
  const r = calculateFieldLeave({
    contagemDesde: "2026-01-01",
    resolucao: "Comprada pela empresa",
    valorDaCompra: 1800,
  });

  assert.ok(r.avisos.some((a) => a.includes("INSS") && a.includes("IRRF")));
});

test("comprar a folga não adia a folga seguinte", () => {
  /*
   * Quem fica trabalhando não pode ser punido com uma espera maior pela
   * próxima folga. Na compra, a contagem recomeça na data em que o direito
   * nasceu; na folga concedida, no dia em que ele volta.
   */
  const comprada = calculateFieldLeave({
    contagemDesde: "2026-01-01",
    resolucao: "Comprada pela empresa",
    valorDaCompra: 1800,
  });
  assert.equal(comprada.proximaContagemDesde, "2026-04-01");

  const concedida = calculateFieldLeave({
    contagemDesde: "2026-01-01",
    inicioDaFolga: "2026-04-01",
  });
  assert.equal(concedida.proximaContagemDesde, "2026-04-09");
});

test("avisa quando a folga é marcada antes de o direito nascer", () => {
  const r = calculateFieldLeave({
    contagemDesde: "2026-01-01",
    inicioDaFolga: "2026-02-10",
  });
  assert.ok(r.avisos.some((a) => a.includes("antes de o direito nascer")));
});

test("o direito vem da marcação do cadastro, não da grafia da cidade", () => {
  /*
   * Comparar a cidade do colaborador com a da obra parece automático e é
   * frágil: "Feira de Santana" contra "feira de santana - BA" negaria o
   * direito a quem tem. A marcação é explícita e revisável.
   */
  assert.equal(temDireitoAFolgaDeCampo({ livesOutOfTown: "Sim" }), true);
  assert.equal(temDireitoAFolgaDeCampo({ livesOutOfTown: "Não" }), false);
  assert.equal(temDireitoAFolgaDeCampo({}), false);
  assert.equal(
    temDireitoAFolgaDeCampo({ livesOutOfTown: "Não", homeCity: "Salvador" }),
    false,
    "Ter cidade preenchida não dá direito: quem decide é a marcação.",
  );
});

test("a Folga de Campo não se confunde com férias em lugar nenhum", () => {
  /*
   * A regra de produto mais importante deste módulo. Férias têm período
   * aquisitivo de 12 meses, 30 dias e terço constitucional; a Folga de Campo
   * tem 90 dias, 9 dias e nenhum reflexo em eSocial. Se este arquivo passar
   * a importar o módulo de férias ou a citar seus números, alguém está
   * misturando as duas coisas.
   */
  const semComentarios = fonte.replace(/\/\*[\s\S]*?\*\//g, "");

  assert.doesNotMatch(semComentarios, /vacation/i);
  assert.doesNotMatch(semComentarios, /\bférias\b/i);
  assert.doesNotMatch(
    semComentarios,
    /\b30\b/,
    "Trinta dias é férias. A Folga de Campo é de 9.",
  );
  assert.doesNotMatch(
    semComentarios,
    /terço|umTerco|abono/i,
    "Terço constitucional e abono pecuniário pertencem a férias.",
  );
});
