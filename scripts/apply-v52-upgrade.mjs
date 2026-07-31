import fs from "node:fs";

const modulesPath = "app/lib/modules.ts";
const appPath = "app/components/BetaApp.tsx";
const apiPath = "app/api/records/route.ts";
const cssPath = "app/globals.css";

function fail(message) {
  throw new Error(`[v52] ${message}`);
}

function replaceOnce(source, search, replacement, label) {
  const index = source.indexOf(search);
  if (index < 0) fail(`Trecho não localizado: ${label}`);
  if (source.indexOf(search, index + search.length) >= 0) {
    fail(`Trecho duplicado, substituição insegura: ${label}`);
  }
  return source.slice(0, index) + replacement + source.slice(index + search.length);
}

function replaceRegex(source, expression, replacement, label) {
  if (!expression.test(source)) fail(`Expressão não localizada: ${label}`);
  expression.lastIndex = 0;
  return source.replace(expression, replacement);
}

function replaceModule(source, id, objectText) {
  const marker = `  {\n    id: "${id}",`;
  const start = source.indexOf(marker);
  if (start < 0) fail(`Módulo ${id} não localizado`);
  const next = source.indexOf(`\n  {\n    id: "`, start + marker.length);
  if (next < 0) fail(`Fim do módulo ${id} não localizado`);
  return source.slice(0, start) + objectText + source.slice(next);
}

let modules = fs.readFileSync(modulesPath, "utf8");

modules = replaceModule(modules, "expenses", `  {
    id: "expenses",
    label: "Central Financeira e Fornecedores",
    shortLabel: "Financeiro",
    eyebrow: "Financeiro • Fornecedores • Pagamentos",
    description:
      "Fornecedores, documentos fiscais, vencimentos, pagamentos e decisões gerenciais em uma única área.",
    color: "#17324d",
    lightColor: "#edf4f8",
    titleField: "description",
    referenceField: "accountId",
    statusField: "status",
    dateField: "dueDate",
    amountField: "expectedAmount",
    spreadsheetSheets: ["05_CONTAS_PAGAR"],
    tableColumns: ["supplier", "supplierDocument", "description", "dueDate", "expectedAmount", "status", "invoiceUrl"],
    fields: [
      { key: "accountId", label: "Código do lançamento", type: "text", required: true, help: "Criado automaticamente pelo sistema.", aliases: ["ID conta"] },
      { key: "supplier", label: "Fornecedor / estabelecimento", type: "text", required: true, aliases: ["Fornecedor"] },
      { key: "supplierDocument", label: "CPF ou CNPJ do fornecedor", type: "text", required: true, placeholder: "Documento do emissor da venda" },
      { key: "supplierCategory", label: "O que este fornecedor oferece", type: "text", placeholder: "Ex.: materiais, locação ou manutenção" },
      { key: "supplierContact", label: "Contato do fornecedor", type: "text", placeholder: "Telefone, e-mail ou responsável" },
      { key: "work", label: "Obra relacionada", type: "text", aliases: ["Obra"] },
      { key: "costCenter", label: "Centro de custo", type: "text", aliases: ["Centro de custo"] },
      { key: "category", label: "Categoria financeira", type: "text", placeholder: "Ex.: material, aluguel ou manutenção", aliases: ["Categoria"] },
      { key: "description", label: "O que será pago?", type: "text", required: true, placeholder: "Descreva o produto ou serviço", aliases: ["Descrição"] },
      { key: "issueDate", label: "Data do documento fiscal", type: "date", aliases: ["Emissão"] },
      { key: "dueDate", label: "Vencimento", type: "date", required: true, aliases: ["Vencimento"] },
      { key: "expectedAmount", label: "Valor a pagar", type: "currency", required: true, aliases: ["Valor previsto"] },
      { key: "approval", label: "Decisão da gerência", type: "select", options: ["Pendente", "Aprovada", "Rejeitada"], help: "A decisão pertence à gerência; o sistema apenas apresenta os documentos." },
      { key: "status", label: "Situação do pagamento", type: "select", required: true, options: statusFinanceiro, aliases: ["Status pagamento"] },
      { key: "paymentDate", label: "Data do pagamento", type: "date", aliases: ["Data pagamento"] },
      { key: "paidAmount", label: "Valor pago", type: "currency", aliases: ["Valor pago"] },
      { key: "invoiceUrl", label: "Nota fiscal, cupom fiscal ou recibo", type: "url", required: true, placeholder: "Cole o link do documento fiscal", help: "O lançamento não será salvo sem documento fiscal vinculado.", aliases: ["Link nota/fatura", "Link nota", "Documento fiscal"] },
      { key: "receiptUrl", label: "Comprovante de pagamento", type: "url", placeholder: "Cole o link do comprovante", aliases: ["Link comprovante"] },
      { key: "responsible", label: "Responsável pelo lançamento", type: "text", aliases: ["Responsável"] },
      { key: "notes", label: "Observações", type: "textarea", wide: true, aliases: ["Observações"] },
    ],
  },`);

modules = replaceModule(modules, "cards", `  {
    id: "cards",
    label: "Despesas de Cartão Corporativo",
    shortLabel: "Cartão Corporativo",
    eyebrow: "Financeiro • Conferência documental",
    description:
      "Compras por cartão, estabelecimento, valor, documento fiscal e itens identificados para aprovação.",
    color: "#7c3aed",
    lightColor: "#f5f3ff",
    titleField: "description",
    referenceField: "expenseId",
    statusField: "status",
    dateField: "date",
    amountField: "amount",
    spreadsheetSheets: ["06_CARTOES"],
    tableColumns: ["cardName", "date", "merchant", "merchantDocument", "description", "amount", "documentUrl", "status"],
    fields: [
      { key: "expenseId", label: "Código da despesa", type: "text", required: true, help: "Criado automaticamente pelo sistema.", aliases: ["ID despesa"] },
      { key: "cardName", label: "Nome do cartão", type: "text", required: true, placeholder: "Ex.: Cartão Obras 01" },
      { key: "date", label: "Data da compra", type: "date", required: true, aliases: ["Data"] },
      { key: "merchant", label: "Estabelecimento", type: "text", required: true, aliases: ["Estabelecimento"] },
      { key: "merchantDocument", label: "CPF ou CNPJ do estabelecimento", type: "text", required: true, placeholder: "Documento exibido na nota, cupom ou recibo" },
      { key: "description", label: "Produto ou serviço comprado", type: "text", required: true, aliases: ["Descrição"] },
      { key: "amount", label: "Valor", type: "currency", required: true, aliases: ["Valor"] },
      { key: "documentUrl", label: "Nota fiscal, cupom fiscal ou recibo", type: "url", required: true, placeholder: "Cole o link do documento", help: "Obrigatório para registrar a despesa e permitir a conferência dos produtos.", aliases: ["Link documento"] },
      { key: "extractedItems", label: "Itens identificados no documento", type: "textarea", wide: true, placeholder: "Confirme os produtos e quantidades exibidos no documento fiscal", help: "Campo preparado para leitura automática pelo futuro conector fiscal; até a ativação, confirme os itens durante o lançamento." },
      { key: "billingPeriod", label: "Mês da fatura", type: "date", aliases: ["Competência fatura"] },
      { key: "approval", label: "Decisão da gerência", type: "select", options: ["Pendente", "Aprovada", "Rejeitada"] },
      { key: "status", label: "Status", type: "select", required: true, options: ["Aguardando validação", "Aprovada", "Reprovada", "Paga"], aliases: ["Status"] },
      { key: "responsible", label: "Responsável pelo lançamento", type: "text", aliases: ["Responsável"] },
      { key: "notes", label: "Observações", type: "textarea", wide: true, aliases: ["Observações"] },
    ],
  },`);

