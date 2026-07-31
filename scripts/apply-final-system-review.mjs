import { readFile, writeFile } from "node:fs/promises";

async function read(path) {
  return readFile(path, "utf8");
}

async function write(path, content) {
  await writeFile(path, content, "utf8");
  console.log(`Atualizado: ${path}`);
}

function occurrences(text, fragment) {
  return text.split(fragment).length - 1;
}

function replaceOnce(text, before, after, label) {
  const count = occurrences(text, before);
  if (count !== 1) {
    throw new Error(`${label}: esperado exatamente 1 trecho, encontrado ${count}.`);
  }
  return text.replace(before, after);
}

function removeBetween(text, startMarker, endMarker, label) {
  const start = text.indexOf(startMarker);
  if (start < 0) throw new Error(`${label}: início não encontrado.`);
  const end = text.indexOf(endMarker, start);
  if (end < 0) throw new Error(`${label}: fim não encontrado.`);
  return text.slice(0, start) + text.slice(end);
}

function replaceBetween(text, startMarker, endMarker, replacement, label) {
  const start = text.indexOf(startMarker);
  if (start < 0) throw new Error(`${label}: início não encontrado.`);
  const end = text.indexOf(endMarker, start);
  if (end < 0) throw new Error(`${label}: fim não encontrado.`);
  return text.slice(0, start) + replacement + text.slice(end);
}

// ---------------------------------------------------------------------------
// 1. Formulário e regras visuais V52
// ---------------------------------------------------------------------------
const v52Path = "app/components/BetaAppV52.tsx";
let v52 = await read(v52Path);

v52 = replaceOnce(
  v52,
  `  patchField(expenses, {
    key: "invoiceUrl",
    label: "Nota fiscal, cupom fiscal ou recibo",
    help: "Obrigatório para qualquer lançamento com valor.",
    required: true,
  });

  const purchases = moduleMap.purchases;`,
  `  patchField(expenses, {
    key: "invoiceUrl",
    label: "Nota fiscal, cupom fiscal ou recibo",
    help: "Obrigatório para qualquer lançamento com valor.",
    required: true,
  });
  patchField(expenses, {
    key: "status",
    options: ["Aguardando validação", "Reprovado", "Pago"],
    required: true,
  });

  const purchases = moduleMap.purchases;`,
  "Status permitidos na Central Financeira",
);

await write(v52Path, v52);

// ---------------------------------------------------------------------------
// 2. Proteção real no servidor: documentos, CPF/CNPJ e status financeiro
// ---------------------------------------------------------------------------
const routePath = "app/api/records/route.ts";
let route = await read(routePath);

route = replaceOnce(
  route,
  `]);

function publicPayload(moduleId: string, payload: Record<string, unknown>) {`,
  `]);

function normalizedWriteText(value: unknown) {
  return String(value || "")
    .normalize("NFD")
    .replace(/[\\u0300-\\u036f]/g, "")
    .trim()
    .toLowerCase();
}

function requiredWriteField(
  payload: Record<string, unknown>,
  key: string,
  message: string,
) {
  if (!String(payload[key] || "").trim()) {
    throw new Error(message);
  }
}

function normalizeRecordForWrite(input: Record<string, unknown>) {
  const moduleId = String(input.module || "").trim();
  const payload = {
    ...((input.payload && typeof input.payload === "object" && !Array.isArray(input.payload)
      ? input.payload
      : {}) as Record<string, unknown>),
  };
  const amount = Math.max(0, Number(input.amount || 0));
  const next: Record<string, unknown> = { ...input, payload };

  if (moduleId === "expenses") {
    if (amount > 0) {
      requiredWriteField(
        payload,
        "invoiceUrl",
        "Lançamento bloqueado: anexe a nota fiscal, o cupom fiscal ou o recibo.",
      );
      requiredWriteField(
        payload,
        "supplierCode",
        "Lançamento bloqueado: informe o CPF ou CNPJ do fornecedor ou estabelecimento.",
      );
    }
    const statusText = normalizedWriteText(input.status || payload.status);
    const status = statusText.includes("pag")
      ? "Pago"
      : statusText.includes("reprov") || statusText.includes("rejeit")
        ? "Reprovado"
        : "Aguardando validação";
    next.status = status;
    payload.status = status;
  }

  if (moduleId === "cards" && amount > 0) {
    requiredWriteField(
      payload,
      "documentUrl",
      "Despesa de cartão bloqueada: anexe a nota fiscal, o cupom fiscal ou o recibo.",
    );
    requiredWriteField(
      payload,
      "cardEnding",
      "Despesa de cartão bloqueada: informe o CPF ou CNPJ do estabelecimento.",
    );
  }

  if (moduleId === "food" && amount > 0) {
    requiredWriteField(
      payload,
      "invoiceUrl",
      "Lançamento de alimentação bloqueado: anexe o documento fiscal.",
    );
    requiredWriteField(
      payload,
      "supplierCode",
      "Lançamento de alimentação bloqueado: informe o CPF ou CNPJ do fornecedor.",
    );
  }

  if (moduleId === "rentals") {
    requiredWriteField(
      payload,
      "contractUrl",
      "Cadastro de aluguel bloqueado: vincule o documento e o contrato.",
    );
    requiredWriteField(
      payload,
      "work",
      "Cadastro de aluguel bloqueado: informe o CPF ou CNPJ do locador.",
    );
  }

  return next;
}

function publicPayload(moduleId: string, payload: Record<string, unknown>) {`,
  "Validação de escrita no servidor",
);

