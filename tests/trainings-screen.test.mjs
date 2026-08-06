/*
 * Treinamentos — a tela.
 *
 * O motor tem testes próprios em `trainings.test.mjs`. Aqui se verifica a
 * ligação: o módulo existe onde o servidor enxerga, fica ao lado de
 * Documentos, e as abas por treinamento recortam a lista em vez de criarem
 * uma segunda.
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const modules = readFileSync("app/lib/modules.ts", "utf8");
const betaApp = readFileSync("app/components/BetaApp.tsx", "utf8");
const abas = readFileSync("app/ui/TrainingsTabs/TrainingsTabs.tsx", "utf8");

test("o servidor conhece o módulo", () => {
  /*
   * A definição precisa estar em `app/lib/modules.ts`, e não só no
   * componente: `validateRecordPayload` recusa módulo sem definição, e a tela
   * abriria, preencheria e não salvaria — sem erro visível.
   */
  assert.match(modules, /id: "trainings"/);
  assert.match(modules, /label: "Treinamentos e Certificações"/);

  for (const campo of [
    "employeeName",
    "trainingType",
    "scheduledDate",
    "completedDate",
    "validityDate",
  ]) {
    assert.ok(
      modules.includes(`key: "${campo}"`),
      `Campo ausente da definição do módulo: ${campo}.`,
    );
  }
});

test("a tela fica ao lado de Documentos", () => {
  /*
   * Escolha de Samuel Scolari: certificado de NR é documento, e quem confere
   * um confere o outro na mesma sentada.
   */
  const grupo =
    modules.match(/label: "OPERAÇÃO & DOCUMENTOS", items: \[([^\]]*)\]/)?.[1] ??
    "";
  assert.ok(
    grupo.includes('"trainings"'),
    "Treinamentos saiu do grupo de Documentos.",
  );
  assert.ok(
    grupo.indexOf('"documents"') < grupo.indexOf('"trainings"'),
    "Treinamentos deve vir depois de Documentos, não antes.",
  );
});

test("a lista de treinamentos vem do motor, e não é redigitada na tela", () => {
  /*
   * Se a tela tivesse a própria lista, ela e o motor divergiriam no primeiro
   * treinamento novo — e a aba de um curso existente simplesmente não
   * apareceria.
   */
  assert.match(modules, /options: TREINAMENTOS/);
  assert.match(modules, /from "\.\/trainings\.mjs"/);
  assert.match(abas, /from "\.\.\/\.\.\/lib\/trainings\.mjs"/);
});

test("a aba recorta a lista de baixo, em vez de criar uma segunda", () => {
  /*
   * Duas listas do mesmo dado é a origem clássica de "na aba diz uma coisa e
   * na lista diz outra" — justamente na conferência antes da reunião de
   * segurança.
   */
  assert.match(betaApp, /const \[trainingTab, setTrainingTab\] = useState\(""\)/);
  assert.match(
    betaApp,
    /module\.id !== "trainings" \|\|\s*!trainingTab \|\|\s*String\(record\.payload\.trainingType \?\? ""\)\.trim\(\) === trainingTab/,
    "O filtro da aba precisa entrar no mesmo `visibleRecords` que alimenta a tabela.",
  );
});

test("a situação da aba é calculada, nunca lida do campo digitado", () => {
  /*
   * A mesma regra do motor: status digitado envelhece sozinho. A contagem
   * vermelha da aba tem que sair das datas.
   */
  assert.match(abas, /avaliarTreinamento\(payload\)\.precisaAtencao/);
  assert.doesNotMatch(abas, /payload\.status/);
});

test("treinamento fora da lista oficial aparece, em vez de sumir", () => {
  /*
   * Importação com o nome trocado precisa ficar visível para ser corrigida.
   * Se a aba só aceitasse a lista fechada, o registro desapareceria da tela e
   * continuaria contando como pessoa sem treinamento.
   */
  assert.match(abas, /forasDaLista/);
  assert.match(abas, /!TREINAMENTOS\.includes\(tipo\)/);
});
