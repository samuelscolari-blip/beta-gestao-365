"use client";

import {
  type CSSProperties,
  type ReactNode,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
} from "react";
import BetaApp from "./BetaApp";
import {
  moduleMap,
  moduleTips,
  navigationGroups,
  type ModuleDefinition,
  type ModuleField,
} from "../lib/modules";

type StoredRecord = {
  id: number;
  module: string;
  title: string;
  reference: string;
  status: string;
  recordDate: string;
  amount: number;
  payload: Record<string, unknown>;
  source: string;
  createdBy: string;
  createdAt: string;
  updatedAt: string;
};

type BetaAppV52Props = {
  userName?: string | null;
  userEmail?: string | null;
  isAdmin: boolean;
};

type FieldPatch = Partial<ModuleField> & { key: string };

const currency = new Intl.NumberFormat("pt-BR", {
  style: "currency",
  currency: "BRL",
});

function patchField(moduleDefinition: ModuleDefinition, patch: FieldPatch) {
  const field = moduleDefinition.fields.find((candidate) => candidate.key === patch.key);
  if (field) Object.assign(field, patch);
}

function keepFields(moduleDefinition: ModuleDefinition, keys: string[]) {
  const positions = new Map(keys.map((key, index) => [key, index]));
  moduleDefinition.fields = moduleDefinition.fields
    .filter((field) => positions.has(field.key))
    .sort(
      (left, right) =>
        (positions.get(left.key) ?? Number.MAX_SAFE_INTEGER) -
        (positions.get(right.key) ?? Number.MAX_SAFE_INTEGER),
    );
}

let configured = false;