route = replaceOnce(
  route,
  `        { result: await createMany(payload.records, actorFrom(request)) },`,
  `        {
          result: await createMany(
            payload.records.map((record) => normalizeRecordForWrite(record)),
            actorFrom(request),
          ),
        },`,
  "Validação da importação em lote",
);

const rawWriteExpression = `          payload.record || payload,
          actorFrom(request),`;
if (occurrences(route, rawWriteExpression) !== 2) {
  throw new Error(
    `Validação das gravações individuais: esperado 2 usos, encontrado ${occurrences(route, rawWriteExpression)}.`,
  );
}
route = route.replaceAll(
  rawWriteExpression,
  `          normalizeRecordForWrite(payload.record || payload),
          actorFrom(request),`,
);

await write(routePath, route);

// ---------------------------------------------------------------------------
// 3. Fonte de demonstração e normalização automática do D1
// ---------------------------------------------------------------------------
const demoPath = "db/demo-records.ts";
let demo = await read(demoPath);

demo = replaceOnce(
  demo,
  `demo("expenses", "Compra fictícia de cimento e argamassa", "TST-PAG-001", "Aguardando aprovação"`,
  `demo("expenses", "Compra fictícia de cimento e argamassa", "TST-PAG-001", "Aguardando validação"`,
  "Status fictício da compra de cimento",
);
demo = replaceOnce(
  demo,
  `expectedAmount: 12850.4, approval: "Pendente", status: "Aguardando aprovação",`,
  `expectedAmount: 12850.4, approval: "Pendente", status: "Aguardando validação",`,
  "Payload fictício da compra de cimento",
);
demo = replaceOnce(
  demo,
  `demo("expenses", "Locação mensal fictícia de escavadeira", "TST-PAG-002", "Pendente"`,
  `demo("expenses", "Locação mensal fictícia de escavadeira", "TST-PAG-002", "Aguardando validação"`,
  "Status fictício da escavadeira",
);
demo = replaceOnce(
  demo,
  `expectedAmount: 18400, approval: "Aprovada", status: "Pendente",`,
  `expectedAmount: 18400, approval: "Aprovada", status: "Aguardando validação",`,
  "Payload fictício da escavadeira",
);
await write(demoPath, demo);

