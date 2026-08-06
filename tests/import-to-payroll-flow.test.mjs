/*
 * O caminho inteiro: modelo de planilha → importação → cálculo.
 *
 * Cada peça já tem teste próprio. Este cobre a emenda entre elas, que é
 * onde o defeito não aparece: o modelo pode gerar um cabeçalho bonito que
 * o próprio importador não reconhece, e a importação pode aceitar uma
 * linha que o motor de folha não consegue calcular. Nos dois casos nada
 * quebra — simplesmente não vem nada, e quem está preenchendo não
 * descobre por quê.
 */
import assert from "node:assert/strict";
import test from "node:test";
import { createServer } from "vite";

async function comServidor(executar) {
  const server = await createServer({
    configFile: false,
    appType: "custom",
    server: { middlewareMode: true },
  });
  try {
    return await executar(server);
  } finally {
    await server.close();
  }
}

test("o cabeçalho do modelo é reconhecido pelo próprio importador", async () => {
  /*
   * A emenda mais importante. O modelo escreve `field.label` no cabeçalho;
   * a importação casa colunas por `label` ou `aliases`, ambos passados por
   * `normalizeHeader`. Se alguma coluna do modelo não casar, ela é
   * ignorada em silêncio na volta — a planilha oficial do sistema seria
   * parcialmente descartada pelo sistema.
   */
  await comServidor(async (server) => {
    const { moduleMap, normalizeHeader, isInternalCodeField } =
      await server.ssrLoadModule("/app/lib/modules.ts");

    const people = moduleMap.people;
    const conhecidos = new Set();
    for (const campo of people.fields) {
      conhecidos.add(normalizeHeader(campo.label));
      for (const apelido of campo.aliases ?? []) {
        conhecidos.add(normalizeHeader(apelido));
      }
    }

    /* Exatamente as colunas que `exportImportTemplate` escreve. */
    const colunasDoModelo = people.fields
      .filter((campo) => !isInternalCodeField(people, campo.key))
      .map((campo) => campo.label);

    const orfas = colunasDoModelo.filter(
      (rotulo) => !conhecidos.has(normalizeHeader(rotulo)),
    );

    assert.deepEqual(
      orfas,
      [],
      `Colunas que o modelo escreve e o importador não reconhece: ${orfas.join(", ")}. ` +
        "Elas seriam descartadas em silêncio na importação.",
    );
    assert.ok(colunasDoModelo.length > 30, "O modelo ficou curto demais.");
  });
});

test("uma linha preenchida como o modelo pede chega a calcular a folha", async () => {
  /*
   * Não basta importar: o cadastro precisa alimentar o cálculo. Este teste
   * usa apenas os campos que o modelo marca como exigidos, para provar que
   * a lista destacada é suficiente — se faltasse algum, o contracheque
   * sairia zerado e a marcação estaria mentindo.
   */
  await comServidor(async (server) => {
    const { calculatePayroll } = await server.ssrLoadModule(
      "/app/lib/payroll.ts",
    );

    /* Só o que a planilha exige em verde. */
    const doCadastro = {
      name: "Colaboradora Importada",
      salary: 4200,
      monthlyHours: 220,
      admissionDate: "2024-03-11",
      status: "Ativo",
      role: "Pedreira",
      dependents: 2,
    };

    const resultado = calculatePayroll({
      employeeName: doCadastro.name,
      employeeCode: "IMP-001",
      role: doCadastro.role,
      workName: "Obra Teste",
      competence: "2026-08",
      baseSalary: doCadastro.salary,
      monthlyHours: doCadastro.monthlyHours,
      dependents: doCadastro.dependents,
      overtimeHours: 0,
      overtimePercent: 50,
      additionalType: "NONE",
      insalubrityDegree: 20,
      insalubrityBase: 0,
      taxableAdditions: 0,
      nonTaxableEarnings: 0,
      pensionDeduction: 0,
      salaryAdvance: 0,
      consignments: 0,
      unionContribution: 0,
      otherDeductions: 0,
      fgtsCategory: "STANDARD",
      employerInssPercent: 20,
      ratPercent: 2,
      fapFactor: 1,
      thirdPartiesPercent: 5.8,
      employerParameterSource: "ESTIMATE",
    });

    assert.equal(resultado.gross, 4200);
    assert.ok(resultado.inss > 0, "INSS não foi calculado.");
    assert.ok(
      resultado.net > 0 && resultado.net < resultado.gross,
      "Líquido precisa ser positivo e menor que o bruto.",
    );
    assert.ok(
      resultado.totalEmployerCost > resultado.gross,
      "O custo da empresa precisa superar o bruto: há encargos por cima.",
    );
    assert.ok(resultado.lines.length >= 8, "Faltaram verbas no contracheque.");
  });
});

test("as verbas exibidas têm código, e as medidas têm referência", async () => {
  /*
   * Fecha o ciclo até a tela: o que o motor devolve precisa preencher as
   * seis colunas do contracheque. Uma verba sem código deixaria buraco na
   * primeira coluna.
   */
  await comServidor(async (server) => {
    const { calculatePayroll } = await server.ssrLoadModule(
      "/app/lib/payroll.ts",
    );

    const { lines } = calculatePayroll({
      employeeName: "Teste", employeeCode: "T-1", role: "Cargo",
      workName: "Obra", competence: "2026-08", baseSalary: 4200,
      monthlyHours: 220, overtimeHours: 10, overtimePercent: 50,
      additionalType: "NONE", insalubrityDegree: 20, insalubrityBase: 0,
      taxableAdditions: 0, nonTaxableEarnings: 0, dependents: 0,
      pensionDeduction: 0, salaryAdvance: 0, consignments: 0,
      unionContribution: 0, otherDeductions: 0, fgtsCategory: "STANDARD",
      employerInssPercent: 20, ratPercent: 2, fapFactor: 1,
      thirdPartiesPercent: 5.8, employerParameterSource: "ESTIMATE",
    });

    for (const linha of lines) {
      assert.match(linha.code, /^\d+$/, `Verba sem código: ${linha.label}`);
      assert.ok(linha.label.trim(), `Verba sem nome: ${linha.code}`);
    }

    const salario = lines.find((l) => l.code === "10000");
    assert.equal(salario.reference, 220, "Salário deve referenciar as horas.");
    assert.equal(salario.referenceUnit, "h");

    const inss = lines.find((l) => l.code === "15000");
    assert.equal(inss.referenceUnit, "%");
    assert.ok(
      inss.reference > 0 && inss.reference < 14,
      `Alíquota efetiva fora da faixa possível: ${inss.reference}. Acima de ` +
        "14 indicaria que a progressão não foi aplicada.",
    );
  });
});