modules = replaceModule(modules, "rentals", `  {
    id: "rentals",
    label: "Gestão de Imóveis e Aluguéis",
    shortLabel: "Aluguéis",
    eyebrow: "Administrativo • Moradia de colaboradores",
    description:
      "Endereço, moradores, validação do imóvel, proprietário ou empresa locadora e acesso direto ao contrato.",
    color: "#c2410c",
    lightColor: "#fff7ed",
    titleField: "address",
    referenceField: "propertyId",
    statusField: "status",
    dateField: "endDate",
    amountField: "totalMonthly",
    spreadsheetSheets: ["08_IMOVEIS"],
    tableColumns: ["address", "residentNames", "status", "landlord"],
    fields: [
      { key: "propertyId", label: "Código do imóvel", type: "text", required: true, help: "Criado automaticamente pelo sistema.", aliases: ["ID imóvel"] },
      { key: "address", label: "Endereço", type: "text", required: true, aliases: ["Endereço"] },
      { key: "city", label: "Cidade/UF", type: "text", aliases: ["Cidade/UF"] },
      { key: "residentNames", label: "Moradores", type: "textarea", required: true, wide: true, placeholder: "Informe um funcionário por linha", aliases: ["Moradores", "Quem mora"] },
      { key: "occupants", label: "Quantidade de moradores", type: "number", aliases: ["Ocupantes"] },
      { key: "status", label: "Status", type: "select", required: true, options: ["Ativo", "Inativo", "Aguardando validação"], aliases: ["Status"] },
      { key: "landlord", label: "Dono ou empresa locadora", type: "text", required: true, placeholder: "Proprietário, imobiliária ou empresa", aliases: ["Proprietário"] },
      { key: "landlordDocument", label: "CPF ou CNPJ do locador", type: "text", required: true },
      { key: "contractUrl", label: "Documento e contrato do aluguel", type: "url", required: true, placeholder: "Cole o link do contrato", aliases: ["Link contrato"] },
      { key: "contract", label: "Número do contrato", type: "text", aliases: ["Contrato"] },
      { key: "startDate", label: "Início do aluguel", type: "date", aliases: ["Início"] },
      { key: "endDate", label: "Fim do contrato", type: "date", aliases: ["Fim"] },
      { key: "monthlyRent", label: "Aluguel mensal", type: "currency", aliases: ["Aluguel mensal"] },
      { key: "water", label: "Custo mensal de água", type: "currency", aliases: ["Água"] },
      { key: "energy", label: "Custo mensal de energia", type: "currency", aliases: ["Energia"] },
      { key: "internet", label: "Custo mensal de internet", type: "currency", aliases: ["Internet"] },
      { key: "totalMonthly", label: "Total mensal", type: "currency", aliases: ["Total mensal"] },
      { key: "notes", label: "Observações", type: "textarea", wide: true, aliases: ["Observações"] },
    ],
  },`);

modules = replaceModule(modules, "food", `  {
    id: "food",
    label: "Controle de Alimentação",
    shortLabel: "Alimentação",
    eyebrow: "Operação • Retirada de refeições",
    description:
      "Quantidade retirada, funcionários que receberam a refeição, custo e documento fiscal do fornecedor.",
    color: "#15803d",
    lightColor: "#f0fdf4",
    titleField: "meal",
    referenceField: "entryId",
    statusField: "status",
    dateField: "date",
    amountField: "billedTotal",
    spreadsheetSheets: ["10_ALIMENTACAO"],
    tableColumns: ["date", "meal", "takenQty", "whoTook", "unitPrice", "billedTotal", "status"],
    fields: [
      { key: "entryId", label: "Código do registro", type: "text", required: true, help: "Criado automaticamente pelo sistema.", aliases: ["ID lançamento"] },
      { key: "date", label: "Data", type: "date", required: true, aliases: ["Data"] },
      { key: "supplier", label: "Fornecedor da alimentação", type: "text", required: true, aliases: ["Fornecedor"] },
      { key: "supplierDocument", label: "CPF ou CNPJ do fornecedor", type: "text", required: true },
      { key: "meal", label: "Refeição", type: "select", required: true, options: ["Café da manhã", "Almoço", "Jantar", "Lanche"], aliases: ["Refeição"] },
      { key: "takenQty", label: "Quantas refeições foram retiradas?", type: "number", required: true, aliases: ["Qtd. retirada"] },
      { key: "whoTook", label: "Funcionários que retiraram", type: "textarea", required: true, wide: true, placeholder: "Informe um funcionário por linha", aliases: ["Quem retirou", "Quem pegou"] },
      { key: "unitPrice", label: "Custo por refeição", type: "currency", aliases: ["Preço unitário"] },
      { key: "billedTotal", label: "Valor cobrado", type: "currency", required: true, aliases: ["Total faturado"] },
      { key: "status", label: "Status", type: "select", required: true, options: ["Aguardando validação", "Conferido", "Reprovado"], aliases: ["Status"] },
      { key: "invoiceUrl", label: "Nota fiscal, cupom fiscal ou recibo", type: "url", required: true, placeholder: "Cole o link do documento fiscal", aliases: ["Link nota"] },
      { key: "responsible", label: "Responsável pelo registro", type: "text", aliases: ["Responsável"] },
      { key: "notes", label: "Observações", type: "textarea", wide: true, aliases: ["Observações"] },
    ],
  },`);