const recordsPath = "db/records.ts";
let records = await read(recordsPath);
records = replaceBetween(
  records,
  `  const pendingStatusBackfills = (existing.results || []).flatMap((row) => {`,
  `

  const demoWorkerCounts = new Map(`,
  `  const financialStatusBackfills = (existing.results || []).flatMap((row) => {
    if (row.source !== DEMO_SOURCE) return [];
    let payload: Record<string, unknown> = {};
    try {
      payload = JSON.parse(row.payload || "{}") as Record<string, unknown>;
    } catch {
      payload = {};
    }

    const rawStatus = String(row.status || payload.status || "");
    const normalizedStatus = rawStatus
      .normalize("NFD")
      .replace(/[\\u0300-\\u036f]/g, "")
      .trim()
      .toLowerCase();

    let status = rawStatus;
    if (row.module === "expenses") {
      status = normalizedStatus.includes("pag")
        ? "Pago"
        : normalizedStatus.includes("reprov") || normalizedStatus.includes("rejeit")
          ? "Reprovado"
          : "Aguardando validação";
    } else if (rawStatus === "Vence em 7 dias") {
      status = "Pendente";
    }

    const payloadStatus = String(payload.status || "");
    if (status === row.status && status === payloadStatus) return [];
    return [{
      id: row.id,
      module: row.module,
      status,
      payload: { ...payload, status },
    }];
  });

  if (financialStatusBackfills.length) {
    const updatedAt = new Date().toISOString();
    await db.batch(
      financialStatusBackfills.map((record) =>
        db
          .prepare(
            `UPDATE records
             SET status = ?, payload = ?, updated_at = ?
             WHERE tenant_id = ? AND id = ? AND source = ?`,
          )
          .bind(
            record.status,
            JSON.stringify(record.payload),
            updatedAt,
            DEFAULT_TENANT_ID,
            record.id,
            DEMO_SOURCE,
          ),
      ),
    );
    for (const record of financialStatusBackfills) {
      await audit(
        "DEMO_REFRESH",
        record.module,
        record.id,
        `Situação fictícia padronizada como ${record.status}`,
        "Sistema",
      );
    }
  }

  const demoWorkerCounts = new Map(`,
  "Normalização dos status no D1",
);
await write(recordsPath, records);

// ---------------------------------------------------------------------------
// 4. Central Financeira com abas e painel executivo de obras
// ---------------------------------------------------------------------------
const appPath = "app/components/BetaApp.tsx";
let app = await read(appPath);

app = replaceOnce(
  app,
  `function requestApprovedStatus(record: StoredRecord) {
  if (record.module === "expenses") return "Aprovado";`,
  `function requestApprovedStatus(record: StoredRecord) {
  if (record.module === "expenses") return "Aguardando validação";`,
  "Status financeiro após aprovação gerencial",
);

app = replaceOnce(
  app,
  `["pendente", "aguardando aprovacao", "em analise"].includes(status)`,
  `["pendente", "aguardando aprovacao", "aguardando validacao", "em analise"].includes(status)`,
  "Fila financeira aguardando validação",
);

// Remove a repetição "Execução dos compromissos financeiros".
app = removeBetween(
  app,
  `            <div className="cost-monitor-progress">`,
  `
          </section>`,
  "Quadro repetido de execução financeira",
);

// Remove Ações rápidas do dashboard; a V52 já as apresenta em Administrativo.
app = removeBetween(
  app,
  `      <section className="content-card quick-card action-center">`,
  `      <section className="management-center content-card">`,
  "Ações rápidas da Visão Geral",
);

// Remove os relatórios fictícios de treinamento da decisão gerencial.
app = removeBetween(
  app,
  `        <section className="management-training">`,
  `        <div className="management-overview">`,
  "Relatórios de treinamento gerencial",
);
app = removeBetween(
  app,
  `  const decisionExamples = [`,
  `

  return (`,
  "Dados dos relatórios de treinamento",
);

