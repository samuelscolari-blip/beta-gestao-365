/*
 * Nome do arquivo exportado.
 *
 * Pedido de Samuel Scolari: o arquivo precisa dizer de qual tela saiu. Dez
 * exportações viram dez arquivos na área de trabalho, e "export.xlsx"
 * repetido não diz nada a quem abre depois.
 */
import assert from "node:assert/strict";
import test from "node:test";
import { createServer } from "vite";

test("o nome do arquivo carrega a tela de origem, sem acento", async () => {
  const server = await createServer({
    configFile: false,
    appType: "custom",
    server: { middlewareMode: true },
  });

  try {
    const { nomeDeArquivo } = await server.ssrLoadModule(
      "/app/lib/spreadsheet.ts",
    );

    /*
     * Acento no nome de arquivo chega quebrado em quem não trata UTF-8 —
     * anexo de e-mail, pasta compartilhada, outro sistema. O engenheiro que
     * recebe "Funcionc3a1rios.xlsx" não sabe se pode confiar no arquivo.
     */
    assert.equal(nomeDeArquivo("Cadastro de Funcionários"), "Cadastro_de_Funcionarios");
    assert.equal(nomeDeArquivo("Máquinas"), "Maquinas");
    assert.equal(nomeDeArquivo("Aluguéis"), "Alugueis");
    assert.equal(nomeDeArquivo("Fiscal e Compliance"), "Fiscal_e_Compliance");
    assert.equal(nomeDeArquivo("Execução da Obra"), "Execucao_da_Obra");
    assert.equal(nomeDeArquivo("Folga de Campo"), "Folga_de_Campo");

    /* Barra, ponto e parêntese quebrariam o download em alguns navegadores. */
    assert.equal(nomeDeArquivo("Contas a pagar / Fornecedores"), "Contas_a_pagar_Fornecedores");
    assert.doesNotMatch(nomeDeArquivo("Ocorrências (máquinas)"), /[()]/);

    /* Sem sublinhado sobrando nas pontas. */
    assert.doesNotMatch(nomeDeArquivo(" Máquinas "), /^_|_$/);
  } finally {
    await server.close();
  }
});

test("toda planilha nasce identificada pela tela de origem", async () => {
  const server = await createServer({
    configFile: false,
    appType: "custom",
    server: { middlewareMode: true },
  });

  try {
    const planilha = await server.ssrLoadModule("/app/lib/spreadsheet.ts");

    /* Modelo e exportação nomeiam pelo rótulo curto do módulo. */
    assert.match(
      planilha.exportImportTemplate.toString(),
      /Beta_Construtora_Modelo_\$\{nomeDeArquivo\(module\.shortLabel\)\}/,
    );
    assert.match(
      planilha.exportModuleWorkbook.toString(),
      /Beta_Construtora_\$\{nomeDeArquivo\(module\.shortLabel\)\}/,
    );
  } finally {
    await server.close();
  }
});