modules = replaceModule(modules, "purchases", `  {
    id: "purchases",
    label: "Central Estratégica de Compras",
    shortLabel: "Compras",
    eyebrow: "Suprimentos • Cotação • Decisão",
    description:
      "Necessidade, prioridade, cotações, fornecedor, prazo, valor e documentos organizados para decisão da gerência.",
    color: "#0369a1",
    lightColor: "#f0f9ff",
    titleField: "material",
    referenceField: "requestId",
    statusField: "status",
    dateField: "requestDate",
    amountField: "totalAmount",
    spreadsheetSheets: ["07_COMPRAS"],
    tableColumns: ["requestDate", "priority", "work", "material", "quantity", "supplier", "totalAmount", "status", "documentsUrl"],
    fields: [
      { key: "requestId", label: "Código da solicitação", type: "text", required: true, help: "Criado automaticamente pelo sistema.", aliases: ["ID solicitação"] },
      { key: "requestDate", label: "Data da solicitação", type: "date", required: true, aliases: ["Data"] },
      { key: "work", label: "Obra / área solicitante", type: "text", aliases: ["Obra"] },
      { key: "requester", label: "Solicitante", type: "text", required: true, aliases: ["Solicitante"] },
      { key: "material", label: "Material ou serviço necessário", type: "text", required: true, placeholder: "Ex.: 50 sacos de cimento CP-II", aliases: ["Material/serviço"] },
      { key: "category", label: "Categoria da compra", type: "text", placeholder: "Ex.: estrutura, elétrica, segurança ou manutenção" },
      { key: "quantity", label: "Quantidade", type: "number", required: true, aliases: ["Quantidade"] },
      { key: "unit", label: "Unidade de medida", type: "text", placeholder: "Ex.: unidade, metro, kg ou saco", aliases: ["Unidade"] },
      { key: "neededDate", label: "Data necessária", type: "date", aliases: ["Data necessária"] },
      { key: "priority", label: "Prioridade", type: "select", required: true, options: ["Baixa", "Média", "Alta", "Urgente"], aliases: ["Prioridade"] },
      { key: "justification", label: "Justificativa e impacto da compra", type: "textarea", required: true, wide: true, placeholder: "Explique por que a compra é necessária e o impacto de não realizar." },
      { key: "quotesReceived", label: "Cotações recebidas", type: "number", aliases: ["Cotações recebidas"] },
      { key: "supplier", label: "Fornecedor selecionado", type: "text", aliases: ["Fornecedor"] },
      { key: "supplierDocument", label: "CPF ou CNPJ do fornecedor", type: "text" },
      { key: "selectedQuote", label: "Critério da escolha", type: "textarea", wide: true, placeholder: "Preço, prazo, qualidade, disponibilidade e condição de pagamento" },
      { key: "totalAmount", label: "Valor total estimado", type: "currency", aliases: ["Valor total"] },
      { key: "documentsUrl", label: "Cotações e documentos da compra", type: "url", required: true, placeholder: "Cole o link da pasta ou documento", aliases: ["Link documentos"] },
      { key: "status", label: "Status", type: "select", required: true, options: ["Aguardando análise", "Aprovado", "Reprovado"], aliases: ["Status"] },
      { key: "notes", label: "Observações", type: "textarea", wide: true, aliases: ["Observações"] },
    ],
  },`);

modules = replaceOnce(
  modules,
  '    label: "Cadastro de Funcionários",\n    shortLabel: "Cadastro de Funcionários",\n    eyebrow: "RH",\n    description:\n      "Ficha profissional, vínculo, jornada, custos mensais, admissões e desligamentos.",',
  '    label: "Administrativo e Pessoas",\n    shortLabel: "Administrativo",\n    eyebrow: "Administrativo • Pessoas • RH",\n    description:\n      "Funcionários, vínculos, jornadas, documentos, custos mensais e atalhos operacionais da empresa.",',
  "renomear Pessoas para Administrativo",
);

modules = replaceOnce(
  modules,
  '      { key: "maintenanceSupplier", label: "Oficina / fornecedor da manutenção", type: "text" },\n      { key: "maintenanceCost", label: "Custo total da manutenção", type: "currency", help: "Informe mão de obra, peças e demais custos do serviço." },',
  '      { key: "maintenanceSupplier", label: "Oficina / fornecedor da manutenção", type: "text" },\n      { key: "maintenanceSupplierDocument", label: "CPF ou CNPJ da oficina / fornecedor", type: "text" },\n      { key: "maintenanceCost", label: "Custo total da manutenção", type: "currency", help: "Informe mão de obra, peças e demais custos do serviço." },',
  "documento da oficina",
);

modules = replaceOnce(
  modules,
  '      { key: "documentUrl", label: "Orçamento, nota ou ordem de serviço", type: "url", placeholder: "Cole o link do documento" },',
  '      { key: "documentUrl", label: "Nota fiscal, recibo ou ordem de serviço", type: "url", placeholder: "Cole o link do documento fiscal" },',
  "documento de manutenção",
);

modules = replaceRegex(
  modules,
  /export const navigationGroups = \[[\s\S]*?\n\];/,
  `export const navigationGroups = [
  { label: "PAINEL EXECUTIVO", items: ["dashboard"] },
  { label: "FINANCEIRO E SUPRIMENTOS", items: ["expenses", "cards", "purchases"] },
  { label: "ENGENHARIA E EQUIPAMENTOS", items: ["works", "worklogs", "assets"] },
  { label: "ADMINISTRATIVO E RH", items: ["people", "payroll", "terminations"] },
  { label: "FISCAL E CONFORMIDADE", items: ["compliance", "rules", "taxes"] },
  { label: "OPERAÇÃO E DOCUMENTOS", items: ["rentals", "food", "documents"] },
  { label: "INTEGRAÇÕES MICROSOFT 365", items: ["emails", "m365"] },
];`,
  "grupos de navegação",
);

modules = replaceOnce(
  modules,
  '  expenses:\n    "Comece pelo fornecedor, pelo que será pago e pelo vencimento. Anexe a nota fiscal quando ela estiver disponível.",',
  '  expenses:\n    "Cadastre fornecedor, CPF ou CNPJ, vencimento, valor e documento fiscal. Sem nota, cupom ou recibo, o lançamento não é aceito.",',
  "dica financeiro",
);
modules = replaceOnce(
  modules,
  '  rentals:\n    "Informe quem mora no imóvel e para quem cada conta deve ser paga. Isso evita dúvidas no fechamento do mês.",',
  '  rentals:\n    "Registre o endereço, os funcionários moradores, o status de validação e o proprietário ou empresa. O nome do locador abre o contrato vinculado.",',
  "dica aluguéis",
);
modules = replaceOnce(
  modules,
  '  food:\n    "Compare pessoas previstas, refeições entregues e retiradas para identificar desperdícios ou faltas.",',
  '  food:\n    "Registre somente as refeições retiradas e os nomes dos funcionários que receberam. Documento fiscal e CPF ou CNPJ do fornecedor são obrigatórios.",',
  "dica alimentação",
);
modules = replaceOnce(
  modules,
  '  purchases:\n    "Descreva claramente o material, a quantidade, a obra e a data necessária antes de iniciar as cotações.",',
  '  purchases:\n    "Explique a necessidade, o impacto, a prioridade, as cotações e o critério da escolha. A gerência decide com base nos documentos apresentados.",',
  "dica compras",
);