// Adiciona suporte de navegação interna ao componente genérico.
const moduleStart = app.indexOf("function ModulePage({");
const moduleEnd = app.indexOf("function IntegrationHub({", moduleStart);
if (moduleStart < 0 || moduleEnd < 0) {
  throw new Error("Componente ModulePage não localizado.");
}
let moduleBlock = app.slice(moduleStart, moduleEnd);
moduleBlock = replaceOnce(
  moduleBlock,
  `  canEdit,
}: {`,
  `  canEdit,
  headerModule,
  topNavigation,
}: {`,
  "Novas propriedades do ModulePage",
);
moduleBlock = replaceOnce(
  moduleBlock,
  `  canEdit: boolean;
}) {`,
  `  canEdit: boolean;
  headerModule?: ModuleDefinition;
  topNavigation?: ReactNode;
}) {`,
  "Tipos das novas propriedades do ModulePage",
);
moduleBlock = replaceOnce(
  moduleBlock,
  `  const { visible: showInternalCodes, toggle: toggleInternalCodes } =
    useContext(InternalCodeVisibilityContext);`,
  `  const { visible: showInternalCodes, toggle: toggleInternalCodes } =
    useContext(InternalCodeVisibilityContext);
  const presentationModule = headerModule || module;`,
  "Módulo de apresentação da Central Financeira",
);
moduleBlock = replaceOnce(
  moduleBlock,
  `style={{ color: module.color, backgroundColor: module.lightColor }}`,
  `style={{
              color: presentationModule.color,
              backgroundColor: presentationModule.lightColor,
            }}`,
  "Cores do cabeçalho financeiro",
);
moduleBlock = replaceOnce(
  moduleBlock,
  `<Icon name={module.id} size={26} />`,
  `<Icon name={presentationModule.id} size={26} />`,
  "Ícone do cabeçalho financeiro",
);
moduleBlock = replaceOnce(
  moduleBlock,
  `<span className="eyebrow">{module.eyebrow}</span>
            <h1>{module.label}</h1>
            <p>{module.description}</p>`,
  `<span className="eyebrow">{presentationModule.eyebrow}</span>
            <h1>{presentationModule.label}</h1>
            <p>{presentationModule.description}</p>`,
  "Textos do cabeçalho financeiro",
);
moduleBlock = replaceOnce(
  moduleBlock,
  `      </aside>

      {module.id === "emails" ? (`,
  `      </aside>

      {topNavigation}

      {module.id === "emails" ? (`,
  "Posição das abas financeiras",
);
app = app.slice(0, moduleStart) + moduleBlock + app.slice(moduleEnd);

const financialComponent = `function FinancialCenterPage({
  allRecords,
  search,
  setSearch,
  status,
  setStatus,
  onNew,
  onEdit,
  onDelete,
  onImport,
  onOpen,
  canEdit,
}: {
  allRecords: StoredRecord[];
  search: string;
  setSearch: (value: string) => void;
  status: string;
  setStatus: (value: string) => void;
  onNew: (moduleId: string) => void;
  onEdit: (record: StoredRecord) => void;
  onDelete: (record: StoredRecord) => void;
  onImport: (moduleId: string) => void;
  onOpen: (record: StoredRecord) => void;
  canEdit: boolean;
}) {
  const [tab, setTab] = useState<"expenses" | "suppliers" | "approved">("expenses");
  const expenseRecords = allRecords.filter((record) => record.module === "expenses");
  const supplierRecords = allRecords.filter((record) => record.module === "suppliers");
  const approvedRecords = expenseRecords.filter(
    (record) => requestDecisionState(record) === "approved",
  );
  const payableRecords = expenseRecords.filter(
    (record) => requestDecisionState(record) !== "approved",
  );
  const selectedModule = tab === "suppliers" ? moduleMap.suppliers : moduleMap.expenses;
  const selectedRecords =
    tab === "suppliers"
      ? supplierRecords
      : tab === "approved"
        ? approvedRecords
        : payableRecords;

  function selectTab(next: "expenses" | "suppliers" | "approved") {
    setTab(next);
    setSearch("");
    setStatus("");
  }

  return (
    <ModulePage
      module={selectedModule}
      headerModule={moduleMap.expenses}
      records={selectedRecords}
      search={search}
      setSearch={setSearch}
      status={status}
      setStatus={setStatus}
      onNew={() => onNew(selectedModule.id)}
      onEdit={onEdit}
      onDelete={onDelete}
      onImport={() => onImport(selectedModule.id)}
      onOpen={onOpen}
      canEdit={canEdit}
      topNavigation={(
        <nav className="financial-center-tabs" aria-label="Áreas da Central Financeira">
          <button
            type="button"
            className={tab === "expenses" ? "active" : ""}
            onClick={() => selectTab("expenses")}
          >
            Contas a pagar <span>{payableRecords.length}</span>
          </button>
          <button
            type="button"
            className={tab === "suppliers" ? "active" : ""}
            onClick={() => selectTab("suppliers")}
          >
            Fornecedores <span>{supplierRecords.length}</span>
          </button>
          <button
            type="button"
            className={tab === "approved" ? "active" : ""}
            onClick={() => selectTab("approved")}
          >
            Aprovados <span>{approvedRecords.length}</span>
          </button>
        </nav>
      )}
    />
  );
}

`;
app = replaceOnce(
  app,
  `function IntegrationHub({`,
  `${financialComponent}function IntegrationHub({`,
  "Componente da Central Financeira integrada",
);

