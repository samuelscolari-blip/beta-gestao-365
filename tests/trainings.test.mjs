/*
 * Treinamentos e certificações obrigatórias.
 *
 * A regra que sustenta tudo: a situação NÃO é digitada, é calculada das
 * datas. Situação digitada envelhece sozinha — alguém marca "Concluído" e
 * o certificado vence seis meses depois sem ninguém tocar no registro, e a
 * pessoa é barrada no portão da obra.
 */
import assert from "node:assert/strict";
import test from "node:test";

import {
  DIAS_DE_AVISO,
  TREINAMENTOS,
  avaliarTreinamento,
  resumirTreinamentos,
} from "../app/lib/trainings.mjs";

/* "Hoje" fixo: sem isso, um teste de vencimento passa hoje e falha amanhã. */
const HOJE = "2026-08-06";

test("sem agendamento, o treinamento está pendente e pede atenção", () => {
  const r = avaliarTreinamento({}, HOJE);
  assert.equal(r.situacao, "Pendente");
  assert.equal(r.precisaAtencao, true);
  assert.match(r.avisos[0], /não pode entrar na obra/);
});

test("data agendada no futuro é agendamento em ordem", () => {
  const r = avaliarTreinamento({ scheduledDate: "2026-09-10" }, HOJE);
  assert.equal(r.situacao, "Agendado");
  assert.equal(r.precisaAtencao, false);
});

test("data agendada que passou sem conclusão é o caso mais caro", () => {
  /*
   * Todo mundo acha que está resolvido porque "foi agendado", e a pessoa
   * continua sem poder entrar. Precisa aparecer como pendência.
   */
  const r = avaliarTreinamento({ scheduledDate: "2026-07-20" }, HOJE);
  assert.equal(r.situacao, "Agendamento vencido");
  assert.equal(r.precisaAtencao, true);
  assert.match(r.avisos[0], /ainda sem conclusão/);
});

test("concluído com validade longe está em dia", () => {
  const r = avaliarTreinamento(
    { completedDate: "2026-01-15", validityDate: "2028-01-15" },
    HOJE,
  );
  assert.equal(r.situacao, "Concluído");
  assert.equal(r.precisaAtencao, false);
  assert.equal(r.avisos.length, 0);
});

test("concluído sem validade não vira pendência", () => {
  /*
   * É o caso das integrações, que valem enquanto durar o contrato. Tratar
   * ausência de validade como erro encheria a tela de alarme falso, e
   * alarme falso ensina a ignorar a tela.
   */
  const r = avaliarTreinamento({ completedDate: "2026-01-15" }, HOJE);
  assert.equal(r.situacao, "Concluído");
  assert.equal(r.precisaAtencao, false);
  assert.equal(r.diasParaVencer, null);
});

test("avisa antes de vencer, com a antecedência definida", () => {
  /* 20 dias à frente: dentro da janela de aviso. */
  const dentro = avaliarTreinamento(
    { completedDate: "2024-08-26", validityDate: "2026-08-26" },
    HOJE,
  );
  assert.equal(DIAS_DE_AVISO, 30);
  assert.equal(dentro.situacao, "A vencer");
  assert.equal(dentro.diasParaVencer, 20);
  assert.equal(dentro.precisaAtencao, true);

  /* 40 dias à frente: ainda tranquilo. */
  const fora = avaliarTreinamento(
    { completedDate: "2024-09-15", validityDate: "2026-09-15" },
    HOJE,
  );
  assert.equal(fora.situacao, "Concluído");
  assert.equal(fora.precisaAtencao, false);
});

test("certificado vencido barra a entrada e diz isso", () => {
  const r = avaliarTreinamento(
    { completedDate: "2024-07-01", validityDate: "2026-07-01" },
    HOJE,
  );
  assert.equal(r.situacao, "Vencido");
  assert.ok(r.diasParaVencer < 0);
  assert.equal(r.precisaAtencao, true);
  assert.match(r.avisos[0], /não pode entrar na obra até renovar/);
});

test("vencer exatamente hoje ainda conta como a vencer, não vencido", () => {
  /*
   * O certificado vale o dia inteiro do vencimento. Marcar como vencido
   * barraria alguém que ainda pode trabalhar.
   */
  const r = avaliarTreinamento(
    { completedDate: "2024-08-06", validityDate: HOJE },
    HOJE,
  );
  assert.equal(r.situacao, "A vencer");
  assert.equal(r.diasParaVencer, 0);
});

test("a lista de treinamentos é fechada, e traz os da operação", () => {
  /*
   * Em campo livre, "NR 35", "NR-35" e "Trabalho em Altura" viram três
   * treinamentos diferentes — e aí ninguém responde quantas pessoas têm
   * altura em dia.
   */
  for (const obrigatorio of [
    "Integração Elecnor",
    "Integração Engie",
    "Treinamento Sinaleiro",
    "Trabalho em altura — NR-35",
    "Direção Defensiva",
    "NR-11 — Movimentação de cargas",
    "NR-12 — Máquinas e equipamentos",
  ]) {
    assert.ok(
      TREINAMENTOS.includes(obrigatorio),
      `Treinamento da operação ausente: ${obrigatorio}`,
    );
  }
});

test("o resumo ordena as pendências pela urgência", () => {
  /*
   * Quem abre a tela de manhã resolve de cima para baixo. Vencido tem que
   * vir antes de pendente, senão o mais grave fica no fim da lista.
   */
  const registros = [
    { payload: { employeeName: "Ana", trainingType: "NR-35" } },
    {
      payload: {
        employeeName: "Bruno",
        trainingType: "NR-11",
        completedDate: "2024-07-01",
        validityDate: "2026-07-01",
      },
    },
    {
      payload: {
        employeeName: "Carla",
        trainingType: "NR-12",
        completedDate: "2024-08-26",
        validityDate: "2026-08-26",
      },
    },
    {
      payload: {
        employeeName: "Davi",
        trainingType: "Sinaleiro",
        completedDate: "2026-01-10",
        validityDate: "2029-01-10",
      },
    },
  ];

  const r = resumirTreinamentos(registros, HOJE);

  assert.equal(r.total, 4);
  assert.deepEqual(
    r.pendencias.map((p) => p.situacao),
    ["Vencido", "A vencer", "Pendente"],
  );
  assert.equal(r.pendencias[0].colaborador, "Bruno");
  assert.equal(r.porSituacao["Concluído"], 1);
});

test("o resumo aceita registro cru e registro com payload", () => {
  /* A tela entrega registros do banco; testes e scripts entregam objetos. */
  const comPayload = resumirTreinamentos(
    [{ payload: { employeeName: "Ana" } }],
    HOJE,
  );
  const cru = resumirTreinamentos([{ employeeName: "Ana" }], HOJE);
  assert.equal(comPayload.pendencias[0].colaborador, "Ana");
  assert.equal(cru.pendencias[0].colaborador, "Ana");
});