function configureV52Modules() {
  if (configured) return;
  configured = true;

  const rentals = moduleMap.rentals;
  Object.assign(rentals, {
    label: "Gestão de Imóveis e Aluguéis",
    shortLabel: "Aluguéis",
    eyebrow: "Administrativo • Moradia de colaboradores",
    description:
      "Endereço, funcionários moradores, validação, proprietário ou empresa locadora e acesso direto ao contrato.",
    tableColumns: ["address", "residentNames", "status", "landlord"],
  });
  keepFields(rentals, [
    "propertyId",
    "address",
    "city",
    "residentNames",
    "occupants",
    "status",
    "landlord",
    "work",
    "contractUrl",
    "contract",
    "startDate",
    "endDate",
    "monthlyRent",
    "water",
    "energy",
    "internet",
    "totalMonthly",
    "paymentStatus",
    "paymentDate",
    "paidAmount",
    "receiptUrl",
    "notes",
  ]);
  patchField(rentals, {
    key: "residentNames",
    label: "Moradores",
    required: true,
    placeholder: "Informe um funcionário por linha",
  });
  patchField(rentals, {
    key: "occupants",
    label: "Quantidade de moradores",
  });
  patchField(rentals, {
    key: "status",
    options: ["Ativo", "Inativo", "Aguardando validação"],
    required: true,
  });
  patchField(rentals, {
    key: "landlord",
    label: "Dono ou empresa locadora",
    placeholder: "Nome do proprietário, imobiliária ou empresa",
    required: true,
  });
  patchField(rentals, {
    key: "work",
    label: "CPF ou CNPJ do locador",
    placeholder: "Documento do proprietário ou empresa",
    required: true,
  });
  patchField(rentals, {
    key: "contractUrl",
    label: "Documento e contrato do aluguel",
    placeholder: "Cole o link do contrato",
    required: true,
  });

  const food = moduleMap.food;
  Object.assign(food, {
    label: "Controle de Alimentação",
    eyebrow: "Operação • Retirada de refeições",
    description:
      "Quantidade retirada, funcionários que receberam, custo e documento fiscal do fornecedor.",
    tableColumns: [
      "date",
      "meal",
      "takenQty",
      "whoTook",
      "unitPrice",
      "billedTotal",
      "status",
    ],
  });
  keepFields(food, [
    "entryId",
    "date",
    "supplier",
    "supplierCode",
    "meal",
    "takenQty",
    "whoTook",
    "unitPrice",
    "billedTotal",
    "status",
    "invoiceUrl",
    "paymentStatus",
    "paymentDate",
    "paidAmount",
    "receiptUrl",
    "responsible",
    "notes",
  ]);
  patchField(food, {
    key: "supplier",
    label: "Fornecedor da alimentação",
    required: true,
  });
  patchField(food, {
    key: "supplierCode",
    label: "CPF ou CNPJ do fornecedor",
    required: true,
    help: "Informe o documento que aparece na nota, cupom ou recibo.",
  });
  patchField(food, {
    key: "takenQty",
    label: "Quantas refeições foram retiradas?",
    required: true,
  });
  patchField(food, {
    key: "whoTook",
    label: "Funcionários que retiraram",
    required: true,
    placeholder: "Informe um funcionário por linha",
  });
  patchField(food, {
    key: "billedTotal",
    label: "Valor cobrado",
    required: true,
  });
  patchField(food, {
    key: "status",
    options: ["Aguardando validação", "Conferido", "Reprovado"],
  });
  patchField(food, {
    key: "invoiceUrl",
    label: "Nota fiscal, cupom fiscal ou recibo",
    required: true,
  });

  const cards = moduleMap.cards;
  Object.assign(cards, {
    label: "Despesas de Cartão Corporativo",
    shortLabel: "Cartão Corporativo",
    eyebrow: "Financeiro • Conferência documental",
    description:
      "Nome do cartão, data, estabelecimento, produtos, valor e documento fiscal para decisão da gerência.",
    tableColumns: [
      "holder",
      "date",
      "merchant",
      "cardEnding",
      "description",
      "amount",
      "documentUrl",
      "status",
    ],
  });
  keepFields(cards, [
    "expenseId",
    "holder",
    "date",
    "merchant",
    "cardEnding",
    "description",
    "amount",
    "documentUrl",
    "approval",
    "status",
    "paymentDate",
    "paidAmount",
    "receiptUrl",
    "responsible",
    "notes",
  ]);
  patchField(cards, {
    key: "holder",
    label: "Nome do cartão",
    placeholder: "Ex.: Cartão Obras 01",
    required: true,
  });
  patchField(cards, {
    key: "merchant",
    label: "Estabelecimento",
    required: true,
  });
  patchField(cards, {
    key: "cardEnding",
    label: "CPF ou CNPJ do estabelecimento",
    placeholder: "Documento exibido no comprovante fiscal",
    required: true,
  });
  patchField(cards, {
    key: "description",
    label: "Produtos ou serviços comprados",
    placeholder: "Confirme os itens identificados no documento fiscal",
    help: "O campo fica pronto para receber a leitura automática do futuro conector fiscal.",
    required: true,
  });
  patchField(cards, {
    key: "documentUrl",
    label: "Nota fiscal, cupom fiscal ou recibo",
    help: "Obrigatório. A despesa não será registrada sem documento fiscal.",
    required: true,
  });
  patchField(cards, {
    key: "approval",
    label: "Decisão da gerência",
    options: ["Pendente", "Aprovada", "Rejeitada"],
  });
  patchField(cards, {
    key: "status",
    options: ["Aguardando validação", "Aprovada", "Reprovada", "Paga"],
  });

  const expenses = moduleMap.expenses;
  Object.assign(expenses, {
    label: "Central Financeira e Fornecedores",
    shortLabel: "Fornecedores",
    eyebrow: "Financeiro • Fornecedores • Pagamentos",
    description:
      "Fornecedor, documento fiscal, vencimento, aprovação e pagamento reunidos em um fluxo claro.",
    tableColumns: [
      "supplier",
      "supplierCode",
      "description",
      "dueDate",
      "expectedAmount",
      "status",
      "invoiceUrl",
    ],
  });
  patchField(expenses, {
    key: "supplier",
    label: "Fornecedor ou estabelecimento",
    required: true,
  });
  patchField(expenses, {
    key: "supplierCode",
    label: "CPF ou CNPJ do fornecedor",
    placeholder: "Documento do emissor da venda",
    required: true,
  });
  patchField(expenses, {
    key: "approval",
    label: "Decisão da gerência",
    options: ["Pendente", "Aprovada", "Rejeitada"],
  });
  patchField(expenses, {
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

  const purchases = moduleMap.purchases;
  Object.assign(purchases, {
    label: "Central Estratégica de Compras",
    eyebrow: "Suprimentos • Cotação • Decisão",
    description:
      "Necessidade, prioridade, cotações, fornecedor, prazo, valor e documentos organizados para decisão.",
    tableColumns: [
      "requestDate",
      "priority",
      "work",
      "material",
      "quantity",
      "supplier",
      "totalAmount",
      "status",
      "documentsUrl",
    ],
  });
  patchField(purchases, {
    key: "requester",
    label: "Solicitante",
    required: true,
  });
  patchField(purchases, {
    key: "priority",
    required: true,
  });
  patchField(purchases, {
    key: "minimumQuotes",
    label: "Justificativa e impacto da compra",
    type: "textarea",
    wide: true,
    required: true,
    placeholder:
      "Explique por que a compra é necessária e o impacto de não realizar.",
  });
  patchField(purchases, {
    key: "documentsUrl",
    label: "Cotações, pedido e documentos da compra",
    required: true,
  });

  const people = moduleMap.people;
  Object.assign(people, {
    label: "Administrativo e Pessoas",
    shortLabel: "Administrativo",
    eyebrow: "Administrativo • Pessoas • RH",
    description:
      "Funcionários, vínculos, jornadas, documentos, custos mensais e rotinas administrativas.",
  });

  Object.assign(moduleTips, {
    expenses:
      "Cadastre fornecedor, CPF ou CNPJ, vencimento, valor e documento fiscal. Sem nota, cupom ou recibo, o lançamento não é aceito.",
    cards:
      "Informe o nome do cartão, o estabelecimento, CPF ou CNPJ, os produtos e o documento fiscal. A gerência decide após a conferência.",
    rentals:
      "Registre endereço, moradores, status de validação, locador e contrato. Clique nos moradores para ver os nomes e no locador para abrir o contrato.",
    food:
      "Registre somente a quantidade retirada e os funcionários que receberam. O documento fiscal e o CPF ou CNPJ do fornecedor são obrigatórios.",
    purchases:
      "Explique a necessidade, o impacto, a prioridade, as cotações e o critério da escolha. A decisão pertence à gerência.",
  });

  navigationGroups.splice(
    0,
    navigationGroups.length,
    { label: "PAINEL EXECUTIVO", items: ["dashboard"] },
    {
      label: "FINANCEIRO E SUPRIMENTOS",
      items: ["expenses", "cards"],
    },
    {
      label: "ENGENHARIA E EQUIPAMENTOS",
      items: ["works", "worklogs", "assets"],
    },
    {
      label: "ADMINISTRATIVO E RH",
      items: ["people", "payroll", "terminations"],
    },
    {
      label: "FISCAL E CONFORMIDADE",
      items: ["compliance", "rules", "taxes"],
    },
    {
      label: "OPERAÇÃO E DOCUMENTOS",
      items: ["rentals", "food", "documents"],
    },
    {
      label: "INTEGRAÇÕES MICROSOFT 365",
      items: ["emails", "m365"],
    },
  );
}

configureV52Modules();

const documentFieldByModule: Record<string, string> = {
  expenses: "invoiceUrl",
  cards: "documentUrl",
  food: "invoiceUrl",
  asset_events: "documentUrl",
  taxes: "guideUrl",
  rentals: "contractUrl",
  purchases: "documentsUrl",
};

const partyDocumentByModule: Record<string, string> = {
  expenses: "supplierCode",
  cards: "cardEnding",
  food: "supplierCode",
  rentals: "work",
};

function validateRecord(record: Record<string, unknown>) {
  const moduleId = String(record.module || "");
  const payload = (record.payload || {}) as Record<string, unknown>;
  const amount = Math.max(0, Number(record.amount || 0));
  const evidenceKey = documentFieldByModule[moduleId];
  const evidenceRequired = amount > 0 || ["rentals", "purchases"].includes(moduleId);

  if (
    evidenceRequired &&
    evidenceKey &&
    !String(payload[evidenceKey] || "").trim()
  ) {
    throw new Error(
      "Lançamento bloqueado: anexe nota fiscal, cupom fiscal, recibo, guia, cotação ou contrato obrigatório.",
    );
  }

  const partyKey = partyDocumentByModule[moduleId];
  if (amount > 0 && partyKey && !String(payload[partyKey] || "").trim()) {
    throw new Error(
      "Lançamento bloqueado: informe o CPF ou CNPJ do fornecedor, estabelecimento ou locador.",
    );
  }
}

function requestPath(input: RequestInfo | URL) {
  if (typeof input === "string") return input;
  if (input instanceof URL) return input.pathname;
  return input.url;
}

function isRecordsRequest(input: RequestInfo | URL) {
  const path = requestPath(input);
  return path === "/api/records" || path.includes("/api/records?");
}

function parseNames(value: unknown) {
  return String(value || "")
    .split(/\n|,|;/)
    .map((name) => name.trim())
    .filter(Boolean);
}

function normalized(value: unknown) {
  return String(value || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim()
    .toLowerCase();
}

function statusTone(status: string) {
  const value = normalized(status);
  if (["ativo", "aprovado", "aprovada", "conferido", "pago"].includes(value)) {
    return "success";
  }
  if (["inativo", "reprovado", "reprovada", "vencido"].includes(value)) {
    return "danger";
  }
  return "warning";
}

function findSidebarButton(text: string) {
  return Array.from(document.querySelectorAll<HTMLButtonElement>(".sidebar nav button")).find(
    (button) => normalized(button.textContent).includes(normalized(text)),
  );
}

function findFinancialTabButton(text: string) {
  return Array.from(
    document.querySelectorAll<HTMLButtonElement>(".financial-center-tabs button"),
  ).find((button) => normalized(button.textContent).includes(normalized(text)));
}

// "Compras" não tem mais item próprio no menu: seu conteúdo virou uma aba
// dentro da tela "Fornecedores" (Central Financeira). Por isso o atalho
// precisa abrir essa tela e então clicar na aba, em vez de procurar um
// botão de menu que não existe mais.
function openPurchasesTab(thenCreate: boolean) {
  findSidebarButton(moduleMap.expenses.shortLabel)?.click();
  window.setTimeout(() => {
    findFinancialTabButton("Compras")?.click();
    if (thenCreate) {
      window.setTimeout(() => {
        document
          .querySelector<HTMLButtonElement>(".module-heading .button.primary")
          ?.click();
      }, 80);
    }
  }, 80);
}

function navigateAndCreate(moduleId: string) {
  if (moduleId === "purchases") {
    openPurchasesTab(true);
    return;
  }
  const moduleDefinition = moduleMap[moduleId];
  const navButton = findSidebarButton(moduleDefinition?.shortLabel || moduleId);
  navButton?.click();
  window.setTimeout(() => {
    document
      .querySelector<HTMLButtonElement>(".module-heading .button.primary")
      ?.click();
  }, 80);
}

function createIcon(name: string): ReactNode {
  const icons: Record<string, string> = {
    people: "👥",
    expenses: "R$",
    cards: "▣",
    purchases: "🛒",
    rentals: "⌂",
    food: "🍽",
    worklogs: "✓",
    assets: "⚙",
  };
  return icons[name] || "•";
}

function ExecutiveModuleStrip({ moduleId, records }: { moduleId: string; records: StoredRecord[] }) {
  const moduleRecords = records.filter((record) => record.module === moduleId);
  const evidenceKey = documentFieldByModule[moduleId];
  const documented = evidenceKey
    ? moduleRecords.filter((record) => String(record.payload[evidenceKey] || "").trim()).length
    : moduleRecords.length;
  const pending = moduleRecords.filter((record) =>
    ["pendente", "aguardando", "analise", "validacao", "vencido"].some((term) =>
      normalized(record.status).includes(term),
    ),
  ).length;
  const total = moduleRecords.reduce(
    (sum, record) => sum + Math.max(0, Number(record.amount || 0)),
    0,
  );

  return (
    <section className="v52-module-strip">
      <div className="v52-module-strip-copy">
        <span>VISÃO EXECUTIVA DA ÁREA</span>
        <h2>Controle, documentação e decisão em um só lugar</h2>
        <p>
          Indicadores objetivos para a gerência acompanhar o volume, as pendências,
          os documentos vinculados e os valores registrados.
        </p>
      </div>
      <div className="v52-module-kpis">
        <article><small>REGISTROS</small><strong>{moduleRecords.length}</strong><span>itens acompanhados</span></article>
        <article className="warning"><small>PENDÊNCIAS</small><strong>{pending}</strong><span>exigem conferência</span></article>
        <article className="success"><small>DOCUMENTADOS</small><strong>{documented}</strong><span>com evidência vinculada</span></article>
        <article className="primary"><small>VALOR ACOMPANHADO</small><strong>{currency.format(total)}</strong><span>total do módulo</span></article>
      </div>
    </section>
  );
}

function AdministrativeActions({ isAdmin }: { isAdmin: boolean }) {
  const actions = [
    ["people", "Cadastrar funcionário", "Ficha, documentos e vínculo"],
    ["expenses", "Lançar pagamento", "Fornecedor, documento e vencimento"],
    ["cards", "Registrar cartão", "Compra com documento fiscal"],
    ["purchases", "Solicitar compra", "Necessidade, cotação e prioridade"],
    ["rentals", "Cadastrar aluguel", "Moradores, locador e contrato"],
    ["food", "Registrar alimentação", "Refeições retiradas e funcionários"],
    ["worklogs", "Registrar diário", "Produção e ocorrências da obra"],
    ["assets", "Abrir máquinas", "Manutenção, ociosidade e impacto"],
  ];

  return (
    <section className="v52-administrative-actions">
      <header>
        <div>
          <span>CENTRAL ADMINISTRATIVA</span>
          <h2>Ações rápidas</h2>
          <p>As rotinas operacionais foram retiradas da Visão Geral e concentradas aqui.</p>
        </div>
        <strong>{isAdmin ? "Cadastros liberados" : "Modo de consulta"}</strong>
      </header>
      <div>
        {actions.map(([id, title, detail]) => (
          <button
            key={id}
            type="button"
            onClick={() =>
              id === "purchases"
                ? openPurchasesTab(false)
                : isAdmin
                  ? navigateAndCreate(id)
                  : findSidebarButton(moduleMap[id]?.shortLabel || id)?.click()
            }
          >
            <i style={{
              "--action-color": moduleMap[id]?.color || "#173f58",
              "--action-bg": moduleMap[id]?.lightColor || "#edf4f8",
            } as CSSProperties}>{createIcon(id)}</i>
            <span><strong>{title}</strong><small>{detail}</small></span>
            <b>›</b>
          </button>
        ))}
      </div>
    </section>
  );
}

function RentalManagementQueue({
  records,
  isAdmin,
  onUpdated,
}: {
  records: StoredRecord[];
  isAdmin: boolean;
  onUpdated: () => void;
}) {
  const pending = records.filter(
    (record) =>
      record.module === "rentals" &&
      normalized(record.status) === "aguardando validacao",
  );
  const [savingId, setSavingId] = useState<number | null>(null);

  async function decide(record: StoredRecord, approved: boolean) {
    if (!isAdmin || savingId) return;
    const reason = approved
      ? ""
      : window.prompt("Informe o motivo da reprovação do aluguel:")?.trim() || "";
    if (!approved && !reason) return;
    setSavingId(record.id);
    try {
      const decidedAt = new Date().toISOString();
      const nextPayload = {
        ...record.payload,
        approval: approved ? "Aprovada" : "Rejeitada",
        managementDecision: approved ? "APPROVED" : "REJECTED",
        managementDecisionLabel: approved ? "Aprovado" : "Reprovado",
        managementDecisionReason: reason,
        managementDecisionAt: decidedAt,
      };
      const response = await window.fetch("/api/records", {
        method: "PUT",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          id: record.id,
          expectedUpdatedAt: record.updatedAt,
          record: {
            module: record.module,
            title: record.title,
            reference: record.reference,
            status: approved ? "Ativo" : "Inativo",
            recordDate: record.recordDate,
            amount: record.amount,
            payload: nextPayload,
            source: record.source || "Sistema web",
          },
        }),
      });
      if (!response.ok) {
        const body = (await response.json()) as { error?: string };
        throw new Error(body.error || "Não foi possível registrar a decisão.");
      }
      onUpdated();
    } catch (error) {
      window.alert(error instanceof Error ? error.message : "Não foi possível registrar a decisão.");
    } finally {
      setSavingId(null);
    }
  }

  if (!pending.length) return null;

  return (
    <section className="v52-rental-management">
      <header>
        <div><span>ALUGUÉIS PARA DECISÃO</span><h3>Contratos aguardando validação da gerência</h3><p>O sistema apresenta moradores, locador e contrato. A decisão permanece com a gerência.</p></div>
        <strong>{pending.length}</strong>
      </header>
      <div>
        {pending.map((record) => {
          const residents = parseNames(record.payload.residentNames);
          return (
            <article key={record.id}>
              <span className="v52-rental-icon">⌂</span>
              <div className="v52-rental-main">
                <strong>{String(record.payload.address || record.title)}</strong>
                <small>{residents.length} morador(es) • {String(record.payload.landlord || "Locador não informado")}</small>
                <p>{residents.join(" • ") || "Moradores não informados"}</p>
              </div>
              <a href={String(record.payload.contractUrl || "#")} target="_blank" rel="noreferrer">Abrir contrato</a>
              <span className={`status-pill ${statusTone(record.status)}`}>{record.status}</span>
              {isAdmin ? (
                <div className="v52-rental-actions">
                  <button disabled={savingId === record.id} onClick={() => void decide(record, true)}>Aprovar</button>
                  <button disabled={savingId === record.id} onClick={() => void decide(record, false)}>Reprovar</button>
                </div>
              ) : null}
            </article>
          );
        })}
      </div>
    </section>
  );
}

function V52Enhancer({ isAdmin }: { isAdmin: boolean }) {
  const [records, setRecords] = useState<StoredRecord[]>([]);
  const [activeModule, setActiveModule] = useState("dashboard");
  const originalFetchRef = useRef<typeof window.fetch | null>(null);

  useLayoutEffect(() => {
    if (originalFetchRef.current) return;
    const originalFetch = window.fetch.bind(window);
    originalFetchRef.current = originalFetch;

    window.fetch = async (input: RequestInfo | URL, init?: RequestInit) => {
      if (isRecordsRequest(input) && ["POST", "PUT"].includes(String(init?.method || "GET").toUpperCase()) && init?.body) {
        const body = JSON.parse(String(init.body)) as {
          record?: Record<string, unknown>;
          records?: Array<Record<string, unknown>>;
        };
        if (Array.isArray(body.records)) body.records.forEach(validateRecord);
        else validateRecord(body.record || (body as unknown as Record<string, unknown>));
      }

      const response = await originalFetch(input, init);
      if (isRecordsRequest(input) && String(init?.method || "GET").toUpperCase() === "GET") {
        const clone = response.clone();
        void clone
          .json()
          .then((body: { records?: StoredRecord[] }) => {
            if (Array.isArray(body.records)) setRecords(body.records);
          })
          .catch(() => undefined);
      }
      return response;
    };

    return () => {
      window.fetch = originalFetch;
      originalFetchRef.current = null;
    };
  }, []);

  useEffect(() => {
    const enhance = () => {
      const activeButton = document.querySelector<HTMLButtonElement>(".sidebar nav button.active");
      const activeText = normalized(activeButton?.textContent);
      const nextModule =
        Object.values(moduleMap).find((module) =>
          activeText.includes(normalized(module.shortLabel)),
        )?.id || (activeText.includes("visao geral") ? "dashboard" : activeModule);
      if (nextModule !== activeModule) setActiveModule(nextModule);

      document.querySelectorAll<HTMLElement>(".cost-monitor-progress, .management-training, .management-overview .missing").forEach((node) => {
        node.hidden = true;
      });
      document.querySelectorAll<HTMLButtonElement>(".management-tabs button").forEach((button) => {
        if (normalized(button.textContent).includes("ausentes")) button.hidden = true;
      });

      const quick = document.querySelector<HTMLElement>(".page-area > .page-stack .action-center");
      if (quick && nextModule === "dashboard") quick.hidden = true;

      const topTitle = document.querySelector<HTMLElement>(".topbar-left strong");
      if (
        topTitle &&
        nextModule === "dashboard" &&
        topTitle.textContent !== "Visão Executiva Geral"
      ) {
        topTitle.textContent = "Visão Executiva Geral";
      }

      const indexSection = document.querySelector<HTMLElement>(".construction-capacity-section");
      if (indexSection && !indexSection.querySelector(".v52-index-guide")) {
        const guide = document.createElement("aside");
        guide.className = "v52-index-guide";
        guide.innerHTML = "<strong>Como funciona o Índice Geral</strong><p>Ele não é a porcentagem concluída da obra. É uma nota gerencial ponderada que combina avanço frente ao plano, prazo, equipe própria, máquinas, horas produtivas e orçamento. Consulte sempre o avanço físico separadamente.</p>";
        indexSection.querySelector("header")?.insertAdjacentElement("afterend", guide);
      }

      const table = document.querySelector<HTMLTableElement>(".module-page .table-card table, .page-stack .table-card table");
      if (table) {
        const headings = Array.from(table.querySelectorAll("thead th")).map((th) => normalized(th.textContent));
        const residentIndex = headings.findIndex((heading) => heading === "moradores");
        const foodIndex = headings.findIndex((heading) => heading.includes("funcionarios que retiraram"));
        const landlordIndex = headings.findIndex((heading) => heading.includes("dono ou empresa locadora"));
        table.querySelectorAll<HTMLTableRowElement>("tbody tr").forEach((row) => {
          const cells = Array.from(row.cells);
          const detailsButton = row.querySelector<HTMLButtonElement>('.row-actions button[aria-label="Ver detalhes"]');
          for (const index of [residentIndex, foodIndex]) {
            const cell = cells[index];
            if (!cell || cell.dataset.v52Enhanced) continue;
            const names = parseNames(cell.textContent);
            cell.dataset.v52Enhanced = "true";
            cell.textContent = "";
            const button = document.createElement("button");
            button.type = "button";
            button.className = "v52-inline-detail";
            button.textContent = `${names.length} ${index === residentIndex ? "morador(es)" : "funcionário(s)"}`;
            button.title = names.join(" • ");
            button.onclick = (event) => {
              event.stopPropagation();
              detailsButton?.click();
            };
            cell.append(button);
          }

          if (landlordIndex >= 0 && cells[landlordIndex] && !cells[landlordIndex].dataset.v52Enhanced) {
            const address = cells[0]?.textContent?.trim();
            const record = records.find(
              (candidate) =>
                candidate.module === "rentals" &&
                normalized(candidate.payload.address || candidate.title) === normalized(address),
            );
            const url = String(record?.payload.contractUrl || "");
            if (url) {
              const text = cells[landlordIndex].textContent || "Abrir contrato";
              cells[landlordIndex].dataset.v52Enhanced = "true";
              cells[landlordIndex].textContent = "";
              const link = document.createElement("a");
              link.className = "document-link v52-landlord-link";
              link.href = url;
              link.target = "_blank";
              link.rel = "noreferrer";
              link.textContent = text;
              link.onclick = (event) => event.stopPropagation();
              cells[landlordIndex].append(link);
            }
          }
        });
      }
    };

    let animationFrame: number | null = null;
    let disposed = false;

    const scheduleEnhancement = () => {
      if (disposed || animationFrame !== null) return;

      animationFrame = window.requestAnimationFrame(() => {
        animationFrame = null;
        if (disposed) return;

        observer.disconnect();
        try {
          enhance();
        } finally {
          if (!disposed) {
            observer.observe(document.body, {
              childList: true,
              subtree: true,
            });
          }
        }
      });
    };

    const observer = new MutationObserver(scheduleEnhancement);
    scheduleEnhancement();

    return () => {
      disposed = true;
      observer.disconnect();
      if (animationFrame !== null) {
        window.cancelAnimationFrame(animationFrame);
        animationFrame = null;
      }
    };
  }, [records, activeModule]);

  const refresh = () => {
    document.querySelector<HTMLButtonElement>('.topbar button[aria-label="Atualizar dados"]')?.click();
  };

  const portalTarget = document.querySelector<HTMLElement>(".page-area");
  if (!portalTarget) return null;

  return (
    <div className="v52-floating-layer" aria-hidden="true">
      <div data-active-module={activeModule} />
      {activeModule === "people" ? <AdministrativeActions isAdmin={isAdmin} /> : null}
      {["purchases", "cards", "rentals", "food", "expenses"].includes(activeModule) ? (
        <ExecutiveModuleStrip moduleId={activeModule} records={records} />
      ) : null}
      {activeModule === "dashboard" ? (
        <RentalManagementQueue records={records} isAdmin={isAdmin} onUpdated={refresh} />
      ) : null}
    </div>
  );
}

export default function BetaAppV52(props: BetaAppV52Props) {
  return (
    <>
      <BetaApp {...props} />
      <V52Enhancer isAdmin={props.isAdmin} />
    </>
  );
}