app = replaceOnce(
  app,
  `              <ModulePage
                module={activeModule}
                records={moduleRecords}
                search={search}
                setSearch={setSearch}
                status={statusFilter}
                setStatus={setStatusFilter}
                onNew={() => openNew(activeModule.id)}
                onEdit={openEdit}
                onDelete={remove}
                onImport={() => requestImport(activeModule.id)}
                onOpen={openRecord}
                canEdit={isAdmin}
              />`,
  `              {activeView === "expenses" ? (
                <FinancialCenterPage
                  allRecords={operationalRecords}
                  search={search}
                  setSearch={setSearch}
                  status={statusFilter}
                  setStatus={setStatusFilter}
                  onNew={openNew}
                  onEdit={openEdit}
                  onDelete={remove}
                  onImport={requestImport}
                  onOpen={openRecord}
                  canEdit={isAdmin}
                />
              ) : (
                <ModulePage
                  module={activeModule}
                  records={moduleRecords}
                  search={search}
                  setSearch={setSearch}
                  status={statusFilter}
                  setStatus={setStatusFilter}
                  onNew={() => openNew(activeModule.id)}
                  onEdit={openEdit}
                  onDelete={remove}
                  onImport={() => requestImport(activeModule.id)}
                  onOpen={openRecord}
                  canEdit={isAdmin}
                />
              )}`, 
  "Uso da Central Financeira integrada",
);

// Consolida o card financeiro da obra.
const costStartMarker = `        <div
          className={\`construction-cost-to-complete \${`;
const capacityMarker = `      <section className="construction-capacity-section">`;
const costStart = app.indexOf(costStartMarker);
const capacityStartBefore = app.indexOf(capacityMarker, costStart);
if (costStart < 0 || capacityStartBefore < 0) {
  throw new Error("Card financeiro da obra não localizado.");
}
const costEndStart = app.lastIndexOf(`        </div>`, capacityStartBefore);
if (costEndStart < costStart) throw new Error("Fim do card financeiro não localizado.");
const costEnd = costEndStart + `        </div>`.length;
const compactCost = `        <div
          className={\`construction-cost-to-complete construction-finance-summary \${
            projectedBudgetVariance > 0 ? "over" : "within"
          }\`}
        >
          <header>
            <span><Icon name="expenses" size={19} /></span>
            <div>
              <small>ORÇAMENTO & CUSTOS</small>
              <strong>
                {projectedBudgetVariance > 0
                  ? "Alerta de estouro"
                  : projectBudget > 0
                    ? "Dentro do orçamento"
                    : "Cadastro financeiro incompleto"}
              </strong>
            </div>
          </header>
          <div className="construction-finance-pair">
            <span>
              <small>Orçamento aprovado</small>
              <strong>{currency.format(projectBudget)}</strong>
            </span>
            <span>
              <small>Custo final projetado</small>
              <strong>{currency.format(projectedFinalCost)}</strong>
            </span>
          </div>
          <div className="construction-finance-needed">
            <small>NECESSÁRIO PARA CONCLUIR</small>
            <strong>{currency.format(estimatedCostToComplete)}</strong>
            <span>
              Inclui {currency.format(projectOpenCommitments)} comprometidos e {currency.format(uncommittedCostToComplete)} ainda a contratar ou executar.
            </span>
          </div>
          <footer>
            <span>Custo realizado</span>
            <strong>{currency.format(projectRealizedCost)}</strong>
            <b>
              {projectedBudgetVariance > 0
                ? \`\${currency.format(projectedBudgetVariance)} acima do orçamento\`
                : \`\${currency.format(Math.abs(projectedBudgetVariance))} de margem prevista\`}
            </b>
          </footer>
        </div>`;
app = app.slice(0, costStart) + compactCost + app.slice(costEnd);

// Move a linha do tempo para cima, compacta os KPIs e remove o quadro financeiro repetido.
const commandMarker = `      <section className={\`construction-project-command \${riskTone}\`}>`;
const capacityStart = app.indexOf(capacityMarker);
const roadmapMarker = `      <section
        className="construction-stage-roadmap"`;
