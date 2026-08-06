/*
 * Módulos que o banco aceita gravar.
 *
 * Incidente real, em produção: `db/records.ts` mantinha uma SEGUNDA lista de
 * módulos, escrita à mão. Ao criar Cálculo de Férias, Folga de Campo e
 * Treinamentos, a definição foi para `app/lib/modules.ts` e essa lista ficou
 * para trás.
 *
 * O estrago não ficou nas telas novas. Os registros fictícios de treinamento
 * passaram a ser recusados com "Módulo inválido"; a recusa derrubou a
 * semeadura inteira; e como a semeadura rodava dentro do mesmo `try` da
 * consulta, `GET /api/records` respondeu erro. O sistema TODO apareceu vazio
 * — obras, máquinas, contas, pessoas. Um módulo novo apagou tudo.
 *
 * Duas causas, dois testes: a lista duplicada e o exemplo derrubando o dado
 * real.
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const records = readFileSync("db/records.ts", "utf8");
const modules = readFileSync("app/lib/modules.ts", "utf8");
const rota = readFileSync("app/api/records/route.ts", "utf8");

test("a lista de módulos aceitos sai da definição, e não de uma cópia", () => {
  const bloco =
    records.match(/const allowedModules = new Set\(\[([\s\S]*?)\]\);/)?.[1] ??
    "";

  assert.ok(bloco, "A lista de módulos aceitos sumiu de db/records.ts.");
  assert.match(
    bloco,
    /\.\.\.Object\.keys\(moduleMap\)/,
    "A lista precisa derivar de `moduleMap`. Escrita à mão, ela envelhece " +
      "calada: a tela nova salva no cliente e o banco recusa.",
  );
});

test("todo módulo com tela é aceito pelo banco", () => {
  /*
   * O teste acima garante a forma; este garante o efeito. Se alguém voltar a
   * escrever a lista à mão, mas completa, passa aqui e falha lá — e é o de
   * cima que aponta a causa.
   */
  const ids = [...modules.matchAll(/^ {4}id: "([a-z_0-9-]+)",/gm)].map(
    (m) => m[1],
  );

  assert.ok(ids.length > 15, `Poucos módulos encontrados: ${ids.length}.`);

  const bloco =
    records.match(/const allowedModules = new Set\(\[([\s\S]*?)\]\);/)?.[1] ??
    "";
  const derivada = bloco.includes("...Object.keys(moduleMap)");

  for (const id of ids) {
    assert.ok(
      derivada || bloco.includes(`"${id}"`),
      `O banco recusaria o módulo ${id}. Registro criado nessa tela não salva.`,
    );
  }
});

test("falha ao semear exemplos não derruba a leitura dos dados reais", () => {
  /*
   * Foi este acoplamento que transformou um registro fictício ruim em
   * sistema vazio. Exemplo é conforto; dado real é o serviço.
   */
  const trecho =
    rota.match(/export async function GET[\s\S]*?const url = new URL/)?.[0] ??
    "";

  assert.ok(trecho, "O GET de /api/records mudou de forma.");
  assert.match(
    trecho,
    /try \{\s*await ensureDemoRecords\(\);\s*\} catch/,
    "A semeadura dos exemplos precisa do próprio try: se ela falhar, a " +
      "consulta ainda tem que responder com os dados reais.",
  );
  assert.match(trecho, /console\.error\(/, "A falha precisa ficar registrada.");
});
