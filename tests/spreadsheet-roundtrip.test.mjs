/*
 * Ida e volta da planilha: gerar com a faixa e reconhecer de volta.
 *
 * A verificação que realmente importa depois de mexer no layout. Os outros
 * testes leem o código-fonte; este monta a planilha como o sistema monta e
 * pede ao PRÓPRIO importador que a leia.
 *
 * Sem isso, uma linha a mais no topo passaria em toda revisão e só
 * apareceria quando alguém importasse na frente do cliente — e não como
 * erro, mas como "importou e não veio nada".
 */
import assert from "node:assert/strict";
import test from "node:test";
import { createServer } from "vite";

test("a planilha com faixa da empresa continua sendo importável", async () => {
  const server = await createServer({
    configFile: false,
    appType: "custom",
    server: { middlewareMode: true },
  });

  try {
    const { moduleMap } = await server.ssrLoadModule("/app/lib/modules.ts");
    const { resolveFieldColumns } = await server.ssrLoadModule(
      "/app/lib/spreadsheet.ts",
    );
    const people = moduleMap.people;

    /* As linhas exatamente como `exportImportTemplate` as escreve. */
    const colunas = [
      people.fields.find((f) => f.key === people.titleField),
      people.fields.find((f) => f.key === "cpf"),
      people.fields.find((f) => f.key === people.referenceField),
      people.fields.find((f) => f.key === "salary"),
      people.fields.find((f) => f.key === "monthlyHours"),
    ].filter(Boolean);

    const faixa = [
      "BETA CONSTRUTORA",
      ...Array.from({ length: colunas.length - 1 }, () => ""),
    ];
    const cabecalho = colunas.map((campo) => campo.label);
    const linhas = [faixa, cabecalho, ["Maria Teste", "", "", "3500", "220"]];

    /*
     * O importador varre as primeiras linhas procurando a que tem duas ou
     * mais colunas reconhecíveis. A faixa não tem nenhuma; o cabeçalho tem
     * todas.
     */
    const naFaixa = resolveFieldColumns(people, linhas[0]);
    const noCabecalho = resolveFieldColumns(people, linhas[1]);

    assert.ok(
      naFaixa.length < 2,
      `A faixa foi confundida com cabeçalho (${naFaixa.length} colunas ` +
        "reconhecidas). O importador leria a tarja como títulos.",
    );
    assert.equal(
      noCabecalho.length,
      colunas.length,
      "O importador precisa reconhecer todas as colunas do cabeçalho.",
    );

    /* E as colunas reconhecidas apontam para os campos certos. */
    assert.deepEqual(
      noCabecalho.map((c) => c.key),
      colunas.map((c) => c.key),
    );
  } finally {
    await server.close();
  }
});