const roadmapStart = app.indexOf(roadmapMarker, capacityStart);
const financeMarker = `      <section
        className={\`construction-project-finance \${`;
const financeStart = app.indexOf(financeMarker, roadmapStart);
const decisionMarker = `      <div className="construction-decision-grid">`;
const decisionStart = app.indexOf(decisionMarker, financeStart);
if ([capacityStart, roadmapStart, financeStart, decisionStart].some((value) => value < 0)) {
  throw new Error("Estrutura executiva da obra não localizada por completo.");
}
const capacityBlock = app.slice(capacityStart, roadmapStart).trimEnd();
const roadmapBlock = app.slice(roadmapStart, financeStart).trimEnd();
const financeBlock = app.slice(financeStart, decisionStart).trimEnd();
const compactCapacity = `      <section className="construction-capacity-section construction-capacity-compact">
        <header className="construction-capacity-compact-header">
          <div>
            <span className="eyebrow">ÍNDICES DE PRODUÇÃO</span>
            <h3>Capacidade e desempenho da obra</h3>
          </div>
          <details className="construction-index-help">
            <summary aria-label="Entenda o Índice Geral">?</summary>
            <div>
              <strong>Como funciona o Índice Geral</strong>
              <p>
                Nota gerencial ponderada que considera avanço físico, prazo,
                equipe, máquinas, produtividade e orçamento. Não representa
                isoladamente a porcentagem concluída da obra.
              </p>
            </div>
          </details>
        </header>
        <div className="construction-capacity-grid construction-capacity-grid-compact">
          <article className={\`construction-kpi-card overall \${overallTone}\`}>
            <span><Icon name="dashboard" size={19} /></span>
            <div><small>ÍNDICE GERAL</small><strong>{decimalNumber(overallIndex)}%</strong><p>{overallStatus} • resultado ponderado</p></div>
          </article>
          <article className={\`construction-kpi-card \${operationCapacity < 60 ? "negative" : operationCapacity < 90 ? "warning" : "positive"}\`}>
            <span><Icon name="works" size={18} /></span>
            <div><small>CAPACIDADE OPERACIONAL</small><strong>{decimalNumber(operationCapacity)}%</strong><p>Limitada por {capacityConstraint.label} em {decimalNumber(capacityConstraint.value)}%</p></div>
          </article>
          <article className={\`construction-kpi-card \${ownWorkforceCapacity < 100 ? "warning" : "positive"}\`}>
            <span><Icon name="people" size={18} /></span>
            <div><small>EQUIPE DISPONÍVEL</small><strong>{decimalNumber(ownWorkforceCapacity)}%</strong><p>{ownTeamCount} mobilizados de {requiredOwnTeamCount || "—"}</p></div>
          </article>
          <article className={\`construction-kpi-card \${machineAvailability < 100 ? "negative" : "positive"}\`}>
            <span><Icon name="assets" size={18} /></span>
            <div><small>MÁQUINAS PRODUZINDO</small><strong>{decimalNumber(machineAvailability)}%</strong><p>{activeMachines} ativas de {machineRows.length} • {unavailableMachines} indisponíveis</p></div>
          </article>
          <article className={\`construction-kpi-card \${utilizationPercent < 80 ? "warning" : "positive"}\`}>
            <span><Icon name="worklogs" size={18} /></span>
            <div><small>HORAS PRODUTIVAS</small><strong>{decimalNumber(utilizationPercent)}%</strong><p>{decimalNumber(productiveHours)} h produtivas • {decimalNumber(lostHours)} h perdidas</p></div>
          </article>
        </div>
      </section>`;

app = replaceOnce(app, capacityBlock, compactCapacity, "KPIs compactos da obra");
app = replaceOnce(app, roadmapBlock, "", "Reposicionamento da linha do tempo");
app = replaceOnce(app, financeBlock, "", "Remoção do financeiro repetido da obra");
app = replaceOnce(
  app,
  commandMarker,
  `${roadmapBlock}\n\n${commandMarker}`,
  "Linha do tempo antes dos cards executivos",
);

await write(appPath, app);

