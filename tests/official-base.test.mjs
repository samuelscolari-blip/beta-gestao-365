/*
 * A operação da Beta Construtora passou a usar somente dados oficiais.
 *
 * Estes testes impedem que uma configuração antiga volte a colocar os
 * registros fictícios nas listas, totais e decisões do sistema.
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

import {
  BASE_OFICIAL_FORCADA,
  CAMPO_BASE_OFICIAL,
  baseEhOficial,
} from "../app/lib/official-base.ts";

const registros = readFileSync("db/records.ts", "utf8");
const rota = readFileSync("app/api/records/route.ts", "utf8");

test("a base operacional permanece oficial mesmo com configuração antiga", () => {
  assert.equal(BASE_OFICIAL_FORCADA, true);
  assert.equal(baseEhOficial(undefined), true);
  assert.equal(baseEhOficial(null), true);
  assert.equal(baseEhOficial({}), true);
  assert.equal(baseEhOficial({ [CAMPO_BASE_OFICIAL]: "" }), true);
  assert.equal(baseEhOficial({ [CAMPO_BASE_OFICIAL]: "Não" }), true);
  assert.equal(baseEhOficial({ [CAMPO_BASE_OFICIAL]: "Sim" }), true);
});

test("base oficial para de repor os exemplos apagados", () => {
  const semear =
    registros.match(/export async function ensureDemoRecords\(\)[\s\S]{0,700}/)?.[0] ??
    "";
  assert.match(
    semear,
    /if \(await baseOficialAtiva\(\)\) return;/,
    "A semeadura precisa desistir antes de inserir qualquer exemplo.",
  );
});

test("o exemplo some de todos os caminhos de leitura", () => {
  for (const funcao of ["listRecords", "queryRecords"]) {
    const trecho =
      registros.match(
        new RegExp(`export async function ${funcao}\\([\\s\\S]{0,1400}`),
      )?.[0] ?? "";
    assert.ok(trecho, `A função ${funcao} sumiu.`);
    assert.match(
      trecho,
      /DEMO_SOURCE/,
      `${funcao} não filtra os registros fictícios.`,
    );
  }
});

test("nome e salário reais continuam protegidos fora da administração", () => {
  assert.match(
    rota,
    /camposPessoaisDaBaseReal = new Set\(\["name", "salary"\]\)/,
  );
  assert.match(
    rota,
    /const pessoaProtegida = baseOficial && record\.module === "people"/,
  );
  assert.match(rota, /pessoaProtegida\s*\?\s*"Dado protegido"/);
  assert.match(
    rota,
    /amount: isProtectedCalculation \|\| pessoaProtegida \? 0 : record\.amount/,
  );
});

test("o administrador continua recebendo o cadastro completo", () => {
  assert.match(
    rota,
    /const publicRecords = isSoleAdmin\(request\)\s*\?\s*records/,
  );
});

test("cargo, situação e admissão permanecem disponíveis à operação", () => {
  const protegidos =
    rota.match(/camposPessoaisDaBaseReal = new Set\(\[([^\]]*)\]\)/)?.[1] ?? "";
  assert.ok(protegidos.trim(), "A lista de campos protegidos sumiu.");
  for (const campo of ["role", "status", "admissionDate"]) {
    assert.ok(
      !protegidos.includes(`"${campo}"`),
      `O campo ${campo} não deveria ser escondido da operação.`,
    );
  }
});
