/*
 * O interruptor "esta base é real".
 *
 * Separa o sistema em demonstração do sistema em operação. São dois
 * comportamentos incompatíveis: a demonstração precisa parecer cheia, a
 * operação precisa que nada fictício entre em lista, total ou decisão.
 *
 * O que estes testes protegem é o desligado por padrão e o alcance da chave.
 * Desligado por padrão porque ligar sozinho esconderia dados de quem está
 * demonstrando, sem explicação. Alcance porque proteger metade dos caminhos
 * é o mesmo que não proteger: basta um deles aberto.
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

import { CAMPO_BASE_OFICIAL, baseEhOficial } from "../app/lib/official-base.ts";

const registros = readFileSync("db/records.ts", "utf8");
const rota = readFileSync("app/api/records/route.ts", "utf8");
const tela = readFileSync("app/components/BetaApp.tsx", "utf8");

test("na dúvida, a base é demonstração", () => {
  /*
   * Configuração ausente, vazia ou ilegível vale como demonstração. O padrão
   * permissivo é deliberado: um sistema que se fecha sozinho por causa de
   * configuração faltando esconde dados sem dizer por quê.
   */
  assert.equal(baseEhOficial(undefined), false);
  assert.equal(baseEhOficial(null), false);
  assert.equal(baseEhOficial({}), false);
  assert.equal(baseEhOficial({ [CAMPO_BASE_OFICIAL]: "" }), false);
  assert.equal(baseEhOficial({ [CAMPO_BASE_OFICIAL]: "Não" }), false);
  assert.equal(baseEhOficial({ [CAMPO_BASE_OFICIAL]: "talvez" }), false);
});

test("só o Sim explícito declara a base real", () => {
  assert.equal(baseEhOficial({ [CAMPO_BASE_OFICIAL]: "Sim" }), true);
  assert.equal(baseEhOficial({ [CAMPO_BASE_OFICIAL]: "  Sim  " }), true);
});

test("base real para de repor os exemplos apagados", () => {
  /*
   * Era o defeito concreto: apagar o "Colaborador Teste 01" não adiantava,
   * porque o carregamento seguinte o trazia de volta.
   */
  const semear =
    registros.match(/export async function ensureDemoRecords\(\)[\s\S]{0,700}/)?.[0] ??
    "";
  assert.match(
    semear,
    /if \(await baseOficialAtiva\(\)\) return;/,
    "A semeadura precisa desistir antes de inserir qualquer coisa.",
  );
});

test("o exemplo some de TODOS os caminhos de leitura", () => {
  /*
   * Um caminho esquecido basta para o fictício reaparecer num total. A tela
   * usa os dois: `queryRecords` na lista paginada, `listRecords` no resto.
   */
  for (const funcao of ["listRecords", "queryRecords"]) {
    const trecho =
      registros.match(
        new RegExp(`export async function ${funcao}\\([\\s\\S]{0,1200}`),
      )?.[0] ?? "";
    assert.ok(trecho, `A função ${funcao} sumiu.`);
    assert.match(
      trecho,
      /DEMO_SOURCE/,
      `${funcao} não filtra os registros fictícios: eles voltariam a somar ` +
        "nos totais de uma base declarada real.",
    );
  }
});

test("esconder é por consulta, e não por exclusão", () => {
  /*
   * A chave não pode destruir nada. Voltar para demonstração precisa devolver
   * a base inteira — e um DELETE tornaria a decisão irreversível.
   */
  assert.doesNotMatch(
    registros,
    /DELETE FROM records[^;]*source/i,
    "Registro fictício não se apaga por causa da chave: ele sai da consulta.",
  );
});

test("nome e salário saem pela porta da frente também", () => {
  /*
   * No cadastro de funcionário o título É o nome e o valor É o salário.
   * Proteger só o payload deixaria os dois passando no cabeçalho do registro
   * — que é justamente o que a lista mostra.
   */
  assert.match(rota, /camposPessoaisDaBaseReal = new Set\(\["name", "salary"\]\)/);
  assert.match(rota, /const pessoaProtegida = baseOficial && record\.module === "people"/);
  assert.match(rota, /pessoaProtegida\s*\?\s*"Dado protegido"/);
  assert.match(rota, /amount: isProtectedCalculation \|\| pessoaProtegida \? 0 : record\.amount/);
});

test("a proteção não alcança quem administra", () => {
  /*
   * Quem entrou como administrador precisa ver o salário — é ele quem lança
   * a folha. A máscara existe para o visitante.
   */
  assert.match(
    rota,
    /const publicRecords = isSoleAdmin\(request\)\s*\?\s*records/,
    "O administrador precisa continuar recebendo o registro inteiro.",
  );
});

test("cargo e situação continuam visíveis", () => {
  /*
   * Engenheiro e encarregado precisam saber quem está ativo e em que função.
   * Esconder isso junto com o salário deixaria a tela sem serventia para
   * quem está na obra.
   */
  const protegidos =
    rota.match(/camposPessoaisDaBaseReal = new Set\(\[([^\]]*)\]\)/)?.[1] ?? "";
  assert.ok(protegidos.trim(), "A lista de campos protegidos sumiu.");
  for (const campo of ["role", "status", "admissionDate"]) {
    assert.ok(
      !protegidos.includes(`"${campo}"`),
      `O campo ${campo} não deveria ser escondido pela chave: engenheiro e ` +
        "encarregado precisam dele para saber quem está na obra e em que função.",
    );
  }
});

test("a chave é virada na tela, sem publicação", () => {
  /*
   * Se dependesse de variável de ambiente, virar a chave exigiria entrar no
   * painel da Cloudflare ou pedir uma publicação — e a decisão é do
   * administrador, no dia em que ele souber que a base deixou de ser ensaio.
   */
  assert.match(tela, /officialBase: string;/);
  assert.match(tela, /officialBase: "Não",/);
  assert.match(tela, /update\("officialBase", event\.target\.value\)/);
  assert.match(tela, /Esta base já é real\?/);
});
