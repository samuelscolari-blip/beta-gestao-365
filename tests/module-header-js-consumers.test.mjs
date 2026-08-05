/*
 * Consumidores do cabeçalho em JavaScript.
 *
 * Além do CSS, quatro trechos de JavaScript dependiam da classe global
 * `.module-heading`. Dois deles são FUNCIONAIS, não cosméticos:
 *
 *   - os atalhos rápidos clicam o botão primário do cabeçalho para abrir o
 *     formulário de novo registro. Se a classe sumir, o atalho para de
 *     criar registros — e nenhum teste visual acusa, porque a tela em
 *     repouso continua idêntica;
 *   - a tela de Férias era localizada comparando o TEXTO do <h1>, e o
 *     resultado marcava o elemento pai com `.vacations-page`, que ativa
 *     nove regras do V98. Renomear o título apagaria a estilização em
 *     silêncio.
 *
 * Migrados para `[data-ui="module-header"]`, que o React declara. A
 * equivalência foi verificada em navegador: injetando o botão primário que
 * só existe para administrador, o seletor novo resolve para exatamente o
 * mesmo elemento que o antigo, em cinco telas.
 */
import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import test from "node:test";

const COMPONENT_PATH = "app/ui/ModuleHeader/ModuleHeader.tsx";

function listTsxFiles(directory = "app") {
  return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const path = join(directory, entry.name);
    if (entry.isDirectory()) return listTsxFiles(path);
    return entry.name.endsWith(".tsx") ? [path] : [];
  });
}

test("nenhum JavaScript localiza o cabeçalho pela classe global", () => {
  const infratores = listTsxFiles().filter((path) =>
    /querySelector(All)?[^\n]*\.module-heading/.test(readFileSync(path, "utf8")),
  );

  assert.deepEqual(
    infratores,
    [],
    'Use [data-ui="module-header"]. A classe global vai ser removida na ' +
      "migração das variantes, e uma busca por ela falha em silêncio: o " +
      "atalho simplesmente para de funcionar, sem erro e sem teste visual " +
      "acusando.",
  );
});

test("a tela de Férias é localizada pelo id do módulo, não pelo texto do título", () => {
  const fonte = readFileSync("app/components/SecureBetaAppV97.tsx", "utf8");

  assert.match(
    fonte,
    /\[data-ui="module-header"\]\[data-module="\$\{vacationsDefinition\.id\}"\]/,
  );
  assert.doesNotMatch(
    fonte,
    /textContent\?\.trim\(\) === "Cálculo de Férias"/,
    "Comparar o texto do título torna a estilização refém do nome da tela.",
  );
});

test("o componente publica o identificador do módulo", () => {
  const component = readFileSync(COMPONENT_PATH, "utf8");
  assert.match(component, /data-module=\{moduleId\}/);
});
