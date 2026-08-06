import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const wrapperPath = new URL(
  "../app/components/SecureBetaAppV97.tsx",
  import.meta.url,
);
const pagePath = new URL("../app/page.tsx", import.meta.url);

test("a aplicação ativa a estrutura V97 do Administrativo e RH", async () => {
  const page = await readFile(pagePath, "utf8");

  assert.match(page, /SecureBetaAppV97/);
  assert.doesNotMatch(page, /SecureBetaAppV66\s+from/);
});

test("Cálculo de Folha passa a se chamar Cálculo de Salário", async () => {
  const source = await readFile(wrapperPath, "utf8");

  assert.match(source, /label:\s*"Cálculo de Salário"/);
  assert.match(source, /shortLabel:\s*"Cálculo de Salário"/);
  assert.match(
    source,
    /replaceAll\([\s\S]*"Cálculo de Folha"[\s\S]*"Cálculo de Salário"/,
  );
});

test("Cálculo de Férias possui tela separada no grupo de RH", async () => {
  /*
   * A DEFINIÇÃO mora em `app/lib/modules.ts`, e não no componente. Esse
   * arquivo é o único que o SERVIDOR também lê: enquanto a definição ficava
   * só no cliente, a tela abria, preenchia e não salvava — o
   * `validateRecordPayload` recusa módulo que não conhece.
   *
   * A POSIÇÃO no menu continua no componente, que é quem reorganiza o grupo.
   * São duas responsabilidades e dois arquivos, e o teste cobra cada uma no
   * seu lugar.
   */
  const definicoes = await readFile(
    new URL("../app/lib/modules.ts", import.meta.url),
    "utf8",
  );
  const componente = await readFile(wrapperPath, "utf8");

  assert.match(definicoes, /id:\s*"vacations"/);
  assert.match(definicoes, /label:\s*"Cálculo de Férias"/);
  assert.match(componente, /rhGroup\.items\.splice/);
  assert.match(componente, /moduleMap\.payroll/);
});

test("as abas de afastamento ficam sempre entre salário e rescisão", async () => {
  /*
   * A Folga de Campo entrou ao lado de Férias — são os dois afastamentos do
   * grupo de RH, e ficam juntos entre o cálculo de salário e a rescisão.
   *
   * A verificação continua sendo da ORDEM, e não da posição literal: o que
   * não pode acontecer é uma delas cair fora do intervalo, ou o item ser
   * inserido duas vezes quando a camada roda de novo (ela é idempotente de
   * propósito, porque outras camadas também reorganizam o menu).
   */
  const source = await readFile(wrapperPath, "utf8");

  assert.match(
    source,
    /item !== "vacations" && item !== "field_leave"/,
    "Os dois precisam sair da lista antes de serem reinseridos, senão " +
      "duplicam a cada execução.",
  );
  assert.match(source, /orderedItems\.indexOf\("payroll"\)/);
  assert.match(source, /orderedItems\.indexOf\("terminations"\)/);
  assert.match(
    source,
    /orderedItems\.splice\(insertionIndex, 0, "vacations", "field_leave"\)/,
  );
  assert.match(source, /ensureRhStructure\(\);[\s\S]*return <SecureBetaAppV66/);
});

test("a etapa não implementa fórmulas de férias antecipadamente", async () => {
  const source = await readFile(
    new URL("../app/lib/modules.ts", import.meta.url),
    "utf8",
  );

  assert.doesNotMatch(
    source,
    /calculateVacation|calcularFerias|INSS.*férias|IRRF.*férias/i,
  );
  assert.match(
    source,
    /O cálculo será integrado aos dados salariais na próxima etapa/,
  );
});