fs.writeFileSync(modulesPath, modules);

let app = fs.readFileSync(appPath, "utf8");

app = replaceOnce(
  app,
  'type ManagementQueue = "validation" | "rejected" | "missing";',
  'type ManagementQueue = "validation" | "rejected";',
  "filas gerenciais",
);
app = replaceOnce(
  app,
  'const managementModules = new Set([\n  "purchases",\n  "expenses",\n  "cards",\n]);',
  'const managementModules = new Set([\n  "purchases",\n  "expenses",\n  "cards",\n  "rentals",\n]);',
  "aluguéis na decisão gerencial",
);
app = replaceOnce(
  app,
  '  if (record.module === "cards") {\n    return (\n      approval === "pendente" &&\n      ["pendente", "documento pendente", "em analise"].includes(status)\n    );\n  }',
  '  if (record.module === "cards") {\n    return (\n      approval === "pendente" ||\n      ["aguardando validacao", "em analise"].includes(status)\n    );\n  }\n  if (record.module === "rentals") {\n    return status === "aguardando validacao";\n  }',
  "status prontos para gerência",
);
app = replaceOnce(
  app,
  '  if (record.module === "cards") {\n    return {\n      label: "Nota fiscal ou recibo",\n      value: record.payload.documentUrl,\n    };\n  }\n  return {',
  '  if (record.module === "cards") {\n    return {\n      label: "Nota fiscal, cupom fiscal ou recibo",\n      value: record.payload.documentUrl,\n    };\n  }\n  if (record.module === "rentals") {\n    return {\n      label: "Documento e contrato do aluguel",\n      value: record.payload.contractUrl,\n    };\n  }\n  return {',
  "documento dos aluguéis",
);
app = replaceOnce(
  app,
  '      record.payload.holder ||\n      record.payload.companyName ||',
  '      record.payload.cardName ||\n      record.payload.landlord ||\n      record.payload.companyName ||',
  "responsável da solicitação",
);
app = replaceOnce(
  app,
  '  if (record.module === "purchases") return "Aprovado";\n  return "Aprovada";',
  '  if (record.module === "purchases") return "Aprovado";\n  if (record.module === "rentals") return "Ativo";\n  return "Aprovada";',
  "status aprovado aluguel",
);
app = replaceOnce(
  app,
  '  if (record.module === "purchases") return "Reprovado";\n  return "Reprovada";',
  '  if (record.module === "purchases") return "Reprovado";\n  if (record.module === "rentals") return "Inativo";\n  return "Reprovada";',
  "status reprovado aluguel",
);

app = replaceOnce(
  app,
  '    if (missing) {\n      setError(\n        `Só falta preencher “${missing.label}”. Os campos com * são necessários para salvar.`,\n      );\n      return;\n    }\n    await onSave(payload);',
  `    if (missing) {
      setError(
        \`Só falta preencher “\${missing.label}”. Os campos com * são necessários para salvar.\`,
      );
      return;
    }
    const fiscalEvidenceByModule: Record<string, string> = {
      expenses: "invoiceUrl",
      cards: "documentUrl",
      food: "invoiceUrl",
      asset_events: "documentUrl",
      taxes: "guideUrl",
    };
    const partyDocumentByModule: Record<string, string> = {
      expenses: "supplierDocument",
      cards: "merchantDocument",
      food: "supplierDocument",
      asset_events: "maintenanceSupplierDocument",
    };
    const amount = amountForPayload(module, payload);
    const evidenceKey = fiscalEvidenceByModule[module.id];
    if (amount > 0 && evidenceKey && !String(payload[evidenceKey] || "").trim()) {
      setError("Não é permitido lançar um custo sem nota fiscal, cupom fiscal, recibo, guia ou documento equivalente.");
      return;
    }
    const partyKey = partyDocumentByModule[module.id];
    if (amount > 0 && partyKey && !String(payload[partyKey] || "").trim()) {
      setError("Informe o CPF ou CNPJ do estabelecimento ou fornecedor responsável pelo documento.");
      return;
    }
    await onSave(payload);`,
  "validação fiscal no formulário",
);

app = replaceOnce(
  app,
  '            <p>\n              Síntese ponderada de avanço, prazo, equipe própria, máquinas,\n              horas produtivas e orçamento. Não substitui o avanço físico.\n            </p>',
  '            <p>\n              Este número não é a porcentagem concluída da obra. É uma nota gerencial que combina avanço frente ao plano, prazo, equipe própria, máquinas, horas produtivas e saúde do orçamento.\n            </p>',
  "explicação do índice geral",
);
app = replaceOnce(
  app,
  '              <div className="construction-overall-factors">\n                {overallFactors.map((factor) => (\n                  <span key={factor.label}>\n                    <i>{factor.label}</i>\n                    <em>{decimalNumber(factor.score)}%</em>\n                  </span>\n                ))}\n              </div>',
  '              <div className="construction-overall-factors">\n                {overallFactors.map((factor) => (\n                  <span key={factor.label}>\n                    <i>{factor.label}</i>\n                    <em>{decimalNumber(factor.score)}% • peso {factor.weight}%</em>\n                  </span>\n                ))}\n              </div>\n              <div className="construction-index-explanation">\n                <strong>Como interpretar</strong>\n                <p>Quanto mais próximo de 100%, melhor o equilíbrio geral. Um índice alto não compensa atraso físico: consulte sempre o avanço total da obra logo acima.</p>\n              </div>',
  "detalhamento dos pesos do índice",
);

app = replaceRegex(
  app,
  /  const trackedCommitments = paidFinance \+ payable;\n  const paidCommitmentShare =[\s\S]*?\n      : 0;\n/,
  "",
  "remover cálculo execução compromissos",
);
app = replaceRegex(
  app,
  /            <div className="cost-monitor-progress">[\s\S]*?            <\/div>\n          <\/section>/,
  "          </section>",
  "remover execução compromissos financeiros",
);

const quickStart = app.indexOf('      <section className="content-card quick-card action-center">');
const managementStart = app.indexOf('      <section className="management-center content-card">', quickStart);
if (quickStart < 0 || managementStart < 0) fail("Bloco de ações rápidas do painel não localizado");
app = app.slice(0, quickStart) + app.slice(managementStart);