// ---------------------------------------------------------------------------
// 5. Estilos e regressões automatizadas
// ---------------------------------------------------------------------------
const cssPath = "app/globals.css";
let css = await read(cssPath);
if (!css.includes("/* Revisão executiva V53 */")) {
  css += `

/* Revisão executiva V53 */
.financial-center-tabs {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 6px;
  border: 1px solid #dce5ea;
  border-radius: 13px;
  background: #f6f9fa;
  box-shadow: 0 5px 16px rgba(23, 63, 88, 0.04);
}
.financial-center-tabs button {
  display: inline-flex;
  align-items: center;
  gap: 9px;
  min-height: 38px;
  padding: 0 16px;
  border: 0;
  border-radius: 9px;
  color: #596f7a;
  background: transparent;
  cursor: pointer;
  font: inherit;
  font-size: 13px;
  font-weight: 760;
}
.financial-center-tabs button span {
  display: grid;
  min-width: 22px;
  height: 22px;
  place-items: center;
  border-radius: 999px;
  color: #6d8089;
  background: #e6ecef;
  font-size: 10px;
}
.financial-center-tabs button.active {
  color: #fff;
  background: var(--brand-primary, #173f58);
  box-shadow: 0 5px 14px rgba(23, 63, 88, 0.18);
}
.financial-center-tabs button.active span {
  color: var(--brand-primary, #173f58);
  background: #fff;
}
.construction-executive-v2 .construction-stage-roadmap {
  margin: 0;
  border-color: #dce5ea;
  background: #fff;
  box-shadow: 0 10px 28px rgba(23, 63, 88, 0.055);
}
.construction-executive-v2 .construction-project-command {
  gap: 15px;
  border-color: #dce5ea;
  background: #f8fafb;
  box-shadow: 0 10px 28px rgba(23, 63, 88, 0.055);
}
.construction-executive-v2 .construction-project-progress,
.construction-executive-v2 .construction-stage-highlight,
.construction-executive-v2 .construction-cost-to-complete {
  border: 1px solid #e0e7eb;
  border-radius: 16px;
  background: #fff;
  box-shadow: 0 5px 16px rgba(23, 63, 88, 0.04);
}
.construction-finance-pair {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 10px;
  margin-top: 14px;
}
.construction-finance-pair > span,
.construction-finance-needed {
  display: block;
  padding: 11px 12px;
  border: 1px solid #e5ebee;
  border-radius: 11px;
  background: #f8fafb;
}
.construction-finance-pair small,
.construction-finance-needed small {
  display: block;
  color: #748892;
  font-size: 9px;
  font-weight: 800;
  letter-spacing: 0.055em;
  text-transform: uppercase;
}
.construction-finance-pair strong {
  display: block;
  margin-top: 5px;
  color: #183f50;
  font-size: 15px;
}
.construction-finance-needed {
  margin-top: 11px;
  background: #eef5f7;
}
.construction-finance-needed > strong {
  display: block;
  margin: 5px 0 4px;
  color: #183645;
  font-size: 24px;
  letter-spacing: -0.035em;
}
.construction-finance-needed > span {
  color: #627983;
  font-size: 10px;
  line-height: 1.45;
}
.construction-capacity-section.construction-capacity-compact {
  overflow: visible;
  padding: 0;
  border: 0;
  background: transparent;
  box-shadow: none;
}
.construction-capacity-compact-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16px;
  padding: 0 2px 11px;
}
.construction-capacity-compact-header h3 {
  margin: 4px 0 0;
  color: #183645;
  font-size: 18px;
}
.construction-index-help {
  position: relative;
  z-index: 4;
}
.construction-index-help > summary {
  display: grid;
  width: 28px;
  height: 28px;
  place-items: center;
  border: 1px solid #d4dee3;
  border-radius: 50%;
  color: #607984;
  background: #eef2f4;
  cursor: pointer;
  font-size: 12px;
  font-weight: 850;
  list-style: none;
}
.construction-index-help > summary::-webkit-details-marker { display: none; }
.construction-index-help > div {
  position: absolute;
  top: 36px;
  right: 0;
  width: min(330px, 82vw);
  padding: 13px 14px;
  border: 1px solid #d9e4e8;
  border-radius: 12px;
  background: #fff;
  box-shadow: 0 14px 34px rgba(23, 63, 88, 0.16);
}
.construction-index-help p {
  margin: 5px 0 0;
  color: #667d87;
  font-size: 10px;
  line-height: 1.5;
}
.construction-capacity-grid.construction-capacity-grid-compact {
  display: grid;
  grid-template-columns: repeat(5, minmax(0, 1fr));
  gap: 11px;
}
.construction-capacity-grid-compact .construction-kpi-card {
  display: grid;
  min-height: 116px;
  grid-template-columns: 34px minmax(0, 1fr);
  align-content: start;
  gap: 10px;
  padding: 15px;
  border: 1px solid #e1e8ec;
  border-left: 4px solid #6f91a0;
  border-radius: 13px;
  background: #fff;
  box-shadow: 0 6px 18px rgba(23, 63, 88, 0.045);
}
.construction-capacity-grid-compact .construction-kpi-card.positive { border-left-color: #22a06b; }
.construction-capacity-grid-compact .construction-kpi-card.warning { border-left-color: #e3a325; }
.construction-capacity-grid-compact .construction-kpi-card.negative { border-left-color: #d9534f; }
.construction-capacity-grid-compact .construction-kpi-card.overall { border-left-color: #2f77d0; }
.construction-capacity-grid-compact .construction-kpi-card > span {
  display: grid;
  width: 34px;
  height: 34px;
  place-items: center;
  border-radius: 10px;
  color: #426674;
  background: #edf3f5;
}
.construction-capacity-grid-compact .construction-kpi-card small,
.construction-capacity-grid-compact .construction-kpi-card strong,
.construction-capacity-grid-compact .construction-kpi-card p { display: block; }
.construction-capacity-grid-compact .construction-kpi-card small {
  color: #71858f;
  font-size: 9px;
  font-weight: 820;
  letter-spacing: 0.055em;
}
.construction-capacity-grid-compact .construction-kpi-card strong {
  margin-top: 5px;
  color: #183645;
  font-size: 22px;
}
.construction-capacity-grid-compact .construction-kpi-card p {
  margin: 4px 0 0;
  color: #6f838c;
  font-size: 10px;
  line-height: 1.4;
}
@media (max-width: 1180px) {
  .construction-capacity-grid.construction-capacity-grid-compact {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }
}
@media (max-width: 720px) {
  .financial-center-tabs { align-items: stretch; flex-direction: column; }
  .financial-center-tabs button { justify-content: space-between; }
  .construction-capacity-grid.construction-capacity-grid-compact,
  .construction-finance-pair { grid-template-columns: 1fr; }
}
`;
}
await write(cssPath, css);