app = replaceRegex(
  app,
  /        <section className="management-training">[\s\S]*?        <\/section>\n/,
  "",
  "remover relatórios fictícios de análise",
);
app = replaceRegex(
  app,
  /  const missingRequestRecords = readyManagementRequests\.filter\([\s\S]*?\n  \);\n/,
  "",
  "remover fila de documentos ausentes",
);
app = replaceRegex(
  app,
  /  const decisionExamples = \[[\s\S]*?\n  \] as const;\n/,
  "",
  "remover exemplos gerenciais",
);
app = replaceOnce(
  app,
  '  const managementRecords = (\n    managementFocus === "validation"\n      ? validationRequestRecords\n      : managementFocus === "rejected"\n        ? rejectedRequestRecords\n        : missingRequestRecords\n  )',
  '  const managementRecords = (\n    managementFocus === "rejected"\n      ? rejectedRequestRecords\n      : validationRequestRecords\n  )',
  "seleção da fila gerencial",
);
app = replaceOnce(
  app,
  '    ["cards", "Cartões corporativos"],\n  ];',
  '    ["cards", "Cartões corporativos"],\n    ["rentals", "Aluguéis"],\n  ];',
  "filtro aluguéis gerência",
);
app = replaceOnce(
  app,
  '            <h2>Pedidos para decisão da gerência</h2>\n            <p>\n              Fila única de compras, pagamentos e cartões. Abra um pedido para\n              conferir necessidade, valor, responsável e documentos antes de\n              aprovar ou reprovar com justificativa.\n            </p>',
  '            <h2>Documentos para decisão da gerência</h2>\n            <p>\n              A tela apresenta compras, pagamentos, cartões e aluguéis já documentados. O sistema não recomenda a decisão: a gerência confere e escolhe aprovar ou reprovar.\n            </p>',
  "texto da central gerencial",
);
app = replaceRegex(
  app,
  /          <article className="missing">[\s\S]*?          <\/article>\n/,
  "",
  "cartão documentos ausentes",
);
app = replaceRegex(
  app,
  /          <button\n            className=\{managementFocus === "missing"[\s\S]*?          <\/button>\n/,
  "",
  "aba ausentes",
);
app = replaceOnce(
  app,
  '            const missingDocument = requiredRequestDocument(record);\n            const queueLabel =\n              managementFocus === "validation"\n                ? "Pronto para decisão"\n                : managementFocus === "rejected"\n                  ? "Reprovado"\n                  : "Documento ausente";\n            const queueTone =\n              managementFocus === "validation"\n                ? "warning"\n                : managementFocus === "rejected"\n                  ? "danger"\n                  : "neutral";',
  '            const queueLabel =\n              managementFocus === "validation"\n                ? "Pronto para decisão"\n                : "Reprovado";\n            const queueTone =\n              managementFocus === "validation"\n                ? "warning"\n                : "danger";',
  "rótulos da fila",
);
app = replaceOnce(
  app,
  '                  ) : managementFocus === "missing" ? (\n                    <em>Falta: {missingDocument.label}</em>\n                  ) : (',
  '                  ) : (',
  "detalhe documento ausente",
);
app = replaceOnce(
  app,
  '                name={managementFocus === "rejected" ? "history" : "check"}',
  '                name={managementFocus === "rejected" ? "history" : "check"}',
  "ícone vazio gerencial",
);

app = replaceRegex(
  app,
  /            \{!hasRequiredDocument \? \([\s\S]*?            \) : null\}\n/,
  "",
  "aviso documento ausente nos detalhes",
);
app = replaceOnce(
  app,
  '                    : hasRequiredDocument\n                    ? "Pronto para decisão"\n                    : "Documento ausente"}',
  '                    : "Pronto para decisão"}',
  "estado da decisão",
);
app = replaceOnce(
  app,
  '                    disabled={!hasRequiredDocument || decisionSaving}',
  '                    disabled={decisionSaving}',
  "botão aprovar documentado",
);
app = replaceOnce(
  app,
  '              <div className={hasRequiredDocument ? "ready" : "missing"}>\n                <span>Documento obrigatório</span>\n                {hasRequiredDocument ? (',
  '              <div className="ready">\n                <span>Documento apresentado</span>\n                {hasRequiredDocument ? (',
  "documento apresentado",
);
app = replaceOnce(
  app,
  '              </div>\n            </div>\n\n            {decisionState === "rejected"',
  '              </div>\n              <div>\n                <span>CPF/CNPJ do emissor</span>\n                <strong>{String(record.payload.supplierDocument || record.payload.merchantDocument || record.payload.landlordDocument || "Conferir no documento")}</strong>\n              </div>\n            </div>\n\n            {decisionState === "rejected"',
  "CPF CNPJ na decisão",
);

const adminComponents = `
function FinancialOperationsPanel({
  records,
  onNew,
  onOpen,
}: {
  records: StoredRecord[];
  onNew: (moduleId: string) => void;
  onOpen: (record: StoredRecord) => void;
}) {
  const suppliers = records.filter((record) => record.module === "suppliers");
  const expenses = records.filter((record) => record.module === "expenses");
  const awaiting = expenses.filter((record) => requestDecisionState(record) === "pending");
  const approved = expenses.filter((record) => requestDecisionState(record) === "approved");
  const totalOpen = expenses
    .filter((record) => !["Pago", "Cancelado", "Reprovado"].includes(record.status))
    .reduce((sum, record) => sum + Math.max(0, Number(record.amount || 0)), 0);
  return (
    <section className="module-executive-hub financial-operations-hub">
      <header>
        <div>
          <span className="eyebrow">CENTRAL FINANCEIRA INTEGRADA</span>
          <h2>Pagamentos e fornecedores no mesmo fluxo</h2>
          <p>Consulte o fornecedor, o documento fiscal, a aprovação, o vencimento e o pagamento sem alternar entre telas redundantes.</p>
        </div>
        <div>
          <button className="button secondary" onClick={() => onNew("suppliers")}><Icon name="suppliers" size={17} /> Novo fornecedor</button>
          <button className="button primary" onClick={() => onNew("expenses")}><Icon name="plus" size={17} /> Novo pagamento</button>
        </div>
      </header>
      <div className="executive-hub-kpis">
        <article><small>FORNECEDORES CADASTRADOS</small><strong>{suppliers.length}</strong><span>base integrada</span></article>
        <article className="warning"><small>AGUARDANDO GERÊNCIA</small><strong>{awaiting.length}</strong><span>documentos para decisão</span></article>
        <article className="success"><small>APROVADOS</small><strong>{approved.length}</strong><span>decisões registradas</span></article>
        <article className="primary"><small>EM ABERTO</small><strong>{compactCurrency.format(totalOpen)}</strong><span>obrigações não quitadas</span></article>
      </div>
      <div className="supplier-directory-inline">
        <header><strong>Fornecedores recentes</strong><small>Clique para abrir documentos e cadastro</small></header>
        <div>
          {suppliers.slice(0, 6).map((supplier) => (
            <button key={supplier.id} onClick={() => onOpen(supplier)}>
              <span><Icon name="suppliers" size={17} /></span>
              <div><strong>{supplier.title}</strong><small>{String(supplier.payload.cnpj || supplier.payload.category || "Documento a conferir")}</small></div>
              <span className={\`status-pill \${statusTone(supplier.status)}\`}>{supplier.status}</span>
              <Icon name="arrow" size={14} />
            </button>
          ))}
          {!suppliers.length ? <p>Nenhum fornecedor cadastrado. Use “Novo fornecedor” para iniciar a base.</p> : null}
        </div>
      </div>
    </section>
  );
}

function AdministrativeQuickActions({
  onNew,
  onNavigate,
  onImport,
  canEdit,
  settings,
}: {
  onNew: (moduleId: string) => void;
  onNavigate: (view: string) => void;
  onImport: () => void;
  canEdit: boolean;
  settings: SystemSettings;
}) {
  return (
    <section className="content-card quick-card action-center administrative-actions">
      <header className="action-center-header">
        <div className="action-center-title">
          <span className="eyebrow">CENTRAL ADMINISTRATIVA</span>
          <h1>Ações rápidas</h1>
          <p>{settings.welcomeMessage}</p>
        </div>
        <div className="action-center-buttons">
          {canEdit ? (
            <>
              <button className="button primary" onClick={() => onNew("people")}><Icon name="plus" size={18} /> Novo funcionário</button>
              <button className="button secondary" onClick={onImport}><Icon name="upload" size={18} /> Importar planilha</button>
            </>
          ) : <span className="read-only-chip"><Icon name="eye" size={16} /> Modo de consulta</span>}
        </div>
      </header>
      <div className="quick-section-label">
        <div><span className="eyebrow">ATALHOS POR PROCESSO</span><strong>Operações mais utilizadas pela equipe</strong></div>
      </div>
      <div className="quick-grid">
        {[
          ["people", "Cadastrar funcionário", "Ficha, documentos e vínculo"],
          ["expenses", "Lançar pagamento", "Fornecedor, documento e vencimento"],
          ["cards", "Registrar cartão", "Compra com documento fiscal"],
          ["purchases", "Solicitar compra", "Necessidade, cotação e prioridade"],
          ["rentals", "Cadastrar aluguel", "Moradores, locador e contrato"],
          ["food", "Registrar alimentação", "Refeições retiradas e funcionários"],
          ["worklogs", "Registrar diário", "Produção e ocorrências da obra"],
          ["asset_events", "Máquina parada", "Manutenção, causa e impacto"],
        ].map(([id, title, detail]) => (
          <button key={id} onClick={() => canEdit ? onNew(id) : onNavigate(id === "asset_events" ? "assets" : id)}>
            <span className="quick-icon" style={{ color: moduleMap[id].color, background: moduleMap[id].lightColor }}><Icon name={id} /></span>
            <span><strong>{title}</strong><small>{detail}</small></span>
            <Icon name="arrow" size={17} />
          </button>
        ))}
      </div>
    </section>
  );
}

`;
app = replaceOnce(app, "function ModulePage({", `${adminComponents}function ModulePage({`, "painéis integrados");

app = replaceOnce(
  app,
  '  const hasAmount = Boolean(module.amountField);\n  const tableColumns = module.tableColumns.filter(',
  '  const hasAmount = Boolean(module.amountField);\n  const evidenceKeyByModule: Record<string, string> = { expenses: "invoiceUrl", cards: "documentUrl", purchases: "documentsUrl", rentals: "contractUrl", food: "invoiceUrl" };\n  const evidenceKey = evidenceKeyByModule[module.id];\n  const documentedCount = evidenceKey ? records.filter((record) => String(record.payload[evidenceKey] || "").trim()).length : records.length;\n  const approvedCount = records.filter((record) => requestDecisionState(record) === "approved" || normalizedWorkflowText(record.status).includes("conferid")).length;\n  const tableColumns = module.tableColumns.filter(',
  "métricas executivas do módulo",
);
app = replaceOnce(
  app,
  '    <div className="page-stack">\n      <section className="module-heading">',
  '    <div className={`page-stack module-page module-${module.id}`}>\n      <section className="module-heading">',
  "classe específica do módulo",
);
app = replaceOnce(
  app,
  '      <section className="mini-kpis">',
  '      {["purchases", "cards", "rentals", "food", "expenses"].includes(module.id) ? (\n        <section className="module-insight-strip">\n          <div><span className="eyebrow">VISÃO EXECUTIVA DA ÁREA</span><h2>Controle, documentação e decisão em um só lugar</h2><p>Os indicadores abaixo mostram volume, pendências, documentação vinculada e valor acompanhado.</p></div>\n          <div className="module-insight-kpis">\n            <article><small>REGISTROS</small><strong>{records.length}</strong><span>itens acompanhados</span></article>\n            <article className="warning"><small>PENDÊNCIAS</small><strong>{open}</strong><span>exigem conferência</span></article>\n            <article className="success"><small>DOCUMENTADOS</small><strong>{documentedCount}</strong><span>com evidência vinculada</span></article>\n            <article className="primary"><small>APROVADOS / CONFERIDOS</small><strong>{approvedCount}</strong><span>decisões concluídas</span></article>\n          </div>\n        </section>\n      ) : null}\n\n      <section className="mini-kpis">',
  "faixa executiva dos módulos",
);

app = replaceOnce(
  app,
  '                    if (field?.type === "url") {',
  `                    if (["residentNames", "whoTook"].includes(key)) {
                      const names = String(value || "").split(/\\n|,|;/).map((name) => name.trim()).filter(Boolean);
                      return (
                        <td key={key}>
                          <button
                            type="button"
                            className="inline-detail-button"
                            onClick={(event) => { event.stopPropagation(); onOpen(record); }}
                            title={names.join(" • ")}
                          >
                            <Icon name="people" size={15} />
                            {names.length || Number(record.payload.occupants || record.payload.takenQty || 0)} {module.id === "rentals" ? "morador(es)" : "funcionário(s)"}
                          </button>
                        </td>
                      );
                    }
                    if (module.id === "rentals" && key === "landlord") {
                      const contractUrl = String(record.payload.contractUrl || "");
                      return (
                        <td key={key}>
                          {contractUrl ? (
                            <a className="document-link landlord-contract-link" href={contractUrl} target="_blank" rel="noreferrer" onClick={(event) => event.stopPropagation()}>
                              <Icon name="link" size={15} /> {String(value || "Abrir contrato")}
                            </a>
                          ) : String(value || "—")}
                        </td>
                      );
                    }
                    if (field?.type === "url") {`,
  "detalhes clicáveis moradores e refeições",
);

app = replaceOnce(
  app,
  '  onImport,\n  onOpenRecord,\n  onOpenApprovalRecord,\n  settings,\n  canEdit,',
  '  onOpenRecord,\n  onOpenApprovalRecord,\n  canEdit,',
  "props do dashboard",
);
app = replaceOnce(
  app,
  '  onImport: () => void;\n  onOpenRecord: (record: StoredRecord) => void;\n  onOpenApprovalRecord: (record: StoredRecord) => void;\n  settings: SystemSettings;\n  canEdit: boolean;',
  '  onOpenRecord: (record: StoredRecord) => void;\n  onOpenApprovalRecord: (record: StoredRecord) => void;\n  canEdit: boolean;',
  "tipos do dashboard",
);
app = replaceOnce(
  app,
  '              onNew={openNew}\n              onImport={() => requestImport()}\n              onOpenRecord={openRecord}\n              onOpenApprovalRecord={openApprovalRecord}\n              settings={settings}\n              canEdit={isAdmin}',
  '              onNew={openNew}\n              onOpenRecord={openRecord}\n              onOpenApprovalRecord={openApprovalRecord}\n              canEdit={isAdmin}',
  "chamada dashboard",
);

app = replaceOnce(
  app,
  '              {activeView === "assets" ? (\n                <MachineExecutivePanel',
  '              {activeView === "expenses" ? (\n                <FinancialOperationsPanel records={operationalRecords} onNew={openNew} onOpen={openRecord} />\n              ) : null}\n              {activeView === "people" ? (\n                <AdministrativeQuickActions onNew={openNew} onNavigate={navigate} onImport={() => requestImport()} canEdit={isAdmin} settings={settings} />\n              ) : null}\n              {activeView === "assets" ? (\n                <MachineExecutivePanel',
  "renderizar hubs integrados",
);

app = replaceOnce(
  app,
  '                    ? "Central operacional"',
  '                    ? "Visão Executiva Geral"',
  "título visão geral",
);

fs.writeFileSync(appPath, app);

let api = fs.readFileSync(apiPath, "utf8");
api = replaceOnce(
  api,
  'function errorResponse(error: unknown) {',
  `function validateRequiredEvidence(record: Record<string, unknown>) {
  const moduleId = String(record.module || "");
  const payload = (record.payload || {}) as Record<string, unknown>;
  const amount = Math.max(0, Number(record.amount || 0));
  const evidenceByModule: Record<string, string> = {
    expenses: "invoiceUrl",
    cards: "documentUrl",
    food: "invoiceUrl",
    asset_events: "documentUrl",
    taxes: "guideUrl",
    rentals: "contractUrl",
    purchases: "documentsUrl",
  };
  const partyDocumentByModule: Record<string, string> = {
    expenses: "supplierDocument",
    cards: "merchantDocument",
    food: "supplierDocument",
    asset_events: "maintenanceSupplierDocument",
    rentals: "landlordDocument",
  };
  const evidenceKey = evidenceByModule[moduleId];
  const evidenceIsRequired = amount > 0 || ["rentals", "purchases"].includes(moduleId);
  if (evidenceIsRequired && evidenceKey && !String(payload[evidenceKey] || "").trim()) {
    throw new Error("Lançamento bloqueado: vincule nota fiscal, cupom fiscal, recibo, guia, cotação ou contrato obrigatório.");
  }
  const partyKey = partyDocumentByModule[moduleId];
  if (amount > 0 && partyKey && !String(payload[partyKey] || "").trim()) {
    throw new Error("Lançamento bloqueado: informe o CPF ou CNPJ do fornecedor, estabelecimento ou locador.");
  }
}

function errorResponse(error: unknown) {`,
  "validação da API",
);
api = replaceOnce(
  api,
  '    if (Array.isArray(payload.records)) {\n      return Response.json(',
  '    if (Array.isArray(payload.records)) {\n      payload.records.forEach(validateRequiredEvidence);\n      return Response.json(',
  "validar importação",
);
api = replaceOnce(
  api,
  '    return Response.json(\n      {\n        record: await createRecord(\n          payload.record || payload,',
  '    validateRequiredEvidence(payload.record || payload);\n    return Response.json(\n      {\n        record: await createRecord(\n          payload.record || payload,',
  "validar criação",
);
api = replaceOnce(
  api,
  '    return Response.json({\n      record: await updateRecord(\n        payload.id,\n        payload.record || payload,',
  '    validateRequiredEvidence(payload.record || payload);\n    return Response.json({\n      record: await updateRecord(\n        payload.id,\n        payload.record || payload,',
  "validar atualização",
);
fs.writeFileSync(apiPath, api);

const cssMarker = "/* V52 EXECUTIVE SYSTEM UPGRADE */";
let css = fs.readFileSync(cssPath, "utf8");
if (!css.includes(cssMarker)) {
  css += `

${cssMarker}
html { font-size: 16px; }
body { font-size: 15px; line-height: 1.5; }
.page-area { font-size: 0.95rem; }
.page-area p { font-size: 0.92rem !important; line-height: 1.62 !important; }
.page-area small { font-size: 0.78rem !important; line-height: 1.45 !important; }
.page-area label > span, .form-field > span { font-size: 0.84rem !important; font-weight: 720 !important; }
.page-area input, .page-area select, .page-area textarea, .page-area button { font-size: 0.86rem; }
.module-heading {
  min-height: 132px;
  padding: 26px 28px !important;
  border: 1px solid #d6e3e9 !important;
  border-radius: 22px !important;
  background: radial-gradient(circle at 92% 10%, rgba(37,99,235,.10), transparent 34%), linear-gradient(135deg,#ffffff,#f4f8fa) !important;
  box-shadow: 0 18px 48px rgba(21,49,67,.09) !important;
}
.module-heading h1 { margin-top: 4px !important; font-size: clamp(1.75rem,2.4vw,2.35rem) !important; letter-spacing: -.035em; }
.module-heading p { max-width: 880px; color: #5c707d !important; }
.module-big-icon { width: 58px !important; height: 58px !important; border-radius: 16px !important; }
.eyebrow { font-size: .72rem !important; letter-spacing: .105em !important; font-weight: 820 !important; }
.nav-group > span { margin-top: 15px !important; color: #9eb2bf !important; font-size: .72rem !important; letter-spacing: .09em !important; font-weight: 850 !important; }
.sidebar nav button { min-height: 45px; font-size: .88rem !important; }
.sidebar nav button > span { font-size: .88rem !important; }
.topbar-left strong { font-size: 1.02rem !important; }
.table-card { border-radius: 20px !important; box-shadow: 0 16px 42px rgba(20,47,63,.07) !important; }
.table-toolbar { padding: 16px 18px !important; background: linear-gradient(180deg,#fff,#f8fafb); }
.table-wrap th { padding: 13px 14px !important; font-size: .73rem !important; letter-spacing: .045em; }
.table-wrap td { padding: 14px !important; font-size: .86rem !important; }
.table-wrap tbody tr:hover { background: #f2f7f9 !important; transform: translateY(-1px); }
.mini-kpis { gap: 14px !important; }
.mini-kpis article { min-height: 104px; padding: 19px !important; border-radius: 17px !important; box-shadow: 0 10px 30px rgba(20,47,63,.05); }
.mini-kpis strong { font-size: 1.65rem !important; }
.module-guide { padding: 16px 18px !important; border-radius: 16px !important; }
.module-insight-strip, .module-executive-hub {
  padding: 24px;
  border: 1px solid #d8e5ea;
  border-radius: 22px;
  background: radial-gradient(circle at 96% 0,rgba(14,116,144,.12),transparent 30%),linear-gradient(135deg,#f9fcfd,#fff 68%);
  box-shadow: 0 16px 44px rgba(20,47,63,.07);
}
.module-insight-strip > div:first-child h2, .module-executive-hub h2 { margin: 5px 0 4px; color: #183b4d; font-size: 1.55rem; letter-spacing: -.025em; }
.module-insight-strip > div:first-child p, .module-executive-hub header p { margin: 0; color: #657b87; }
.module-insight-kpis, .executive-hub-kpis { display:grid; grid-template-columns:repeat(4,minmax(0,1fr)); gap:12px; margin-top:20px; }
.module-insight-kpis article, .executive-hub-kpis article { padding:16px; border:1px solid #dfe9ed; border-radius:15px; background:#fff; }
.module-insight-kpis small, .module-insight-kpis strong, .module-insight-kpis span, .executive-hub-kpis small, .executive-hub-kpis strong, .executive-hub-kpis span { display:block; }
.module-insight-kpis strong, .executive-hub-kpis strong { margin:5px 0 2px; color:#173f58; font-size:1.55rem; }
.module-insight-kpis article.warning, .executive-hub-kpis article.warning { border-color:#f1d19a; background:#fffaf0; }
.module-insight-kpis article.success, .executive-hub-kpis article.success { border-color:#bfe2d2; background:#f4fbf8; }
.module-insight-kpis article.primary, .executive-hub-kpis article.primary { border-color:#bad7e6; background:#f1f8fb; }
.module-executive-hub > header { display:flex; justify-content:space-between; align-items:flex-start; gap:22px; }
.module-executive-hub > header > div:last-child { display:flex; flex-wrap:wrap; gap:9px; }
.supplier-directory-inline { margin-top:18px; overflow:hidden; border:1px solid #dfe8ec; border-radius:16px; background:#fff; }
.supplier-directory-inline > header { display:flex; justify-content:space-between; padding:14px 16px; background:#f6f9fa; }
.supplier-directory-inline > div > button { display:grid; width:100%; grid-template-columns:38px minmax(0,1fr) auto 18px; align-items:center; gap:12px; padding:13px 16px; border:0; border-top:1px solid #edf2f4; background:#fff; cursor:pointer; text-align:left; }
.supplier-directory-inline > div > button:hover { background:#f5f9fa; }
.supplier-directory-inline > div > button > span:first-child { display:grid; width:36px; height:36px; place-items:center; border-radius:10px; color:#0f766e; background:#e8f6f2; }
.administrative-actions { border-radius:22px !important; border:1px solid #d6e5ea !important; box-shadow:0 18px 46px rgba(20,47,63,.08) !important; }
.inline-detail-button { display:inline-flex; align-items:center; gap:7px; padding:7px 10px; border:1px solid #cfe0e7; border-radius:10px; color:#1f5b70; background:#f2f8fa; cursor:pointer; font-weight:750; }
.inline-detail-button:hover { border-color:#8eb8c9; background:#e8f3f7; }
.landlord-contract-link { max-width:260px; font-weight:750; }
.construction-index-explanation { margin-top:12px; padding:12px 13px; border:1px solid #d7e4ea; border-radius:12px; background:#f6fafb; }
.construction-index-explanation strong { color:#214b5c; font-size:.8rem; }
.construction-index-explanation p { margin:4px 0 0 !important; font-size:.76rem !important; }
.management-training, .management-overview .missing, .cost-monitor-progress { display:none !important; }
.management-center { border-radius:22px !important; box-shadow:0 18px 44px rgba(20,47,63,.08) !important; }
.management-heading h2 { font-size:1.65rem !important; }
.approval-check-grid { grid-template-columns:repeat(4,minmax(0,1fr)) !important; }
.detail-panel { font-size:.94rem; }
.detail-data-grid strong { font-size:.9rem !important; }
.form-grid input, .form-grid select, .form-grid textarea { min-height:44px; font-size:.9rem !important; }
.form-grid textarea { min-height:92px; }
.modal-header h2 { font-size:1.65rem !important; }
.module-purchases .module-heading { background:radial-gradient(circle at 92% 10%,rgba(3,105,161,.14),transparent 34%),linear-gradient(135deg,#fff,#f1f9fd) !important; }
.module-cards .module-heading { background:radial-gradient(circle at 92% 10%,rgba(124,58,237,.13),transparent 34%),linear-gradient(135deg,#fff,#f7f4ff) !important; }
.module-food .module-heading { background:radial-gradient(circle at 92% 10%,rgba(21,128,61,.13),transparent 34%),linear-gradient(135deg,#fff,#f2fbf5) !important; }
.module-rentals .module-heading { background:radial-gradient(circle at 92% 10%,rgba(194,65,12,.13),transparent 34%),linear-gradient(135deg,#fff,#fff7f2) !important; }
@media (max-width: 1100px) {
  .module-insight-kpis, .executive-hub-kpis { grid-template-columns:repeat(2,minmax(0,1fr)); }
  .approval-check-grid { grid-template-columns:repeat(2,minmax(0,1fr)) !important; }
}
@media (max-width: 720px) {
  html { font-size:15px; }
  .module-heading, .module-insight-strip, .module-executive-hub { padding:18px !important; border-radius:17px !important; }
  .module-executive-hub > header { display:grid; }
  .module-insight-kpis, .executive-hub-kpis { grid-template-columns:1fr; }
  .table-wrap th, .table-wrap td { white-space:nowrap; }
}
`;
  fs.writeFileSync(cssPath, css);
}

console.log("[v52] Melhorias integradas aplicadas com sucesso.");