const testPath = "tests/final-system-review.test.mjs";
const test = `import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const app = await readFile("app/components/BetaApp.tsx", "utf8");
const v52 = await readFile("app/components/BetaAppV52.tsx", "utf8");
const route = await readFile("app/api/records/route.ts", "utf8");
const records = await readFile("db/records.ts", "utf8");
const css = await readFile("app/globals.css", "utf8");

test("financial center has the three requested tabs", () => {
  assert.match(app, /Contas a pagar/);
  assert.match(app, /Fornecedores/);
  assert.match(app, /Aprovados/);
  assert.match(app, /financial-center-tabs/);
});

test("expenses only expose the requested statuses", () => {
  assert.match(v52, /options: \["Aguardando validação", "Reprovado", "Pago"\]/);
  assert.match(route, /Aguardando validação/);
  assert.match(route, /Lançamento bloqueado: anexe a nota fiscal/);
  assert.match(route, /CPF ou CNPJ do fornecedor/);
  assert.match(records, /financialStatusBackfills/);
});

test("construction dashboard is compact and has no repeated finance section", () => {
  const roadmap = app.indexOf('className="construction-stage-roadmap"');
  const command = app.indexOf('className={\`construction-project-command');
  assert.ok(roadmap >= 0 && command >= 0 && roadmap < command);
  assert.match(app, /construction-capacity-compact/);
  assert.match(app, /construction-finance-summary/);
  assert.doesNotMatch(app, /className={\`construction-project-finance/);
  assert.match(css, /Revisão executiva V53/);
});

test("removed dashboard sections stay removed", () => {
  assert.doesNotMatch(app, /cost-monitor-progress/);
  assert.doesNotMatch(app, /management-training/);
  assert.doesNotMatch(app, /content-card quick-card action-center/);
});
`;
await write(testPath, test);

console.log("Transformação final concluída com todos os marcadores validados.");
