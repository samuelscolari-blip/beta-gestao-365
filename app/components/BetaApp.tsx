"use client";

import {
  createContext,
  type CSSProperties,
  type FormEvent,
  type ReactNode,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import {
  amountForPayload,
  fieldByKey,
  hasInternalRecordReference,
  isInternalCodeField,
  moduleMap,
  moduleTips,
  navigationGroups,
  purchaseMaterialUnits,
  type ModuleDefinition,
  type ModuleField,
} from "../lib/modules";
import { NOVO_REGISTRO_EVENTO } from "../lib/quick-actions";
import FieldLeaveSummary from "../ui/FieldLeaveSummary/FieldLeaveSummary";
import TrainingsSummary from "../ui/TrainingsSummary/TrainingsSummary";
import TrainingsTabs from "../ui/TrainingsTabs/TrainingsTabs";
import ModuleHeader, {
  type ModuleHeaderVariant,
} from "../ui/ModuleHeader/ModuleHeader";
import {
  exportAllWorkbook,
  exportImportTemplate,
  exportModuleWorkbook,
  importWorkbook,
} from "../lib/spreadsheet";
import {
  importScopeDescription,
  isImportableModule,
} from "../lib/import-policy";
import {
  calculatePayroll,
  payrollRules2026,
  type PayrollInput,
  type PayrollLine,
  type PayrollResult,
} from "../lib/payroll";
import {
  terminationRules2026,
  type TerminationInput,
  type TerminationResult,
} from "../lib/termination";
import {
  boundedContexts,
  capabilityLabel,
  complianceSources,
  erpCapabilities,
} from "../lib/erp-capabilities";
import { calculateWorkProductivity } from "../lib/construction-metrics";
import TerminationStudio from "./TerminationStudio";
import { IbsCbsTaxCenter } from "./IbsCbsPanels";

type StoredRecord = {
  id: number;
  tenantId?: string;
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

type AuditLog = {
  id: number;
  tenantId?: string;
  action: string;
  module: string;
  recordId: number | null;
  summary: string;
  actor: string;
  previousHash?: string;
  entryHash?: string;
  integrity?: "SEALED" | "LEGACY";
  createdAt: string;
};

type ImportRunView = {
  id: string;
  fileName: string;
  targetModule: string;
  status: string;
  totalRows: number;
  totalSuccess: number;
  totalUpdated: number;
  totalSkipped: number;
  totalErrors: number;
  startedAt: string;
  finishedAt: string;
  createdAt: string;
  errors: Array<{
    id: string;
    rowNumber: number;
    sheet: string;
    module: string;
    payload: Record<string, unknown>;
    reason: string;
    resolved: boolean;
  }>;
};

type BatchPayrollResponse = {
  success: boolean;
  meta: {
    competencia: string;
    dataProcessamento: string;
    quantidadeColaboradores: number;
    rulesVersion?: string;
    fonte?: string;
  };
  totais: {
    totalBruto: number;
    totalLiquido: number;
    totalINSS: number;
    totalIRRF: number;
    totalFGTS: number;
    totalEncargosPatronais: number;
    custoEmpresarialTotal: number;
  };
  detalhes: Array<{
    colaboradorId: string;
    nome: string;
    cargo: string;
    obraId: string;
    resultado: PayrollResult;
  }>;
  record?: StoredRecord;
};

type ErpCoreStatus = {
  configured: boolean;
  connected: boolean;
  mode: string;
  message: string;
  checkedAt: string;
  checks: {
    portal: boolean;
    postgres: boolean;
    redis: boolean;
    worker: boolean;
    xmlSigner: boolean;
  };
  missing?: string[];
  certificateProvider?: string;
  governmentTransmission?: string;
  runtime?: Record<string, string>;
};

type SystemSettings = {
  companyName: string;
  systemName: string;
  logoUrl: string;
  primaryColor: string;
  welcomeMessage: string;
  supportName: string;
  supportEmail: string;
  supportPhone: string;
  corporateDomain: string;
  /* "Sim" quando a base deixou de ser demonstração. Ver app/lib/official-base.ts. */
  officialBase: string;
  commercialNotes: string;
  taxRegime: string;
  cnae: string;
  fpas: string;
  thirdPartiesCode: string;
  employerInssPercent: string;
  thirdPartiesPercent: string;
  rat: string;
  fap: string;
  cnpj: string;
  legalNature: string;
  companySize: string;
  legalName: string;
  tradeName: string;
  registrationStatus: string;
  primaryActivity: string;
};

type InternalCodeVisibility = {
  visible: boolean;
  toggle: () => void;
};

const InternalCodeVisibilityContext =
  createContext<InternalCodeVisibility>({
    visible: false,
    toggle: () => undefined,
  });

const defaultSettings: SystemSettings = {
  companyName: "Beta Construtora",
  systemName: "Beta Gestão 365",
  /*
   * O logotipo da Beta Construtora, recortado do arquivo oficial e reduzido
   * a 160px — o quádruplo do tamanho em que aparece, para ficar nítido em
   * tela retina. O original tem 2816x1536 e 7,9 MB: serviria de cartaz, mas
   * seriam 7,9 MB baixados a cada abertura de página para preencher 40
   * pixels de barra lateral.
   *
   * Continua sendo um campo editável: trocar a marca não exige publicação.
   */
  logoUrl: "/logo-beta.png",
  primaryColor: "#173f58",
  welcomeMessage:
    "Acompanhe compromissos, pessoas, máquinas e documentos em um só lugar.",
  supportName: "Suporte Beta Gestão 365",
  supportEmail: "",
  supportPhone: "",
  corporateDomain: "",
  officialBase: "Não",
  commercialNotes: "",
  taxRegime: "Não informado",
  cnae: "",
  fpas: "",
  thirdPartiesCode: "",
  employerInssPercent: "",
  thirdPartiesPercent: "",
  rat: "",
  fap: "",
  cnpj: "",
  legalNature: "",
  companySize: "",
  legalName: "",
  tradeName: "",
  registrationStatus: "",
  primaryActivity: "",
};

type Toast = { kind: "success" | "error"; text: string } | null;

const currency = new Intl.NumberFormat("pt-BR", {
  style: "currency",
  currency: "BRL",
});
const compactCurrency = new Intl.NumberFormat("pt-BR", {
  style: "currency",
  currency: "BRL",
  notation: "compact",
  maximumFractionDigits: 1,
});

function Icon({
  name,
  size = 20,
  strokeWidth = 1.8,
}: {
  name: string;
  size?: number;
  strokeWidth?: number;
}) {
  const paths: Record<string, ReactNode> = {
    dashboard: (
      <>
        <rect x="3" y="3" width="7" height="7" rx="2" />
        <rect x="14" y="3" width="7" height="7" rx="2" />
        <rect x="3" y="14" width="7" height="7" rx="2" />
        <rect x="14" y="14" width="7" height="7" rx="2" />
      </>
    ),
    expenses: (
      <>
        <rect x="3" y="5" width="18" height="14" rx="3" />
        <path d="M3 10h18M7 15h4" />
      </>
    ),
    cards: (
      <>
        <rect x="2.5" y="5" width="19" height="14" rx="3" />
        <path d="M2.5 10h19M7 15h3" />
      </>
    ),
    taxes: (
      <>
        <path d="M5 3h11l3 3v15H5z" />
        <path d="M15 3v5h5M8 12h8M8 16h6" />
      </>
    ),
    purchases: (
      <>
        <path d="M3 5h2l2.2 10.5h10.9L21 8H6" />
        <circle cx="9" cy="20" r="1" />
        <circle cx="17" cy="20" r="1" />
      </>
    ),
    rentals: (
      <>
        <path d="M3 11 12 3l9 8" />
        <path d="M5 10v11h14V10M9 21v-7h6v7" />
      </>
    ),
    assets: (
      <>
        <path d="M4 14h16v6H4zM6 14l2-6h8l2 6" />
        <circle cx="8" cy="20" r="1.5" />
        <circle cx="16" cy="20" r="1.5" />
        <path d="M10 4h4" />
      </>
    ),
    asset_events: (
      <>
        <path d="M14.7 6.3a4 4 0 0 0-5.3 5.3L3 18v3h3l6.4-6.4a4 4 0 0 0 5.3-5.3l-2.4 2.4-3-3z" />
        <path d="m15 17 2 2 4-4" />
      </>
    ),
    food: (
      <>
        <path d="M5 3v8M8 3v8M5 7h3M6.5 11v10M16 3c3 4 3 8 0 11v7M16 3v11" />
      </>
    ),
    people: (
      <>
        <circle cx="9" cy="8" r="4" />
        <path d="M2.5 21c.7-5 3-7 6.5-7s5.8 2 6.5 7M16 8h5M18.5 5.5v5" />
      </>
    ),
    payroll: (
      <>
        <rect x="4" y="3" width="16" height="18" rx="2" />
        <path d="M8 8h8M8 12h3M8 16h3M15 12v5M13 14.5h4" />
      </>
    ),
    terminations: (
      <>
        <path d="M6 2h9l4 4v16H6zM15 2v5h5M9 11h7M9 15h4" />
        <path d="m15 14 5 5M20 14l-5 5" />
      </>
    ),
    works: (
      <>
        <path d="M4 21V7l8-4 8 4v14M8 21v-7h8v7M8 9h2M14 9h2" />
      </>
    ),
    worklogs: (
      <>
        <path d="M6 3h9l4 4v14H6zM15 3v5h5" />
        <path d="M9 12h7M9 16h5" />
        <path d="m3.5 14 1.5 1.5 3-3" />
      </>
    ),
    calendar: (
      <>
        <rect x="3" y="5" width="18" height="16" rx="3" />
        <path d="M8 3v4M16 3v4M3 10h18" />
        <path d="M8 14h3M8 17h6" />
      </>
    ),
    suppliers: (
      <>
        <path d="M4 5h16v16H4zM8 5V3h8v2M8 10h8M8 14h8M8 18h5" />
      </>
    ),
    documents: (
      <>
        <path d="M6 2h8l4 4v16H6zM14 2v5h5M9 12h6M9 16h6" />
      </>
    ),
    emails: (
      <>
        <rect x="3" y="5" width="18" height="14" rx="3" />
        <path d="m4 7 8 6 8-6" />
      </>
    ),
    m365: (
      <>
        <rect x="3" y="3" width="8" height="8" rx="2" />
        <rect x="13" y="3" width="8" height="8" rx="2" />
        <rect x="3" y="13" width="8" height="8" rx="2" />
        <path d="M17 13v8M13 17h8" />
      </>
    ),
    manual: (
      <>
        <path d="M4 4.5A2.5 2.5 0 0 1 6.5 2H20v17H6.5A2.5 2.5 0 0 0 4 21.5Z" />
        <path d="M4 4.5v17M8 7h8M8 11h8M8 15h5" />
      </>
    ),
    compliance: (
      <>
        <path d="M12 2 20 5v6c0 5-3.3 8.8-8 11-4.7-2.2-8-6-8-11V5z" />
        <path d="m8.5 12 2.2 2.2 4.8-5" />
      </>
    ),
    rules: (
      <>
        <path d="M5 3h14v18H5zM8 7h8M8 11h8M8 15h4" />
        <path d="m14 16 1.5 1.5L19 14" />
      </>
    ),
    database: (
      <>
        <ellipse cx="12" cy="5" rx="8" ry="3" />
        <path d="M4 5v6c0 1.7 3.6 3 8 3s8-1.3 8-3V5M4 11v6c0 1.7 3.6 3 8 3s8-1.3 8-3v-6" />
      </>
    ),
    infrastructure: (
      <>
        <rect x="3" y="4" width="7" height="6" rx="1.5" />
        <rect x="14" y="4" width="7" height="6" rx="1.5" />
        <rect x="8.5" y="15" width="7" height="6" rx="1.5" />
        <path d="M6.5 10v2h11v-2M12 12v3" />
      </>
    ),
    lock: (
      <>
        <rect x="4" y="10" width="16" height="11" rx="2" />
        <path d="M8 10V7a4 4 0 0 1 8 0v3M12 14v3" />
      </>
    ),
    queue: (
      <>
        <path d="M5 6h14M5 12h14M5 18h9" />
        <circle cx="3" cy="6" r=".5" />
        <circle cx="3" cy="12" r=".5" />
        <circle cx="3" cy="18" r=".5" />
      </>
    ),
    admin: (
      <>
        <circle cx="12" cy="12" r="3" />
        <path d="M19.4 15a1.7 1.7 0 0 0 .3 1.9l.1.1-2.8 2.8-.1-.1a1.7 1.7 0 0 0-1.9-.3 1.7 1.7 0 0 0-1 1.6v.2h-4V21a1.7 1.7 0 0 0-1-1.6 1.7 1.7 0 0 0-1.9.3l-.1.1L4.2 17l.1-.1a1.7 1.7 0 0 0 .3-1.9A1.7 1.7 0 0 0 3 14H2.8v-4H3a1.7 1.7 0 0 0 1.6-1 1.7 1.7 0 0 0-.3-1.9L4.2 7 7 4.2l.1.1a1.7 1.7 0 0 0 1.9.3A1.7 1.7 0 0 0 10 3V2.8h4V3a1.7 1.7 0 0 0 1 1.6 1.7 1.7 0 0 0 1.9-.3l.1-.1L19.8 7l-.1.1a1.7 1.7 0 0 0-.3 1.9 1.7 1.7 0 0 0 1.6 1h.2v4H21a1.7 1.7 0 0 0-1.6 1Z" />
      </>
    ),
    plus: <path d="M12 5v14M5 12h14" />,
    search: (
      <>
        <circle cx="11" cy="11" r="7" />
        <path d="m20 20-4-4" />
      </>
    ),
    upload: (
      <>
        <path d="M12 16V3M7 8l5-5 5 5M4 21h16" />
      </>
    ),
    download: (
      <>
        <path d="M12 3v13M7 11l5 5 5-5M4 21h16" />
      </>
    ),
    link: (
      <>
        <path d="M10 14a4 4 0 0 0 5.7 0l3-3a4 4 0 0 0-5.7-5.7l-1.7 1.7" />
        <path d="M14 10a4 4 0 0 0-5.7 0l-3 3a4 4 0 0 0 5.7 5.7l1.7-1.7" />
      </>
    ),
    edit: (
      <>
        <path d="m4 20 4.5-1 10-10a2.1 2.1 0 0 0-3-3l-10 10zM14 7l3 3" />
      </>
    ),
    trash: (
      <>
        <path d="M4 7h16M9 7V4h6v3M7 7l1 14h8l1-14M10 11v6M14 11v6" />
      </>
    ),
    close: <path d="M6 6l12 12M18 6 6 18" />,
    menu: <path d="M4 7h16M4 12h16M4 17h16" />,
    arrow: <path d="m9 18 6-6-6-6" />,
    refresh: (
      <>
        <path d="M20 7v5h-5M4 17v-5h5" />
        <path d="M18 12a6 6 0 0 0-10.5-4M6 12a6 6 0 0 0 10.5 4" />
      </>
    ),
    check: <path d="m5 12 4 4L19 6" />,
    alert: (
      <>
        <path d="M12 3 2.5 20h19z" />
        <path d="M12 9v5M12 17.5h.01" />
      </>
    ),
    eye: (
      <>
        <path d="M2.5 12s3.5-6 9.5-6 9.5 6 9.5 6-3.5 6-9.5 6-9.5-6-9.5-6Z" />
        <circle cx="12" cy="12" r="2.5" />
      </>
    ),
    history: (
      <>
        <path d="M3 12a9 9 0 1 0 3-6.7L3 8" />
        <path d="M3 3v5h5M12 7v5l3 2" />
      </>
    ),
  };
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={strokeWidth}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      {paths[name] || paths.dashboard}
    </svg>
  );
}

function statusTone(status: string) {
  const normalized = status.toLowerCase();
  if (
    ["pago", "ativo", "ativa", "publicado", "conferido", "recebida", "vigente", "aprovada", "concluída", "concluida", "encerrada", "processado com sucesso", "validado internamente"].some(
      (word) => normalized.includes(word),
    )
  )
    return "success";
  if (
    ["vencido", "bloqueado", "divergência", "rejeitada", "rejeitado", "reprovada", "reprovado", "ocioso", "cancelado"].some(
      (word) => normalized.includes(word),
    )
  )
    return "danger";
  if (
    ["pendente", "parcial", "aguardando", "aberta", "em correção", "em correcao", "em manutenção", "em manutencao", "em análise", "em configuração", "em conferência", "vence"].some(
      (word) => normalized.includes(word),
    )
  )
    return "warning";
  return "neutral";
}

function purchaseStatusLabel(status: unknown) {
  const normalized = normalizedWorkflowText(status);
  if (
    normalized.includes("reprovad") ||
    normalized.includes("rejeitad") ||
    normalized.includes("cancelad")
  ) {
    return "Reprovado";
  }
  if (
    normalized.includes("aprovad") ||
    normalized.includes("comprad") ||
    normalized.includes("recebid")
  ) {
    return "Aprovado";
  }
  return "Aguardando análise";
}

function recordStatusLabel(record: StoredRecord) {
  return record.module === "purchases"
    ? purchaseStatusLabel(record.status)
    : record.status || "Sem status";
}

type ManagementQueue = "validation" | "rejected" | "missing";
type ManagementDecision = "approve" | "reject";

const managementModules = new Set([
  "purchases",
  "expenses",
  "cards",
]);

function normalizedWorkflowText(value: unknown) {
  return String(value || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim()
    .toLowerCase();
}

function isDemoRecord(record: StoredRecord) {
  const source = normalizedWorkflowText(record.source);
  const reference = normalizedWorkflowText(record.reference);
  return (
    source.includes("demonstracao") ||
    source.includes("dados ficticios") ||
    source.includes("ficticio") ||
    reference.startsWith("tst-") ||
    record.payload.isDemo === true
  );
}

function isManagementRequest(record: StoredRecord) {
  return managementModules.has(record.module);
}

function requestDecisionState(record: StoredRecord) {
  const explicitDecision = normalizedWorkflowText(
    record.payload.managementDecision,
  );
  const approval = normalizedWorkflowText(record.payload.approval);
  const status = normalizedWorkflowText(record.status);

  if (
    explicitDecision === "rejected" ||
    ["rejeitad", "reprovad"].some(
      (term) => approval.includes(term) || status.includes(term),
    )
  ) {
    return "rejected";
  }
  if (
    explicitDecision === "approved" ||
    ["aprovad"].some(
      (term) => approval.includes(term) || status.includes(term),
    )
  ) {
    return "approved";
  }
  return "pending";
}

function requestIsReadyForManagement(record: StoredRecord) {
  const status = normalizedWorkflowText(record.status);
  const approval = normalizedWorkflowText(record.payload.approval);
  if (requestDecisionState(record) !== "pending") return false;

  if (record.module === "purchases") {
    return !status.includes("cancelad");
  }
  if (record.module === "cards") {
    return (
      approval === "pendente" &&
      ["pendente", "documento pendente", "em analise"].includes(status)
    );
  }
  return (
    approval === "pendente" ||
    ["pendente", "aguardando aprovacao", "aguardando validacao", "em analise"].includes(status)
  );
}

function requiredRequestDocument(record: StoredRecord) {
  if (record.module === "purchases") {
    return {
      label: "Orçamentos ou pedido de compra",
      value: record.payload.documentsUrl,
    };
  }
  if (record.module === "expenses") {
    return {
      label: "Nota fiscal, boleto ou cobrança",
      value: record.payload.invoiceUrl,
    };
  }
  if (record.module === "cards") {
    return {
      label: "Nota fiscal ou recibo",
      value: record.payload.documentUrl,
    };
  }
  return {
    label: "Documento comprobatório",
    value: undefined,
  };
}

function requestHasRequiredDocument(record: StoredRecord) {
  return Boolean(String(requiredRequestDocument(record).value || "").trim());
}

function requestOwner(record: StoredRecord) {
  return String(
    record.payload.requester ||
      record.payload.responsible ||
      record.payload.holder ||
      record.payload.companyName ||
      "Responsável não informado",
  );
}

function requestApprovedStatus(record: StoredRecord) {
  if (record.module === "expenses") return "Aguardando validação";
  if (record.module === "cards") return "Conferida";
  if (record.module === "purchases") return "Aprovado";
  return "Aprovada";
}

function requestRejectedStatus(record: StoredRecord) {
  if (record.module === "expenses") return "Reprovado";
  if (record.module === "purchases") return "Reprovado";
  return "Reprovada";
}

function InfrastructureCenter({ canEdit }: { canEdit: boolean }) {
  const [status, setStatus] = useState<ErpCoreStatus | null>(null);
  const [checking, setChecking] = useState(true);
  const [migrating, setMigrating] = useState(false);
  const [migrationMessage, setMigrationMessage] = useState("");

  async function checkStatus() {
    setChecking(true);
    try {
      const response = await fetch("/api/erp-core/status", {
        cache: "no-store",
      });
      const result = (await response.json()) as ErpCoreStatus;
      setStatus(result);
    } catch {
      setStatus({
        configured: false,
        connected: false,
        mode: "STATUS_UNAVAILABLE",
        message:
          "Não foi possível verificar a infraestrutura neste momento.",
        checkedAt: new Date().toISOString(),
        checks: {
          portal: true,
          postgres: false,
          redis: false,
          worker: false,
          xmlSigner: false,
        },
      });
    } finally {
      setChecking(false);
    }
  }

  useEffect(() => {
    let cancelled = false;
    fetch("/api/erp-core/status", { cache: "no-store" })
      .then(async (response) => {
        const result = (await response.json()) as ErpCoreStatus;
        if (!cancelled) setStatus(result);
      })
      .catch(() => {
        if (cancelled) return;
        setStatus({
          configured: false,
          connected: false,
          mode: "STATUS_UNAVAILABLE",
          message:
            "Não foi possível verificar a infraestrutura neste momento.",
          checkedAt: new Date().toISOString(),
          checks: {
            portal: true,
            postgres: false,
            redis: false,
            worker: false,
            xmlSigner: false,
          },
        });
      })
      .finally(() => {
        if (!cancelled) setChecking(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  async function migrateOperationalRecords() {
    if (!canEdit || !status?.connected) return;
    setMigrating(true);
    setMigrationMessage("");
    try {
      const response = await fetch("/api/erp-core/migrate", {
        method: "POST",
      });
      const result = (await response.json()) as {
        message?: string;
        error?: string;
      };
      if (!response.ok) {
        throw new Error(result.error || "A migração não foi concluída.");
      }
      setMigrationMessage(
        result.message || "Migração concluída para conferência.",
      );
    } catch (error) {
      setMigrationMessage(
        error instanceof Error
          ? error.message
          : "A migração não foi concluída.",
      );
    } finally {
      setMigrating(false);
    }
  }

  const components = [
    {
      key: "portal" as const,
      title: "Portal Cloudflare",
      detail: "Interface pública, autenticação administrativa e operação atual no D1.",
      icon: "dashboard",
    },
    {
      key: "postgres" as const,
      title: "PostgreSQL multiempresa",
      detail: "Dados transacionais com RLS obrigatório por empresa e migrações versionadas.",
      icon: "database",
    },
    {
      key: "redis" as const,
      title: "Redis & BullMQ",
      detail: "Fluxos pai/filhos, retentativas exponenciais e jobs idempotentes por lote.",
      icon: "queue",
    },
    {
      key: "worker" as const,
      title: "Workers dedicados",
      detail: "Entradas congeladas, lotes paralelos de 250 e consolidação final auditável.",
      icon: "payroll",
    },
    {
      key: "xmlSigner" as const,
      title: "Assinatura XML",
      detail: "AES-256-GCM em repouso e XMLDSig RSA-SHA256 com certificado A1.",
      icon: "lock",
    },
  ];

  const checklist = [
    ["Execução", "API NestJS e worker em contêineres independentes", "Código preparado"],
    ["Banco", "PostgreSQL gerenciado, backup e recuperação ponto no tempo", status?.checks.postgres ? "Conectado" : "Provisionar"],
    ["Fila", "Redis gerenciado com persistência e política noeviction", status?.checks.redis ? "Conectado" : "Provisionar"],
    ["Rede", "Subdomínio HTTPS exclusivo para a API e acesso restrito", status?.configured ? "Configuração registrada" : "Configurar"],
    ["Segredos", "HMAC, chave AES e credenciais em cofre do provedor", status?.configured ? "Registrados" : "Configurar"],
    ["Certificado", "A1 no cofre ou conector externo para A3/HSM", status?.checks.xmlSigner ? "Configurado" : "Definir A1 ou A3"],
    ["Governo", "Homologação, XSD vigente, procuração e transmissão", "Etapa posterior"],
  ];

  return (
    <div className="infrastructure-page">
      <section className="infrastructure-hero">
        <div>
          <span className="eyebrow">ARQUITETURA • ESCALA • SEGURANÇA</span>
          <h1>Núcleo ERP & Infraestrutura</h1>
          <p>
            Central de ativação do backend corporativo que trabalhará junto ao
            portal atual sem interromper a operação no Cloudflare D1.
          </p>
        </div>
        <div className={`core-mode ${status?.connected ? "online" : "pending"}`}>
          <span><i /></span>
          <div>
            <small>MODO ATUAL</small>
            <strong>
              {status?.connected
                ? "Núcleo ERP conectado"
                : "Portal operando no D1"}
            </strong>
            <p>{status?.message || "Verificando componentes…"}</p>
          </div>
        </div>
      </section>

      <aside className="infrastructure-boundary">
        <Icon name="alert" size={20} />
        <div>
          <strong>Código pronto não significa infraestrutura provisionada</strong>
          <p>
            PostgreSQL, Redis, API, workers, DNS, cofre de segredos e certificado
            precisam existir em uma conta de nuvem da empresa. Até a homologação,
            o portal continua usando o D1 como fonte operacional.
          </p>
        </div>
        <button
          className="button secondary"
          onClick={() => void checkStatus()}
          disabled={checking}
        >
          <Icon name="refresh" size={16} />
          {checking ? "Verificando…" : "Verificar agora"}
        </button>
      </aside>

      <section className="infrastructure-flow" aria-label="Arquitetura do núcleo ERP">
        <article className="flow-node portal">
          <span><Icon name="dashboard" size={22} /></span>
          <div>
            <small>CAMADA DE EXPERIÊNCIA</small>
            <strong>Beta Gestão 365</strong>
            <p>Cloudflare Workers + D1</p>
          </div>
        </article>
        <span className="flow-connector">
          <Icon name="lock" size={16} />
          HMAC + HTTPS
        </span>
        <article className="flow-node core">
          <span><Icon name="infrastructure" size={22} /></span>
          <div>
            <small>BACKEND CORPORATIVO</small>
            <strong>API NestJS</strong>
            <p>Contratos, validação e idempotência</p>
          </div>
        </article>
        <span className="flow-connector">
          <Icon name="queue" size={16} />
          Jobs
        </span>
        <article className="flow-node workers">
          <span><Icon name="payroll" size={22} /></span>
          <div>
            <small>PROCESSAMENTO</small>
            <strong>Workers BullMQ</strong>
            <p>Folha e assinatura fiscal</p>
          </div>
        </article>
      </section>

      <section className="infrastructure-status-grid">
        {components.map((component) => {
          const operational = Boolean(status?.checks[component.key]);
          return (
            <article key={component.key}>
              <span className="component-icon">
                <Icon name={component.icon} size={20} />
              </span>
              <span className={`component-state ${operational ? "ok" : "wait"}`}>
                {operational ? "Operacional" : component.key === "portal" ? "Operacional" : "Pendente"}
              </span>
              <strong>{component.title}</strong>
              <p>{component.detail}</p>
            </article>
          );
        })}
      </section>

      <div className="infrastructure-columns">
        <section className="content-card provisioning-card">
          <div className="card-heading">
            <div>
              <span className="eyebrow">ATIVAÇÃO CONTROLADA</span>
              <h2>O que precisa ser contratado e configurado</h2>
            </div>
            <span className="status-pill neutral">
              {status?.configured ? "Ponte configurada" : "Aguardando provedor"}
            </span>
          </div>
          <div className="provisioning-table">
            {checklist.map(([category, requirement, state]) => (
              <article key={category}>
                <strong>{category}</strong>
                <p>{requirement}</p>
                <span className={
                  ["Conectado", "Registrados", "Código preparado", "Configuração registrada"].includes(state)
                    ? "done"
                    : "pending"
                }>
                  {state}
                </span>
              </article>
            ))}
          </div>
        </section>

        <section className="content-card cutover-card">
          <div className="card-heading">
            <div>
              <span className="eyebrow">MIGRAÇÃO SEM PARADA</span>
              <h2>Plano de corte D1 → PostgreSQL</h2>
            </div>
          </div>
          <ol className="cutover-steps">
            <li className="active">
              <span>1</span>
              <div><strong>Preparar</strong><p>Código, tabelas, RLS, filas e ponte segura.</p></div>
            </li>
            <li className={status?.connected ? "active" : ""}>
              <span>2</span>
              <div><strong>Conectar</strong><p>Ativar API, PostgreSQL, Redis e workers.</p></div>
            </li>
            <li>
              <span>3</span>
              <div><strong>Copiar e conferir</strong><p>Migrar apenas dados reais; testes ficam no D1.</p></div>
            </li>
            <li>
              <span>4</span>
              <div><strong>Homologar e cortar</strong><p>Conferência contábil, backup e troca da fonte oficial.</p></div>
            </li>
          </ol>
          {canEdit ? (
            <button
              className="button primary migration-button"
              onClick={() => void migrateOperationalRecords()}
              disabled={!status?.connected || migrating}
            >
              <Icon name="database" size={17} />
              {migrating ? "Copiando registros…" : "Copiar dados reais para homologação"}
            </button>
          ) : (
            <span className="read-only-chip">
              <Icon name="eye" size={16} /> Migração restrita ao administrador
            </span>
          )}
          {!status?.connected ? (
            <small className="migration-help">
              O botão será liberado quando PostgreSQL, Redis e workers responderem
              como prontos.
            </small>
          ) : null}
          {migrationMessage ? (
            <p className="migration-message">{migrationMessage}</p>
          ) : null}
        </section>
      </div>

      <section className="content-card infrastructure-security">
        <div>
          <span><Icon name="lock" size={22} /></span>
          <div>
            <small>SEGURANÇA MULTIEMPRESA</small>
            <strong>Defesa em profundidade aplicada à base</strong>
          </div>
        </div>
        <ul>
          <li>RLS obrigatório no PostgreSQL, inclusive para o proprietário das tabelas.</li>
          <li>Assinatura HMAC de cada chamada entre portal e núcleo, com validade de cinco minutos.</li>
          <li>Chave idempotente em toda operação de escrita e retentativas controladas nas filas.</li>
          <li>Entradas da folha congeladas, hash por lote e fechamento somente após a consolidação total.</li>
          <li>Dados sensíveis e XMLs cifrados em AES-256-GCM; segredos nunca aparecem na interface.</li>
          <li>Auditoria append-only encadeada por SHA-256 e verificação de integridade por empresa.</li>
        </ul>
      </section>
    </div>
  );
}

/*
 * A coluna "Referência" do contracheque.
 *
 * Mostra a QUANTIDADE quando a verba é medida (horas trabalhadas, horas
 * extras) e a ALÍQUOTA quando é percentual (INSS, IRRF, FGTS, patronal).
 * Verba de valor fixo informado aparece como 1,00 — uma ocorrência —, que
 * é como o contracheque de referência do cliente as apresenta.
 *
 * Duas casas decimais sempre, inclusive em números redondos: numa coluna
 * de conferência, "8" e "8,00" alinhados de formas diferentes atrapalham a
 * leitura de cima para baixo.
 */
function formatReference(line: PayrollLine) {
  const numero = line.reference ?? (line.amount ? 1 : 0);
  if (!numero) return "—";

  const formatado = numero.toLocaleString("pt-BR", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });

  /*
   * A unidade fica ao lado do número porque a coluna mistura naturezas:
   * 220,00 são horas e 9,06 é percentual. Sem a marca, quem confere
   * precisa saber de cor qual verba é qual — e é justamente quem está
   * aprendendo a conferir que mais precisa da tela.
   *
   * "un." é ocorrência: verba de valor fixo, lançada uma vez.
   */
  const unidade = line.referenceUnit ?? "un";
  return `${formatado} ${unidade === "un" ? "un." : unidade}`;
}

function formatValue(field: ModuleField | undefined, value: unknown) {
  if (value === null || value === undefined || value === "") return "—";
  if (field?.type === "currency") return currency.format(Number(value || 0));
  if (field?.type === "date") {
    const date = new Date(`${String(value).slice(0, 10)}T12:00:00`);
    return Number.isNaN(date.getTime())
      ? String(value)
      : date.toLocaleDateString("pt-BR");
  }
  return String(value);
}

function isPending(record: StoredRecord) {
  const status = record.status.toLowerCase();
  return [
    "pendente",
    "aguardando",
    "vencido",
    "vence",
    "divergência",
    "em análise",
    "em conferência",
    "em manutenção",
    "em correção",
    "aberta",
    "ocioso",
    "bloqueado",
  ].some((word) => status.includes(word));
}

const referencePrefixes: Record<string, string> = {
  works: "OBRA",
  worklogs: "RDO",
  suppliers: "FORN",
  expenses: "PAG",
  cards: "CARTAO",
  rentals: "IMOV",
  assets: "ATIVO",
  asset_events: "OCO",
  people: "COLAB",
  food: "REF",
  taxes: "IMP",
  purchases: "COMPRA",
  documents: "DOC",
  compliance: "EVENTO",
  rules: "REGRA",
};

const actionLabels: Record<string, string> = {
  works: "Cadastrar obra",
  worklogs: "Registrar diário de obra",
  suppliers: "Cadastrar fornecedor",
  expenses: "Cadastrar pagamento",
  cards: "Registrar despesa",
  rentals: "Cadastrar imóvel",
  assets: "Cadastrar máquina",
  asset_events: "Registrar manutenção ou ociosidade",
  people: "Cadastrar colaborador",
  food: "Registrar alimentação",
  taxes: "Cadastrar imposto",
  compliance: "Cadastrar evento",
  rules: "Cadastrar regra",
  purchases: "Criar solicitação",
  documents: "Cadastrar documento",
  emails: "Planejar e-mail",
  m365: "Registrar integração",
};

function generateReference(moduleId: string) {
  const now = new Date();
  const day = [
    now.getFullYear(),
    String(now.getMonth() + 1).padStart(2, "0"),
    String(now.getDate()).padStart(2, "0"),
  ].join("");
  const suffix = String(now.getTime()).slice(-5);
  return `${referencePrefixes[moduleId] || "REG"}-${day}-${suffix}`;
}

const peopleFormSections = [
  {
    id: "identity",
    label: "Identidade",
    description: "Dados civis, filiação, escolaridade e informações para eSocial.",
    fields: ["employeeCode", "registration", "name", "photoUrl", "sex", "birthDate", "birthCity", "birthCountry", "nationality", "maritalStatus", "propertyRegime", "fatherName", "motherName", "education", "raceColor", "disabilityStatus", "disabilityType", "disabilityQuota", "disabilityNotes"],
  },
  {
    id: "documents",
    label: "Documentos",
    description: "Documentos trabalhistas, eleitorais, de saúde, habilitação e imigração.",
    fields: ["cpf", "cpfVerificationStatus", "cpfVerificationDate", "cpfProofUrl", "pis", "pisRegistrationDate", "rgNumber", "rgIssuer", "rgState", "rgIssueDate", "voterNumber", "voterZone", "voterSection", "voterState", "ctpsNumber", "ctpsSeries", "ctpsState", "ctpsIssueDate", "cnhNumber", "cnhCategory", "cnhState", "cnhValidity", "cns", "passportNumber", "passportCountry", "passportValidity", "visaType", "visaValidity", "documentsUrl"],
  },
  {
    id: "contacts",
    label: "Contatos",
    description: "Canais de contato, endereço residencial, Folga de Campo e acesso corporativo.",
    fields: ["phone", "personalEmail", "corporateEmail", "emergencyContact", "address", "addressNumber", "addressComplement", "district", "city", "state", "postalCode", "livesOutOfTown", "homeCity", "fieldLeaveCountFrom", "accessProfile"],
  },
  {
    id: "dependents",
    label: "Dependentes",
    description: "Dependentes declarados, vínculo familiar e referências para IRRF.",
    fields: ["dependents", "dependentDetails"],
  },
  {
    id: "contract",
    label: "Contrato",
    description: "Vínculo, admissão, cargo, sindicato, remuneração e dados bancários.",
    fields: ["status", "contractType", "admissionType", "admissionDate", "esocialRegistration", "employmentGroup", "department", "workplace", "role", "cbo", "roleStartDate", "manager", "leader", "union", "collectiveAgreement", "salaryType", "monthlyHours", "salary", "bankData", "occupationalExamValidity"],
  },
  {
    id: "journey",
    label: "Jornada de Trabalho",
    description: "Jornada, escala, regime, local de trabalho e vínculo com o futuro sistema de ponto.",
    fields: ["scheduleStartDate", "weeklyHours", "restDay", "workRegime", "journeyType", "weeklySchedule", "flexibleHours", "partTimeContract", "timeClockEmployeeId", "timeClockSyncStatus", "lastTimeClockSync"],
  },
  {
    id: "termination",
    label: "Rescisão",
    description: "Aviso prévio, desligamento, término contratual e informações para eSocial.",
    fields: ["terminationDate", "terminationReason", "terminationType", "noticeType", "noticeNotificationDate", "noticeStartDate", "noticeDays", "expectedContractEnd", "judicialProcess", "esocialTerminationNotes", "notes"],
  },
] as const;

function Modal({
  module,
  record,
  assets,
  onClose,
  onSave,
  saving,
}: {
  module: ModuleDefinition;
  record: StoredRecord | null;
  assets: StoredRecord[];
  onClose: () => void;
  onSave: (payload: Record<string, unknown>) => Promise<void>;
  saving: boolean;
}) {
  const { visible: showInternalCodes, toggle: toggleInternalCodes } =
    useContext(InternalCodeVisibilityContext);
  const referenceField = module.fields.find(
    (field) => field.key === module.referenceField,
  );
  const hasAutomaticReference =
    referenceField?.type === "text" && Boolean(referencePrefixes[module.id]);
  const [payload, setPayload] = useState<Record<string, unknown>>(() => {
    if (record) return { ...record.payload };
    const initial: Record<string, unknown> = {};
    for (const field of module.fields) {
      if (
        hasAutomaticReference &&
        field.key === module.referenceField
      ) {
        initial[field.key] = generateReference(module.id);
      } else if (field.type === "select" && field.options?.length) {
        initial[field.key] = field.options[0];
      } else {
        initial[field.key] = "";
      }
    }
    return initial;
  });
  const [error, setError] = useState("");
  const [peopleTab, setPeopleTab] = useState("identity");
  const activePeopleSection = peopleFormSections.find(
    (section) => section.id === peopleTab,
  ) || peopleFormSections[0];
  const autoCalculatedWorklogFields = [
    "ownTeamCount",
    "progressDelta",
    "progressPercentAfter",
    "work",
    "workCode",
  ];
  const availableFields = module.fields.filter(
    (field) =>
      (showInternalCodes || !isInternalCodeField(module, field.key)) &&
      !(
        module.id === "worklogs" &&
        autoCalculatedWorklogFields.includes(field.key)
      ),
  );
  const sectionFields =
    module.id === "people"
      ? availableFields.filter((field) =>
          (activePeopleSection.fields as readonly string[]).includes(field.key),
        )
      : availableFields;
  /*
   * Campos que só aparecem depois de uma resposta — hoje, a cidade de
   * origem e a data-base da Folga de Campo, que só valem para quem mora
   * fora da cidade da obra.
   *
   * O valor lido é o do formulário aberto, não o do registro salvo, para o
   * campo surgir no mesmo instante em que a pessoa marca "Sim".
   */
  const visibleFields = sectionFields.filter(
    (field) =>
      !field.showWhen ||
      String(payload[field.showWhen.field] ?? "").trim() ===
        field.showWhen.equals,
  );
  const isPeopleFieldStarted = (key: string) => {
    if (key === module.referenceField) return false;
    const field = module.fields.find((candidate) => candidate.key === key);
    const value = String(payload[key] ?? "").trim();
    if (!value) return false;
    if (field?.type === "select" && field.options?.[0] === value) return false;
    return true;
  };
  const completedPeopleSections =
    module.id === "people"
      ? peopleFormSections.filter((section) =>
          section.fields.some((key) => isPeopleFieldStarted(key)),
        ).length
      : 0;
  const recalculateAssetOccurrence = (
    next: Record<string, unknown>,
  ): Record<string, unknown> => {
    if (module.id !== "asset_events") return next;
    const rentalValue = Math.max(0, Number(next.rentalValue || 0));
    const rentalPeriodDays = Math.max(
      0,
      Math.floor(Number(next.rentalPeriodDays || 0)),
    );
    const idleDays = Math.max(0, Math.floor(Number(next.idleDays || 0)));
    const dailyRentalRate =
      rentalPeriodDays > 0 ? rentalValue / rentalPeriodDays : 0;
    const roundMoney = (value: number) => Math.round(value * 100) / 100;
    return {
      ...next,
      dailyRentalRate: roundMoney(dailyRentalRate),
      estimatedDowntimeLoss: roundMoney(dailyRentalRate * idleDays),
    };
  };

  async function submit(event: FormEvent) {
    event.preventDefault();
    const missing = visibleFields.find(
      (field) => field.required && !String(payload[field.key] ?? "").trim(),
    );
    if (missing) {
      setError(
        `Só falta preencher “${missing.label}”. Os campos com * são necessários para salvar.`,
      );
      return;
    }
    await onSave(payload);
  }

  return (
    <div className="modal-backdrop" role="presentation" onMouseDown={onClose}>
      <section
        className="modal-panel"
        role="dialog"
        aria-modal="true"
        aria-label={`${record ? "Editar" : "Novo"} registro de ${module.label}`}
        onMouseDown={(event) => event.stopPropagation()}
      >
        <header className="modal-header">
          <div>
            <span className="eyebrow">{module.eyebrow}</span>
            <h2>
              {record
                ? "Editar informações"
                : actionLabels[module.id] || "Novo registro"}
            </h2>
            <p>{module.label}</p>
          </div>
          <button className="icon-button" onClick={onClose} aria-label="Fechar">
            <Icon name="close" />
          </button>
        </header>
        <form onSubmit={submit}>
          <div className={`form-welcome ${module.id === "people" ? "people-welcome" : ""}`}>
            <span>
              <Icon name="check" size={18} />
            </span>
            <div>
              <strong>{module.id === "people" ? "Ficha profissional do colaborador" : "Preenchimento simples e seguro"}</strong>
              <p>
                {module.id === "people"
                  ? `${completedPeopleSections} de ${peopleFormSections.length} áreas iniciadas. Navegue pelas abas e salve a ficha completa ao final.`
                  : "Informe o que você souber. Campos com * são obrigatórios e os identificadores técnicos são preenchidos pelo sistema."}
              </p>
            </div>
            <button
              type="button"
              className={`internal-code-toggle ${showInternalCodes ? "active" : ""}`}
              onClick={toggleInternalCodes}
            >
              <Icon name={showInternalCodes ? "eye" : "lock"} size={15} />
              {showInternalCodes
                ? "Ocultar identificadores"
                : "Mostrar identificadores"}
            </button>
          </div>
          {module.id === "people" ? (
            <>
              <nav className="people-form-tabs" aria-label="Áreas da ficha do colaborador">
                {peopleFormSections.map((section, index) => {
                  const started = section.fields.some((key) =>
                    isPeopleFieldStarted(key),
                  );
                  return (
                    <button
                      key={section.id}
                      type="button"
                      className={peopleTab === section.id ? "active" : ""}
                      onClick={() => setPeopleTab(section.id)}
                    >
                      <span>{started ? "✓" : index + 1}</span>
                      {section.label}
                    </button>
                  );
                })}
              </nav>
              <div className="people-section-heading">
                <div>
                  <span className="eyebrow">FICHA DO COLABORADOR</span>
                  <h3>{activePeopleSection.label}</h3>
                  <p>{activePeopleSection.description}</p>
                </div>
                <strong>{visibleFields.length} campos</strong>
              </div>
              {peopleTab === "journey" ? (
                <div className="time-clock-integration-card">
                  <span><Icon name="refresh" size={20} /></span>
                  <div>
                    <strong>Integração com o sistema de ponto</strong>
                    <p>
                      A jornada cadastrada aqui será comparada às marcações reais.
                      A sincronização identificará atrasos, faltas, horas extras,
                      intervalos e divergências para o cálculo da folha.
                    </p>
                  </div>
                  <button type="button" disabled>
                    Conector aguardando o módulo de ponto
                  </button>
                </div>
              ) : null}
              {peopleTab === "documents" ? (
                <div className="official-cpf-card">
                  <span><Icon name="lock" size={20} /></span>
                  <div>
                    <strong>Consulta oficial da situação cadastral do CPF</strong>
                    <p>
                      Abra a Receita Federal, informe CPF e data de nascimento e
                      registre abaixo somente a situação exibida. A consulta não
                      informa renda, patrimônio ou regularidade fiscal.
                    </p>
                  </div>
                  <a
                    href="https://servicos.receita.fazenda.gov.br/servicos/cpf/consultasituacao/consultapublica.asp"
                    target="_blank"
                    rel="noreferrer"
                  >
                    Consultar na Receita ↗
                  </a>
                </div>
              ) : null}
            </>
          ) : null}
          <div className="form-grid">
            {visibleFields.map((field) => {
              const automatic =
                hasAutomaticReference &&
                field.key === module.referenceField;
              const linkedAssetName =
                module.id === "asset_events" &&
                field.key === "assetName" &&
                assets.length > 0;
              const activeAssets = assets.filter(
                (asset) => asset.status === "Em uso",
              );
              const linkedWorklogAsset =
                module.id === "worklogs" && field.key === "assetName";
              const calculatedAssetField =
                module.id === "asset_events" &&
                [
                  "assetId",
                  "work",
                  "rentalValue",
                  "rentalPeriodDays",
                  "dailyRentalRate",
                  "estimatedDowntimeLoss",
                ].includes(field.key);
              const materialCategoryField =
                module.id === "purchases" && field.key === "materialCategory";
              return (
                <label
                  key={field.key}
                  className={`form-field ${field.wide ? "wide" : ""} ${
                    automatic ? "automatic" : ""
                  }`}
                >
                <span>
                  {field.label}
                  {field.required ? <b> *</b> : null}
                </span>
                {linkedWorklogAsset ? (
                  <select
                    value={String(payload.assetId ?? "")}
                    onChange={(event) => {
                      const selected = activeAssets.find(
                        (asset) =>
                          String(asset.payload.assetId || asset.reference) ===
                          event.target.value,
                      );
                      setPayload((current) => ({
                        ...current,
                        assetName: selected
                          ? String(selected.payload.description || selected.title)
                          : "",
                        assetId: selected
                          ? String(selected.payload.assetId || selected.reference)
                          : "",
                      }));
                    }}
                  >
                    <option value="">
                      {activeAssets.length
                        ? "Selecione a máquina em uso"
                        : "Nenhuma máquina ativa em uso no momento"}
                    </option>
                    {activeAssets.map((asset) => {
                      const name = String(
                        asset.payload.description || asset.title,
                      );
                      const assetId = String(
                        asset.payload.assetId || asset.reference,
                      );
                      return (
                        <option key={asset.id} value={assetId}>
                          {name}
                          {showInternalCodes ? ` • ${assetId}` : ""}
                        </option>
                      );
                    })}
                  </select>
                ) : linkedAssetName ? (
                  <select
                    value={String(payload.assetId ?? "")}
                    onChange={(event) => {
                      const selected = assets.find(
                        (asset) =>
                          String(asset.payload.assetId || asset.reference) ===
                          event.target.value,
                      );
                      setPayload((current) =>
                        recalculateAssetOccurrence({
                          ...current,
                          assetName: selected
                            ? String(selected.payload.description || selected.title)
                            : "",
                          assetId: selected
                            ? String(selected.payload.assetId || selected.reference)
                            : "",
                          work: selected
                            ? String(selected.payload.work || "")
                            : "",
                          rentalValue: selected
                            ? Number(selected.payload.monthlyCost || selected.amount || 0)
                            : 0,
                          rentalPeriodDays: selected
                            ? Number(selected.payload.rentalPeriodDays || 0)
                            : 0,
                        }),
                      );
                    }}
                  >
                    <option value="">Selecione a máquina cadastrada</option>
                    {assets.map((asset) => {
                      const name = String(
                        asset.payload.description || asset.title,
                      );
                      const assetId = String(
                        asset.payload.assetId || asset.reference,
                      );
                      return (
                        <option key={asset.id} value={assetId}>
                          {name}
                          {showInternalCodes ? ` • ${assetId}` : ""}
                        </option>
                      );
                    })}
                  </select>
                ) : field.type === "textarea" ? (
                  <textarea
                    rows={3}
                    value={String(payload[field.key] ?? "")}
                    placeholder={field.placeholder}
                    onChange={(event) =>
                      setPayload((current) => ({
                        ...current,
                        [field.key]: event.target.value,
                      }))
                    }
                  />
                ) : materialCategoryField ? (
                  <select
                    value={String(payload[field.key] ?? "")}
                    onChange={(event) => {
                      const category = event.target.value;
                      setPayload((current) => ({
                        ...current,
                        materialCategory: category,
                        unit:
                          purchaseMaterialUnits[category] ||
                          String(current.unit ?? ""),
                      }));
                    }}
                  >
                    {(field.options || []).map((option) => (
                      <option key={option}>{option}</option>
                    ))}
                  </select>
                ) : field.type === "select" ? (
                  <select
                    value={String(payload[field.key] ?? "")}
                    onChange={(event) =>
                      setPayload((current) => ({
                        ...current,
                        [field.key]: event.target.value,
                      }))
                    }
                  >
                    {(field.options || []).map((option) => (
                      <option key={option}>{option}</option>
                    ))}
                  </select>
                ) : (
                  <input
                    type={
                      field.type === "currency" || field.type === "number"
                        ? "number"
                        : field.type
                    }
                    step={field.type === "currency" ? "0.01" : undefined}
                    value={String(payload[field.key] ?? "")}
                    placeholder={field.placeholder}
                    readOnly={
                      automatic || calculatedAssetField
                    }
                    onChange={(event) =>
                      setPayload((current) => {
                        const next = {
                          ...current,
                          [field.key]:
                          field.type === "currency" || field.type === "number"
                            ? event.target.value === ""
                              ? ""
                              : Number(event.target.value)
                            : event.target.value,
                        };
                        return field.key === "idleDays"
                          ? recalculateAssetOccurrence(next)
                          : next;
                      })
                    }
                  />
                )}
                {field.help || automatic || calculatedAssetField ? (
                  <small className="field-help">
                    {automatic
                      ? "Este código é criado pelo sistema para identificar o registro."
                      : calculatedAssetField
                        ? field.help || "Este valor é preenchido automaticamente pela máquina selecionada."
                        : field.help}
                  </small>
                ) : null}
              </label>
              );
            })}
          </div>
          {error ? <p className="form-error">{error}</p> : null}
          <footer className="modal-footer">
            <button type="button" className="button secondary" onClick={onClose}>
              Cancelar
            </button>
            <button type="submit" className="button primary" disabled={saving}>
              {saving
                ? "Salvando…"
                : record
                  ? "Salvar alterações"
                  : actionLabels[module.id] || "Cadastrar"}
            </button>
          </footer>
        </form>
      </section>
    </div>
  );
}

function LoadingState() {
  return (
    <div className="loading-state">
      <span className="loading-mark" />
      <p>Carregando a central de gestão…</p>
    </div>
  );
}

function RecordDetails({
  module,
  record,
  onClose,
  onEdit,
  canEdit,
  decisionMode = false,
  onDecision,
  decisionSaving = false,
}: {
  module: ModuleDefinition;
  record: StoredRecord;
  onClose: () => void;
  onEdit: () => void;
  canEdit: boolean;
  decisionMode?: boolean;
  onDecision?: (
    record: StoredRecord,
    decision: ManagementDecision,
    reason: string,
  ) => Promise<void>;
  decisionSaving?: boolean;
}) {
  const { visible: showInternalCodes, toggle: toggleInternalCodes } =
    useContext(InternalCodeVisibilityContext);
  const [tab, setTab] = useState<"summary" | "data" | "audit">("summary");
  const [auditLogs, setAuditLogs] = useState<AuditLog[]>([]);
  const [auditLoading, setAuditLoading] = useState(false);
  const [auditError, setAuditError] = useState("");
  const [rejectOpen, setRejectOpen] = useState(false);
  const [rejectReason, setRejectReason] = useState("");
  const [decisionError, setDecisionError] = useState("");
  const populatedFields = module.fields.filter((field) => {
    if (!showInternalCodes && isInternalCodeField(module, field.key)) {
      return false;
    }
    if (module.id === "people" && field.key === "work") return false;
    const value = record.payload[field.key];
    return value !== null && value !== undefined && String(value).trim() !== "";
  });
  const documents = populatedFields.filter((field) => field.type === "url");
  const generalFields = populatedFields.filter((field) => field.type !== "url");
  const displayAmount =
    module.id === "people"
      ? Number(record.payload.salary || 0)
      : Number(record.amount || 0);
  const decisionState = requestDecisionState(record);
  const requiredDocument = requiredRequestDocument(record);
  const hasRequiredDocument = requestHasRequiredDocument(record);

  useEffect(() => {
    if (tab !== "audit" || !canEdit) return;
    const controller = new AbortController();
    fetch(`/api/records?view=audit&recordId=${record.id}`, {
      cache: "no-store",
      signal: controller.signal,
    })
      .then(async (response) => {
        const body = (await response.json()) as {
          audit?: AuditLog[];
          error?: string;
        };
        if (!response.ok) {
          throw new Error(body.error || "Não foi possível carregar a auditoria.");
        }
        setAuditLogs(body.audit || []);
      })
      .catch((error: unknown) => {
        if (controller.signal.aborted) return;
        setAuditError(
          error instanceof Error
            ? error.message
            : "Não foi possível carregar a auditoria.",
        );
      })
      .finally(() => {
        if (!controller.signal.aborted) setAuditLoading(false);
      });
    return () => controller.abort();
  }, [tab, record.id, canEdit]);

  const auditAction = (action: string) => {
    if (action === "CREATE") return { label: "Registro criado", icon: "plus" };
    if (action === "UPDATE") return { label: "Registro atualizado", icon: "edit" };
    if (action === "APPROVE") return { label: "Pedido aprovado", icon: "check" };
    if (action === "REJECT") return { label: "Pedido reprovado", icon: "close" };
    if (action === "DELETE") return { label: "Registro excluído", icon: "trash" };
    if (action === "IMPORT") return { label: "Importação realizada", icon: "upload" };
    return { label: "Evento do sistema", icon: "history" };
  };

  function selectDetailTab(nextTab: "summary" | "data" | "audit") {
    setTab(nextTab);
    if (nextTab === "audit" && canEdit) {
      setAuditLoading(true);
      setAuditError("");
    }
  }

  return (
    <div className="detail-backdrop" role="presentation" onMouseDown={onClose}>
      <aside
        className="detail-panel"
        role="dialog"
        aria-modal="true"
        aria-label={`Detalhes de ${record.title}`}
        onMouseDown={(event) => event.stopPropagation()}
      >
        <header className="detail-header">
          <div className="detail-identity">
            <span style={{ color: module.color, background: module.lightColor }}>
              <Icon name={module.id} size={25} />
            </span>
            <div>
              <small>{module.label}</small>
              <h2>{record.title || "Registro sem título"}</h2>
              {showInternalCodes &&
              hasInternalRecordReference(record.module) ? (
                <p>{record.reference || "Sem identificador"}</p>
              ) : null}
            </div>
          </div>
          <button className="icon-button" onClick={onClose} aria-label="Fechar detalhes">
            <Icon name="close" />
          </button>
        </header>

        <div className="detail-command-bar">
          <span className={`status-pill ${statusTone(recordStatusLabel(record))}`}>
            {recordStatusLabel(record)}
          </span>
          {canEdit ? (
            <div className="detail-command-actions">
              <button
                type="button"
                className={`button secondary compact-button internal-code-button ${
                  showInternalCodes ? "active" : ""
                }`}
                onClick={toggleInternalCodes}
              >
                <Icon name={showInternalCodes ? "eye" : "lock"} size={16} />
                {showInternalCodes
                  ? "Ocultar identificadores"
                  : "Mostrar identificadores"}
              </button>
              <button className="button primary compact-button" onClick={onEdit}>
                <Icon name="edit" size={16} /> Editar registro
              </button>
            </div>
          ) : (
            <span className="read-only-chip">
              <Icon name="eye" size={16} /> Somente consulta
            </span>
          )}
        </div>

        {decisionMode ? (
          <section
            className={`approval-decision-panel ${decisionState} ${
              hasRequiredDocument ? "document-ready" : "document-missing"
            }`}
            aria-label="Decisão gerencial do pedido"
          >
            <header>
              <span className="approval-decision-icon">
                <Icon
                  name={
                    decisionState === "rejected"
                      ? "close"
                      : hasRequiredDocument
                        ? "check"
                        : "alert"
                  }
                  size={21}
                />
              </span>
              <div>
                <span className="eyebrow">CENTRAL DE PEDIDOS</span>
                <h3>
                  {decisionState === "rejected"
                    ? "Pedido reprovado pela gerência"
                    : "Análise e decisão gerencial"}
                </h3>
                <p>
                  Confira o documento, o valor e os dados do pedido antes de
                  registrar a decisão.
                </p>
              </div>
              <span className={`approval-state ${decisionState}`}>
                {decisionState === "rejected"
                  ? "Reprovado"
                  : hasRequiredDocument
                    ? "Pronto para decisão"
                    : "Documento ausente"}
              </span>
            </header>

            <div className="approval-check-grid">
              <div>
                <span>Solicitante / responsável</span>
                <strong>{requestOwner(record)}</strong>
              </div>
              <div>
                <span>Valor submetido</span>
                <strong>
                  {record.amount
                    ? currency.format(record.amount)
                    : "Sem valor informado"}
                </strong>
              </div>
              <div className={hasRequiredDocument ? "ready" : "missing"}>
                <span>Documento obrigatório</span>
                {hasRequiredDocument ? (
                  <a
                    href={String(requiredDocument.value)}
                    target="_blank"
                    rel="noreferrer"
                  >
                    <Icon name="eye" size={15} />
                    Abrir {requiredDocument.label.toLowerCase()}
                  </a>
                ) : (
                  <strong>{requiredDocument.label} ausente</strong>
                )}
              </div>
            </div>

            {decisionState === "rejected" &&
            String(record.payload.managementDecisionReason || "").trim() ? (
              <div className="approval-rejection-history">
                <Icon name="history" size={17} />
                <span>
                  <small>Motivo registrado</small>
                  <strong>
                    {String(record.payload.managementDecisionReason)}
                  </strong>
                </span>
              </div>
            ) : null}

            {!hasRequiredDocument ? (
              <div className="approval-document-warning">
                <Icon name="alert" size={17} />
                <span>
                  <strong>Aprovação bloqueada</strong>
                  <small>
                    Edite o registro e vincule {requiredDocument.label.toLowerCase()}.
                    A reprovação continua disponível para registrar a devolução.
                  </small>
                </span>
              </div>
            ) : null}

            {canEdit && decisionState !== "approved" ? (
              <>
                <div className="approval-actions">
                  <button
                    type="button"
                    className="approval-button approve"
                    disabled={!hasRequiredDocument || decisionSaving}
                    onClick={() =>
                      onDecision?.(record, "approve", "")
                    }
                  >
                    <Icon name="check" size={17} />
                    {decisionSaving
                      ? "Registrando…"
                      : decisionState === "rejected"
                        ? "Aprovar após correção"
                        : "Aprovar pedido"}
                  </button>
                  <button
                    type="button"
                    className="approval-button reject"
                    disabled={decisionSaving}
                    onClick={() => {
                      setRejectOpen((current) => !current);
                      setDecisionError("");
                    }}
                  >
                    <Icon name="close" size={17} />
                    Reprovar pedido
                  </button>
                </div>

                {rejectOpen ? (
                  <div className="approval-reject-form">
                    <label>
                      <span>Motivo da reprovação *</span>
                      <textarea
                        rows={3}
                        value={rejectReason}
                        placeholder="Explique objetivamente o que precisa ser corrigido ou por que o pedido não foi autorizado."
                        onChange={(event) => {
                          setRejectReason(event.target.value);
                          setDecisionError("");
                        }}
                      />
                    </label>
                    {decisionError ? (
                      <p className="approval-decision-error">{decisionError}</p>
                    ) : null}
                    <div>
                      <button
                        type="button"
                        className="button secondary"
                        onClick={() => {
                          setRejectOpen(false);
                          setDecisionError("");
                        }}
                      >
                        Cancelar
                      </button>
                      <button
                        type="button"
                        className="approval-button reject confirm"
                        disabled={decisionSaving}
                        onClick={() => {
                          if (!rejectReason.trim()) {
                            setDecisionError(
                              "Informe o motivo antes de confirmar a reprovação.",
                            );
                            return;
                          }
                          onDecision?.(record, "reject", rejectReason.trim());
                        }}
                      >
                        <Icon name="close" size={16} />
                        Confirmar reprovação
                      </button>
                    </div>
                  </div>
                ) : null}
              </>
            ) : decisionState === "approved" ? (
              <div className="approval-completed">
                <Icon name="check" size={18} />
                Esta solicitação já possui aprovação gerencial registrada.
              </div>
            ) : (
              <div className="approval-completed read-only">
                <Icon name="lock" size={18} />
                Entre como administrador para aprovar ou reprovar pedidos.
              </div>
            )}
          </section>
        ) : null}

        <nav className="detail-tabs" aria-label="Seções do registro">
          {[
            ["summary", "Visão geral"],
            ["data", `Informações (${generalFields.length})`],
            ["audit", "Histórico e auditoria"],
          ].map(([id, label]) => (
            <button
              key={id}
              className={tab === id ? "active" : ""}
              onClick={() =>
                selectDetailTab(id as "summary" | "data" | "audit")
              }
            >
              {label}
            </button>
          ))}
        </nav>

        <div className="detail-content">
          {tab === "summary" ? (
            <>
              <section className="detail-summary-grid">
                <article>
                  <span>Status atual</span>
                  <strong>{recordStatusLabel(record)}</strong>
                </article>
                <article>
                  <span>Data de referência</span>
                  <strong>{formatValue({ type: "date" } as ModuleField, record.recordDate)}</strong>
                </article>
                {module.amountField ? (
                  <article className="highlight">
                    <span>Valor registrado</span>
                    <strong>{currency.format(displayAmount)}</strong>
                  </article>
                ) : null}
                <article>
                  <span>Origem</span>
                  <strong>{record.source || "Sistema web"}</strong>
                </article>
              </section>

              <section className="detail-section">
                <header>
                  <div>
                    <span className="eyebrow">RESUMO OPERACIONAL</span>
                    <h3>Principais informações</h3>
                  </div>
                </header>
                <div className="detail-data-grid">
                  {generalFields.slice(0, 8).map((field) => (
                    <div key={field.key}>
                      <span>{field.label}</span>
                      <strong>{formatValue(field, record.payload[field.key])}</strong>
                    </div>
                  ))}
                </div>
              </section>

              <section className="detail-section">
                <header>
                  <div>
                    <span className="eyebrow">DOCUMENTOS E LINKS</span>
                    <h3>Arquivos relacionados</h3>
                  </div>
                  <span className="soft-badge">{documents.length}</span>
                </header>
                {documents.length ? (
                  <div className="detail-documents">
                    {documents.map((field) => (
                      <a key={field.key} href={String(record.payload[field.key])} target="_blank" rel="noreferrer">
                        <span><Icon name="link" size={17} /></span>
                        <div>
                          <strong>{field.label}</strong>
                          <small>Abrir documento vinculado</small>
                        </div>
                        <Icon name="arrow" size={16} />
                      </a>
                    ))}
                  </div>
                ) : (
                  <p className="detail-empty-note">Nenhum documento foi vinculado a este registro.</p>
                )}
              </section>
            </>
          ) : null}

          {tab === "data" ? (
            <section className="detail-section">
              <header>
                <div>
                  <span className="eyebrow">FICHA COMPLETA</span>
                  <h3>Dados cadastrados</h3>
                </div>
              </header>
              <div className="detail-data-grid complete">
                {generalFields.map((field) => (
                  <div key={field.key} className={field.wide ? "wide" : ""}>
                    <span>{field.label}</span>
                    <strong>{formatValue(field, record.payload[field.key])}</strong>
                    {field.help ? <small>{field.help}</small> : null}
                  </div>
                ))}
              </div>
            </section>
          ) : null}

          {tab === "audit" ? (
            <section className="detail-section">
              <header>
                <div>
                  <span className="eyebrow">RASTREABILIDADE</span>
                  <h3>Linha do tempo do registro</h3>
                </div>
              </header>
              <div className="audit-timeline">
                {canEdit && auditLoading ? (
                  <p className="audit-state">Carregando eventos registrados no banco…</p>
                ) : null}
                {canEdit && auditError ? (
                  <p className="audit-state error">{auditError}</p>
                ) : null}
                {canEdit && auditLogs.length
                  ? auditLogs.map((event) => {
                      const action = auditAction(event.action);
                      return (
                        <article key={event.id}>
                          <span><Icon name={action.icon} size={16} /></span>
                          <div>
                            <strong>{action.label}</strong>
                            <p>{event.summary}</p>
                            <small>
                              {new Date(event.createdAt).toLocaleString("pt-BR")}
                              {" • "}{event.actor || "Sistema"}
                            </small>
                            <small className={`audit-integrity ${event.integrity === "SEALED" ? "sealed" : ""}`}>
                              <Icon name={event.integrity === "SEALED" ? "lock" : "history"} size={13} />
                              {event.integrity === "SEALED"
                                ? "Evento selado e íntegro"
                                : "Evento legado anterior ao encadeamento"}
                            </small>
                          </div>
                        </article>
                      );
                    })
                  : null}
                {!canEdit || (!auditLoading && !auditLogs.length && !auditError) ? (
                  <>
                    <article>
                      <span><Icon name="edit" size={16} /></span>
                      <div>
                        <strong>Última atualização</strong>
                        <p>{new Date(record.updatedAt).toLocaleString("pt-BR")}</p>
                      </div>
                    </article>
                    <article>
                      <span><Icon name="plus" size={16} /></span>
                      <div>
                        <strong>Registro criado</strong>
                        <p>{new Date(record.createdAt).toLocaleString("pt-BR")} • origem: {record.source || "Sistema web"}</p>
                      </div>
                    </article>
                  </>
                ) : null}
              </div>
              <div className="audit-note">
                <Icon name="history" size={18} />
                <p>
                  {canEdit
                    ? "Os eventos são append-only: o banco bloqueia edição e exclusão da trilha, e cada novo evento recebe um hash SHA-256 encadeado ao anterior."
                    : "Por segurança, responsáveis e detalhes internos das alterações são exibidos somente ao administrador."}
                </p>
              </div>
            </section>
          ) : null}
        </div>
      </aside>
    </div>
  );
}

function normalizedWorkKey(value: unknown) {
  return String(value || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim()
    .toLowerCase();
}

function belongsToWork(record: StoredRecord, work: StoredRecord) {
  const workCode = normalizedWorkKey(work.payload.code || work.reference);
  const workName = normalizedWorkKey(work.payload.name || work.title);
  const recordCode = normalizedWorkKey(record.payload.workCode);
  const recordName = normalizedWorkKey(
    record.payload.work || record.payload.workName,
  );
  return Boolean(
    (workCode && recordCode && workCode === recordCode) ||
      (workName && recordName && workName === recordName),
  );
}

function boundedPercent(value: unknown) {
  const number = Number(value || 0);
  return Number.isFinite(number) ? Math.min(100, Math.max(0, number)) : 0;
}

// O Diário de obra não pede mais "Obra", "Equipe própria mobilizada",
// "Avanço produzido no dia" nem "Avanço físico acumulado" como digitação
// manual. A empresa opera normalmente em uma única obra por vez (com várias
// etapas), então a obra do diário é resolvida sozinha (a obra "Ativa", ou a
// mais recente cadastrada) e os demais números vêm do que já está
// cadastrado na Obra e nos diários anteriores, no momento de salvar.
function worklogAutoFields(
  payload: Record<string, unknown>,
  allRecords: StoredRecord[],
  excludeId: number | null,
) {
  const registeredWorks = allRecords.filter((record) => record.module === "works");
  const work =
    registeredWorks.find((record) => record.status === "Ativa") ||
    registeredWorks[0] ||
    null;
  const currentProgress = boundedPercent(work?.payload.physicalProgress);
  const thisDate = String(payload.date || "");
  const priorLog = work
    ? allRecords
        .filter(
          (record) =>
            record.module === "worklogs" &&
            record.id !== excludeId &&
            belongsToWork(record, work) &&
            String(record.payload.date || record.recordDate || "") <= thisDate,
        )
        .sort((a, b) =>
          String(b.payload.date || b.recordDate).localeCompare(
            String(a.payload.date || a.recordDate),
          ),
        )[0] || null
    : null;
  const previousProgress = boundedPercent(priorLog?.payload.progressPercentAfter);
  const ownTeamCount = work
    ? allRecords.filter(
        (record) =>
          record.module === "people" &&
          belongsToWork(record, work) &&
          !record.status.toLowerCase().includes("desligado"),
      ).length
    : 0;
  return {
    work: work ? String(work.payload.name || work.title) : "",
    workCode: work ? String(work.payload.code || work.reference) : "",
    progressPercentAfter: currentProgress,
    progressDelta: Math.round((currentProgress - previousProgress) * 10) / 10,
    ownTeamCount,
  };
}

function decimalNumber(value: number, maximumFractionDigits = 1) {
  return value.toLocaleString("pt-BR", { maximumFractionDigits });
}

function executiveQuantity(
  value: number,
  singular: string,
  plural: string,
) {
  return `${decimalNumber(value)} ${Math.abs(value - 1) < 0.0001 ? singular : plural}`;
}

function formatExecutiveDate(value: unknown) {
  const dateValue = String(value || "").slice(0, 10);
  if (!dateValue) return "Não informada";
  const date = new Date(`${dateValue}T12:00:00`);
  return Number.isNaN(date.getTime())
    ? "Não informada"
    : date.toLocaleDateString("pt-BR");
}

type ExecutiveMachineState = "active" | "maintenance" | "idle" | "neutral";

function isOpenMachineOccurrence(record: StoredRecord) {
  const status = normalizedWorkKey(record.status);
  return !["concluida", "encerrada", "cancelada", "excluida"].some((term) =>
    status.includes(term),
  );
}

function executiveMachineState(
  asset: StoredRecord,
  currentOccurrence: StoredRecord | null,
): ExecutiveMachineState {
  const occurrenceType = normalizedWorkKey(currentOccurrence?.payload.eventType);
  const assetStatus = normalizedWorkKey(asset.status);

  if (currentOccurrence && occurrenceType.includes("manutencao")) {
    return "maintenance";
  }
  if (currentOccurrence && occurrenceType.includes("ociosidade")) {
    return "idle";
  }
  if (assetStatus.includes("manutencao")) return "maintenance";
  if (assetStatus.includes("ocioso")) return "idle";
  if (["ativo", "em uso"].includes(assetStatus)) return "active";
  return "neutral";
}

function ConstructionExecutivePanel({
  records,
  onNavigate,
  onNew,
  onOpenRecord,
  canEdit,
  context = "dashboard",
}: {
  records: StoredRecord[];
  onNavigate: (view: string) => void;
  onNew: (moduleId: string) => void;
  onOpenRecord: (record: StoredRecord) => void;
  canEdit: boolean;
  context?: "dashboard" | "module";
}) {
  const { visible: showInternalCodes } = useContext(
    InternalCodeVisibilityContext,
  );
  const works = useMemo(
    () =>
      records
        .filter((record) => record.module === "works")
        .sort((a, b) => {
          const rank = (status: string) =>
            status === "Ativa"
              ? 0
              : status === "Pausada"
                ? 1
                : status === "Planejada"
                  ? 2
                  : 3;
          return rank(a.status) - rank(b.status) || a.title.localeCompare(b.title);
        }),
    [records],
  );
  const [selectedReference, setSelectedReference] = useState("");
  const [machineCompetence, setMachineCompetence] = useState(() =>
    new Date().toISOString().slice(0, 7),
  );

  const selectedWork =
    works.find((work) => work.reference === selectedReference) || works[0] || null;

  const workLogs = useMemo(
    () =>
      selectedWork
        ? records
            .filter(
              (record) =>
                record.module === "worklogs" &&
                belongsToWork(record, selectedWork),
            )
            .sort(
              (a, b) =>
                String(b.recordDate).localeCompare(String(a.recordDate)) ||
                b.id - a.id,
            )
        : [],
    [records, selectedWork],
  );

  const workAssets = useMemo(
    () =>
      selectedWork
        ? records
            .filter(
              (record) =>
                record.module === "assets" &&
                belongsToWork(record, selectedWork) &&
                !["devolvido", "baixado"].includes(
                  normalizedWorkKey(record.status),
                ),
            )
            .sort((a, b) => a.title.localeCompare(b.title))
        : [],
    [records, selectedWork],
  );

  const workAssetEvents = useMemo(() => {
    if (!selectedWork) return [];
    const assetIds = new Set(
      workAssets.map((asset) =>
        normalizedWorkKey(asset.payload.assetId || asset.reference),
      ),
    );
    return records
      .filter(
        (record) =>
          record.module === "asset_events" &&
          (belongsToWork(record, selectedWork) ||
            assetIds.has(normalizedWorkKey(record.payload.assetId))),
      )
      .sort(
        (a, b) =>
          String(b.recordDate || b.payload.startDate).localeCompare(
            String(a.recordDate || a.payload.startDate),
          ) || b.id - a.id,
      );
  }, [records, selectedWork, workAssets]);

  if (!selectedWork) {
    return (
      <section className="construction-executive construction-empty">
        <span className="construction-empty-icon">
          <Icon name="works" size={27} />
        </span>
        <div>
          <span className="eyebrow">EXECUÇÃO DE OBRAS</span>
          <h2>Cadastre a primeira obra para iniciar o acompanhamento</h2>
          <p>
            O painel será alimentado pelo avanço físico, diários de produtividade,
            equipe própria, ocorrências e marcos do cronograma.
          </p>
        </div>
        {canEdit ? (
          <button className="button primary" onClick={() => onNew("works")}>
            <Icon name="plus" size={18} /> Cadastrar obra
          </button>
        ) : (
          <button className="button secondary" onClick={() => onNavigate("works")}>
            Abrir Obras
          </button>
        )}
      </section>
    );
  }

  const latestLog = workLogs[0] || null;
  const workProgress = boundedPercent(selectedWork.payload.physicalProgress);
  const loggedProgress = boundedPercent(latestLog?.payload.progressPercentAfter);
  const physicalProgress = Math.max(workProgress, loggedProgress);
  const hasPlannedProgress =
    selectedWork.payload.plannedProgress !== null &&
    selectedWork.payload.plannedProgress !== undefined &&
    String(selectedWork.payload.plannedProgress).trim() !== "";
  const plannedProgress = hasPlannedProgress
    ? boundedPercent(selectedWork.payload.plannedProgress)
    : 0;
  const scheduleDelta = hasPlannedProgress
    ? physicalProgress - plannedProgress
    : 0;
  const riskLevel = String(
    selectedWork.payload.riskLevel ||
      (scheduleDelta <= -8
        ? "Crítico"
        : scheduleDelta <= -3
          ? "Atenção"
          : "Normal"),
  );
  const riskTone =
    riskLevel === "Crítico"
      ? "danger"
      : riskLevel === "Atenção"
        ? "warning"
        : "success";

  const activePeople = selectedWork
    ? records.filter(
        (record) =>
          record.module === "people" &&
          belongsToWork(record, selectedWork) &&
          !record.status.toLowerCase().includes("desligado"),
      ).length
    : 0;
  const ownTeamCount = Number(latestLog?.payload.ownTeamCount || activePeople);

  const productivity = calculateWorkProductivity(
    workLogs.map((log) => ({
      date: String(log.payload.date || log.recordDate),
      productivityStatus: String(log.payload.productivityStatus || ""),
      lostHours: Number(log.payload.lostHours || 0),
      cause: String(log.payload.unproductiveCause || "Outro"),
    })),
    selectedWork.payload.dailyWorkHours,
  );
  const {
    dailyWorkHours,
    recordedDays,
    recordedHours,
    productiveHours,
    lostHours,
    productiveDays,
    unproductiveDays,
    utilizationPercent,
    causes,
  } = productivity;
  const latestUnproductiveLog =
    workLogs.find(
      (log) =>
        Number(log.payload.lostHours || 0) > 0 ||
        String(log.payload.productivityStatus || "") !== "Produtivo",
    ) || null;
  const currentStage = String(
    selectedWork.payload.currentStage ||
      latestLog?.payload.currentStage ||
      "Etapa não informada",
  );
  const currentActivity = String(
    selectedWork.payload.currentScope ||
      latestLog?.payload.currentActivity ||
      "Informe no cadastro da obra o que está sendo construído agora.",
  );
  const currentProcess = String(
    selectedWork.payload.currentProcess ||
      latestLog?.payload.currentActivity ||
      currentActivity,
  );
  const nextMilestone = String(
    selectedWork.payload.nextMilestone || "Próximo marco não informado",
  );
  const totalPlannedDays = Number(selectedWork.payload.totalPlannedDays || 0);
  const scheduleDelayDays = Math.max(
    0,
    Number(selectedWork.payload.scheduleDelayDays || 0),
  );
  const progressGapPoints = Math.max(0, plannedProgress - physicalProgress);
  const periodMachineEvents = workAssetEvents.filter(
    (event) =>
      String(event.recordDate || event.payload.startDate || "").slice(0, 7) ===
        machineCompetence &&
      !["cancelado", "excluido"].includes(normalizedWorkKey(event.status)),
  );
  const machineRows = workAssets
    .map((asset) => {
      const assetId = normalizedWorkKey(
        asset.payload.assetId || asset.reference,
      );
      const linkedEvents = workAssetEvents.filter(
        (event) => normalizedWorkKey(event.payload.assetId) === assetId,
      );
      const currentOccurrence =
        linkedEvents.find(isOpenMachineOccurrence) || null;
      const periodEvents = periodMachineEvents.filter(
        (event) => normalizedWorkKey(event.payload.assetId) === assetId,
      );
      const state = executiveMachineState(asset, currentOccurrence);
      const lastEvent = currentOccurrence || periodEvents[0] || linkedEvents[0] || null;
      const periodLoss = periodEvents.reduce(
        (sum, event) =>
          sum + Math.max(0, Number(event.payload.estimatedDowntimeLoss || 0)),
        0,
      );
      const periodMaintenanceCost = periodEvents.reduce(
        (sum, event) => sum + machineCommittedAmount(event),
        0,
      );
      const recordedIdleDays = periodEvents.reduce(
        (sum, event) => sum + Math.max(0, Number(event.payload.idleDays || 0)),
        0,
      );
      const idleDays =
        recordedIdleDays > 0
          ? recordedIdleDays
          : state === "active"
            ? 0
            : Math.max(0, Number(asset.payload.idleDays || 0));
      const situation =
        state === "active"
          ? String(asset.payload.currentActivity || "Ativa e produzindo")
          : String(
              lastEvent?.payload.cause ||
                lastEvent?.payload.whatHappened ||
                asset.payload.notes ||
                "Motivo ainda não informado",
            );
      const forecast =
        state === "active"
          ? "Disponível"
          : currentOccurrence?.payload.endDate
            ? formatExecutiveDate(currentOccurrence.payload.endDate)
            : "Sem previsão";
      const updatedAt = [asset, ...linkedEvents].reduce(
        (latest, record) =>
          new Date(record.updatedAt).getTime() > new Date(latest).getTime()
            ? record.updatedAt
            : latest,
        asset.updatedAt,
      );
      return {
        asset,
        state,
        currentOccurrence,
        situation,
        forecast,
        idleDays,
        periodMaintenanceCost,
        periodLoss,
        updatedAt,
      };
    })
    .sort((a, b) => {
      const priority: Record<ExecutiveMachineState, number> = {
        maintenance: 4,
        idle: 3,
        neutral: 2,
        active: 1,
      };
      return (
        priority[b.state] - priority[a.state] ||
        b.periodLoss - a.periodLoss ||
        a.asset.title.localeCompare(b.asset.title)
      );
    });
  const activeMachines = machineRows.filter((row) => row.state === "active").length;
  const maintenanceMachines = machineRows.filter(
    (row) => row.state === "maintenance",
  ).length;
  const idleMachines = machineRows.filter((row) => row.state === "idle").length;
  const machineAvailability = machineRows.length
    ? (activeMachines / machineRows.length) * 100
    : 0;
  const workDowntimeLoss = machineRows.reduce(
    (sum, row) => sum + row.periodLoss,
    0,
  );
  const workMaintenanceCost = machineRows.reduce(
    (sum, row) => sum + row.periodMaintenanceCost,
    0,
  );
  const workEconomicImpact = workMaintenanceCost + workDowntimeLoss;
  const fleetLastUpdate = machineRows.reduce(
    (latest, row) =>
      !latest ||
      new Date(row.updatedAt).getTime() > new Date(latest).getTime()
        ? row.updatedAt
        : latest,
    "",
  );
  const machineStateLabel: Record<ExecutiveMachineState, string> = {
    active: "Ativa e produzindo",
    maintenance: "Em manutenção",
    idle: "Ociosa",
    neutral: "A classificar",
  };
  const requiredOwnTeamCount = Math.max(
    0,
    Number(selectedWork.payload.requiredOwnTeamCount || ownTeamCount),
  );
  const ownWorkforceCapacity = requiredOwnTeamCount
    ? Math.min(100, (ownTeamCount / requiredOwnTeamCount) * 100)
    : ownTeamCount
      ? 100
      : 0;
  const ownWorkforceGap = Math.max(0, requiredOwnTeamCount - ownTeamCount);
  const constructionStages = [
    "Mobilização",
    "Terraplenagem",
    "Fundações",
    "Estrutura",
    "Alvenaria",
    "Cobertura",
    "Instalações",
    "Acabamentos",
    "Comissionamento",
    "Entrega",
  ];
  const currentStageIndex = constructionStages.findIndex(
    (stage) => normalizedWorkKey(stage) === normalizedWorkKey(currentStage),
  );
  const currentStageProgress = boundedPercent(
    selectedWork.payload.currentStageProgress,
  );
  const currentStagePosition =
    currentStageIndex >= 0 ? currentStageIndex + 1 : 0;
  const projectBudget = Math.max(
    0,
    Number(selectedWork.payload.budget || selectedWork.amount || 0),
  );
  const projectRealizedCost = Math.max(
    0,
    Number(selectedWork.payload.realizedCost || 0),
  );
  const projectOpenCommitments = Math.max(
    0,
    Number(selectedWork.payload.openCommitments || 0),
  );
  const estimatedCostToComplete = Math.max(
    0,
    Number(
      selectedWork.payload.estimatedCostToComplete ||
        Math.max(0, projectBudget - projectRealizedCost),
    ),
  );
  const projectedFinalCost = projectRealizedCost + estimatedCostToComplete;
  const projectedBudgetVariance = projectedFinalCost - projectBudget;
  const budgetConsumption = projectBudget
    ? Math.min(100, (projectRealizedCost / projectBudget) * 100)
    : 0;
  const uncommittedCostToComplete = Math.max(
    0,
    estimatedCostToComplete - projectOpenCommitments,
  );
  const unavailableMachines = Math.max(0, machineRows.length - activeMachines);
  const capacityComponents = [
    {
      key: "people",
      label: "equipe própria",
      value: ownWorkforceCapacity,
    },
    {
      key: "machines",
      label: "máquinas",
      value: machineRows.length ? machineAvailability : 100,
    },
    {
      key: "productivity",
      label: "horas produtivas",
      value: recordedHours ? utilizationPercent : 100,
    },
  ];
  const capacityConstraint = [...capacityComponents].sort(
    (a, b) => a.value - b.value,
  )[0];
  const operationCapacity = capacityConstraint.value;
  const operationStatus =
    operationCapacity < 60
      ? "Operação crítica"
      : operationCapacity < 85
        ? "Operação limitada"
        : operationCapacity < 100
          ? "Operação próxima da capacidade"
          : "Operação em capacidade plena";
  const progressAdherenceScore =
    hasPlannedProgress && plannedProgress > 0
      ? boundedPercent((physicalProgress / plannedProgress) * 100)
      : physicalProgress;
  const scheduleScore = hasPlannedProgress
    ? boundedPercent(
        Math.min(
          progressAdherenceScore,
          100 - Math.min(100, scheduleDelayDays * 4),
        ),
      )
    : totalPlannedDays > 0 && scheduleDelayDays > 0
      ? boundedPercent(100 - (scheduleDelayDays / totalPlannedDays) * 100)
      : 100;
  const budgetHealthScore =
    projectBudget > 0 && projectedFinalCost > 0
      ? boundedPercent((projectBudget / projectedFinalCost) * 100)
      : 0;
  const overallFactors = [
    {
      label: "Avanço x plano",
      score: progressAdherenceScore,
      weight: 25,
      available: hasPlannedProgress && plannedProgress > 0,
    },
    {
      label: "Prazo",
      score: scheduleScore,
      weight: 15,
      available: hasPlannedProgress || totalPlannedDays > 0,
    },
    {
      label: "Equipe própria",
      score: ownWorkforceCapacity,
      weight: 15,
      available: requiredOwnTeamCount > 0 || ownTeamCount > 0,
    },
    {
      label: "Máquinas",
      score: machineAvailability,
      weight: 15,
      available: machineRows.length > 0,
    },
    {
      label: "Horas produtivas",
      score: utilizationPercent,
      weight: 15,
      available: recordedHours > 0,
    },
    {
      label: "Orçamento",
      score: budgetHealthScore,
      weight: 15,
      available: projectBudget > 0 && projectedFinalCost > 0,
    },
  ].filter((factor) => factor.available);
  const overallWeight = overallFactors.reduce(
    (sum, factor) => sum + factor.weight,
    0,
  );
  const overallIndex = overallWeight
    ? overallFactors.reduce(
        (sum, factor) => sum + factor.score * factor.weight,
        0,
      ) / overallWeight
    : 0;
  const topCause = causes[0] || null;
  const highestImpactMachine = [...machineRows].sort(
    (a, b) =>
      b.periodMaintenanceCost +
        b.periodLoss -
      (a.periodMaintenanceCost + a.periodLoss),
  )[0];
  type OperationalPriority = {
    title: string;
    value: string;
    detail: string;
    owner: string;
    tone: "critical" | "warning" | "attention" | "success";
    score: number;
    action: string;
    onClick: () => void;
  };
  const operationalPriorities: OperationalPriority[] = [];
  if (projectBudget > 0 && projectedBudgetVariance > 0) {
    operationalPriorities.push({
      title: "Revisar o custo projetado para conclusão",
      value: `${currency.format(projectedBudgetVariance)} acima`,
      detail: `A obra projeta ${currency.format(projectedFinalCost)} para concluir, contra orçamento de ${currency.format(projectBudget)}. O custo realizado já consumiu ${decimalNumber(budgetConsumption)}% do orçamento.`,
      owner: "Dono + engenharia + financeiro",
      tone: "critical",
      score:
        105 +
        Math.min(35, (projectedBudgetVariance / projectBudget) * 100 * 4),
      action: "Abrir orçamento",
      onClick: () => onOpenRecord(selectedWork),
    });
  }
  if (machineRows.length && machineAvailability < 100) {
    operationalPriorities.push({
      title: "Restabelecer a capacidade da frota",
      value: `${decimalNumber(machineAvailability)}% operacional`,
      detail: `${unavailableMachines} de ${machineRows.length} máquinas fora de produção; ${currency.format(workEconomicImpact)} de impacto no período.`,
      owner: "Encarregado + manutenção",
      tone: machineAvailability < 60 ? "critical" : "warning",
      score:
        100 -
        machineAvailability +
        Math.min(35, workEconomicImpact / 1000),
      action: "Abrir máquinas",
      onClick: () => onNavigate("assets"),
    });
  }
  if (hasPlannedProgress && scheduleDelta < 0) {
    operationalPriorities.push({
      title: "Executar o plano de recuperação do prazo",
      value: `${decimalNumber(progressGapPoints)} p.p. abaixo`,
      detail: scheduleDelayDays
        ? `${scheduleDelayDays} dias de atraso na linha de base; recuperar o avanço antes do próximo marco.`
        : "O executado está abaixo do previsto e precisa de reprogramação imediata.",
      owner: "Engenheiro responsável",
      tone: progressGapPoints >= 5 ? "critical" : "warning",
      score: 50 + progressGapPoints * 5 + scheduleDelayDays * 2,
      action: "Abrir plano da obra",
      onClick: () => onOpenRecord(selectedWork),
    });
  }
  if (recordedHours && utilizationPercent < 100) {
    operationalPriorities.push({
      title: "Reduzir as horas improdutivas",
      value: `${decimalNumber(lostHours)} h perdidas`,
      detail: topCause
        ? `${topCause.cause} responde por ${decimalNumber(topCause.share)}% das perdas registradas.`
        : "Há tempo de paralisação registrado sem causa principal consolidada.",
      owner: "Encarregado da frente",
      tone: utilizationPercent < 75 ? "critical" : "attention",
      score: 100 - utilizationPercent + lostHours,
      action: "Abrir diário",
      onClick: () => onNavigate("worklogs"),
    });
  }
  if (requiredOwnTeamCount && ownWorkforceCapacity < 100) {
    operationalPriorities.push({
      title: "Completar a equipe própria necessária",
      value: `${decimalNumber(ownWorkforceCapacity)}% mobilizada`,
      detail: `${ownTeamCount} pessoas presentes para ${requiredOwnTeamCount} necessárias; faltam ${ownWorkforceGap} postos na etapa.`,
      owner: "Encarregado + RH",
      tone: ownWorkforceCapacity < 80 ? "critical" : "attention",
      score: 100 - ownWorkforceCapacity + ownWorkforceGap * 5,
      action: "Ajustar capacidade",
      onClick: () => onOpenRecord(selectedWork),
    });
  }
  if (!operationalPriorities.length) {
    operationalPriorities.push({
      title: "Manter o ritmo operacional",
      value: "Capacidade plena",
      detail:
        "Equipe, máquinas e horas produtivas estão no nível necessário para a etapa.",
      owner: "Gestão da obra",
      tone: "success",
      score: 0,
      action: "Abrir ficha da obra",
      onClick: () => onOpenRecord(selectedWork),
    });
  }
  operationalPriorities.sort((a, b) => b.score - a.score);

  const useOperationalDashboard = Number(selectedWork.id) >= 0;
  return useOperationalDashboard ? (
    <section
      className={`construction-executive construction-executive-v2 ${
        context === "module" ? "module-context" : ""
      }`}
      aria-label="Painel executivo de execução da obra"
    >
      <header className="construction-executive-header">
        <div>
          <span className="eyebrow">CENTRO DE CONTROLE DA OBRA</span>
          <h2>Execução da Obra e Produtividade</h2>
          <p>
            Leitura única do avanço, capacidade de pessoas, disponibilidade das
            máquinas, perdas e prioridades que exigem decisão.
          </p>
        </div>
        <div className="construction-header-actions">
          <label>
            <span>Obra acompanhada</span>
            <select
              value={selectedWork.reference}
              onChange={(event) => setSelectedReference(event.target.value)}
            >
              {works.map((work) => (
                <option key={work.id} value={work.reference}>
                  {work.title}
                </option>
              ))}
            </select>
          </label>
          {canEdit ? (
            <>
              <button className="button secondary" onClick={() => onNew("worklogs")}>
                <Icon name="worklogs" size={17} /> Registrar diário
              </button>
              <button className="button primary" onClick={() => onNew("works")}>
                <Icon name="plus" size={17} /> Nova obra
              </button>
            </>
          ) : (
            <button className="button secondary" onClick={() => onNavigate("works")}>
              Ver obras
            </button>
          )}
        </div>
      </header>

      <section
        className="construction-stage-roadmap"
        aria-label="Passo a passo das etapas da obra"
      >
        <header>
          <div>
            <span className="eyebrow">PASSO A PASSO DA OBRA</span>
            <h3>Onde a obra está e o que vem depois</h3>
            <p>
              As etapas anteriores ficam concluídas, a etapa atual mostra seu
              próprio avanço e as próximas permanecem sinalizadas para início.
            </p>
          </div>
          <strong>
            {currentStagePosition || "—"}
            <small>de {constructionStages.length} etapas</small>
          </strong>
        </header>
        <div className="construction-stage-track" role="list">
          {constructionStages.map((stage, index) => {
            const stageState =
              currentStageIndex < 0
                ? "upcoming"
                : index < currentStageIndex
                  ? "completed"
                  : index === currentStageIndex
                    ? "current"
                    : "upcoming";
            return (
              <article
                key={stage}
                className={stageState}
                role="listitem"
                aria-current={stageState === "current" ? "step" : undefined}
              >
                <span>
                  {stageState === "completed" ? (
                    <Icon name="check" size={14} />
                  ) : (
                    String(index + 1).padStart(2, "0")
                  )}
                </span>
                <strong>{stage}</strong>
                <small>
                  {stageState === "completed"
                    ? "Concluída"
                    : stageState === "current"
                      ? `${decimalNumber(currentStageProgress)}% executada`
                      : "A iniciar"}
                </small>
              </article>
            );
          })}
        </div>
      </section>

      <section
        className="construction-dashboard-v56"
        aria-label="Resumo executivo da obra"
      >
        <header className="construction-dashboard-heading-v56">
          <div>
            <span className="eyebrow">PAINEL EXECUTIVO DA OBRA</span>
            <h3>Avanço, capacidade e custo para decisão</h3>
          </div>
          <details className="construction-index-chip-v56">
            <summary>
              Índice geral <strong>{decimalNumber(overallIndex)}%</strong>
            </summary>
            <div>
              O índice combina avanço físico, prazo, equipe, máquinas,
              produtividade e orçamento. Ele não representa isoladamente a
              porcentagem concluída da obra.
            </div>
          </details>
        </header>

        <div className="construction-kpi-row-v56">
          <article
            className={`construction-kpi-v56 ${
              scheduleDelta < 0 ? "danger" : "success"
            }`}
          >
            <small>AVANÇO DA OBRA</small>
            <strong>{decimalNumber(physicalProgress)}%</strong>
            <p>
              {hasPlannedProgress
                ? `Meta: ${decimalNumber(plannedProgress)}% até hoje`
                : "Meta do período ainda não informada"}
            </p>
            <span>
              {scheduleDelta < 0
                ? `-${decimalNumber(progressGapPoints)} p.p. • ${executiveQuantity(
                    scheduleDelayDays,
                    "dia de atraso",
                    "dias de atraso",
                  )}`
                : scheduleDelta > 0
                  ? `+${decimalNumber(scheduleDelta)} p.p. acima da meta`
                  : "Avanço alinhado ao planejamento"}
            </span>
          </article>

          <article
            className={`construction-kpi-v56 ${
              operationCapacity < 60
                ? "danger"
                : operationCapacity < 90
                  ? "warning"
                  : "success"
            }`}
          >
            <small>CAPACIDADE OPERACIONAL</small>
            <strong>{decimalNumber(operationCapacity)}%</strong>
            <p>
              Limitada por {capacityConstraint.label} em{" "}
              {decimalNumber(capacityConstraint.value)}%
            </p>
            <span>{operationStatus}</span>
          </article>

          <article
            className={`construction-kpi-v56 ${
              ownWorkforceCapacity >= 90 ? "success" : "warning"
            }`}
          >
            <small>EQUIPE MOBILIZADA</small>
            <strong>{decimalNumber(ownWorkforceCapacity)}%</strong>
            <p>
              {ownTeamCount} de {requiredOwnTeamCount || "—"} pessoas necessárias
            </p>
            <span>
              {ownWorkforceCapacity >= 100
                ? "Equipe completa"
                : "Mobilização abaixo da necessidade"}
            </span>
          </article>

          <article
            className={`construction-kpi-v56 ${
              projectedBudgetVariance > 0 ? "danger" : "success"
            }`}
          >
            <small>CUSTO FINAL PROJETADO</small>
            <strong>{currency.format(projectedFinalCost)}</strong>
            <p>Orçamento aprovado: {currency.format(projectBudget)}</p>
            <span>
              {projectedBudgetVariance > 0
                ? `+${currency.format(projectedBudgetVariance)} acima do limite`
                : `${currency.format(Math.abs(projectedBudgetVariance))} de margem prevista`}
            </span>
          </article>
        </div>

        <div className="construction-main-grid-v56">
          <article className="construction-stage-card-v56">
            <header>
              <small>ETAPA E PROCESSO ATUAL</small>
              <span>
                {currentStagePosition
                  ? `Etapa ${currentStagePosition} de ${constructionStages.length}`
                  : "Etapa fora do fluxo padrão"}
              </span>
            </header>
            <h3>{currentStage}</h3>
            <p>{currentProcess}</p>

            <div className="construction-stage-progress-v56">
              <span>
                Avanço dentro da etapa
                <strong>{decimalNumber(currentStageProgress)}%</strong>
              </span>
              <b>
                <i style={{ width: `${currentStageProgress}%` }} />
              </b>
            </div>

            <div className="construction-stage-meta-v56">
              <div>
                <small>PRÓXIMO MARCO</small>
                <strong>{nextMilestone}</strong>
                <span>
                  {formatExecutiveDate(selectedWork.payload.nextMilestoneDate)}
                </span>
              </div>
              <div>
                <small>RESPONSÁVEIS</small>
                <strong>
                  {String(
                    selectedWork.payload.manager || "Gestor não informado",
                  )}
                </strong>
                <span>
                  {String(
                    selectedWork.payload.foreman ||
                      "Encarregado não informado",
                  )}
                </span>
              </div>
            </div>
          </article>

          <article
            className={`construction-budget-card-v56 ${
              projectedBudgetVariance > 0 ? "over" : "within"
            }`}
          >
            <header>
              <small>ORÇAMENTO E CUSTOS</small>
              <span>
                {projectedBudgetVariance > 0
                  ? "Acima do orçamento"
                  : "Dentro do orçamento"}
              </span>
            </header>
            <h3>{currency.format(estimatedCostToComplete)}</h3>
            <p>Necessário para concluir a obra</p>

            <div className="construction-budget-lines-v56">
              <div>
                <span>Orçamento aprovado</span>
                <strong>{currency.format(projectBudget)}</strong>
              </div>
              <div>
                <span>Custo realizado</span>
                <strong>{currency.format(projectRealizedCost)}</strong>
              </div>
              <div>
                <span>Compromissos em aberto</span>
                <strong>{currency.format(projectOpenCommitments)}</strong>
              </div>
              <div>
                <span>A contratar ou executar</span>
                <strong>{currency.format(uncommittedCostToComplete)}</strong>
              </div>
            </div>

            <div className="construction-budget-alert-v56">
              {projectedBudgetVariance > 0
                ? `${currency.format(projectedBudgetVariance)} acima do orçamento aprovado.`
                : `${currency.format(Math.abs(projectedBudgetVariance))} de margem prevista no encerramento.`}
            </div>
          </article>
        </div>
      </section>

      <div className="construction-decision-grid construction-decision-grid-single">
        <article className="construction-priority-board">
          <header>
            <div>
              <span className="eyebrow">PRIORIDADE</span>
              <h3>O que mais impacta a obra</h3>
              <p>
                Ordem definida pelo efeito em capacidade, prazo, produtividade
                e dinheiro.
              </p>
            </div>
            <strong>{operationalPriorities.length}</strong>
          </header>
          <div>
            {operationalPriorities.slice(0, 4).map((priority, index) => (
              <button
                key={priority.title}
                className={priority.tone}
                onClick={priority.onClick}
              >
                <span className="construction-priority-rank">
                  {String(index + 1).padStart(2, "0")}
                </span>
                <span className="construction-priority-copy">
                  <small>{priority.owner}</small>
                  <strong>{priority.title}</strong>
                  <p>{priority.detail}</p>
                </span>
                <span className="construction-priority-value">
                  <strong>{priority.value}</strong>
                  <small>{priority.action}</small>
                </span>
                <Icon name="arrow" size={16} />
              </button>
            ))}
          </div>
        </article>

      </div>

      <section
        className="construction-fleet-section construction-fleet-v2"
        aria-label="Máquinas vinculadas à obra"
      >
        <header>
          <div>
            <span className="eyebrow">FROTA A SERVIÇO DA OBRA</span>
            <h3>Máquinas: produção, parada e impacto real</h3>
            <p>
              Cada linha mostra o uso atual, a previsão de retorno e o custo
              completo da ocorrência para a gestão agir.
            </p>
            <div className="construction-fleet-status-chips">
              <span className="active">{activeMachines} produzindo</span>
              <span className="maintenance">{maintenanceMachines} em manutenção</span>
              <span className="idle">{idleMachines} ociosas</span>
            </div>
          </div>
          <div className="construction-fleet-actions">
            <label>
              <span>Competência do impacto</span>
              <input
                type="month"
                value={machineCompetence}
                onChange={(event) => {
                  if (event.target.value) {
                    setMachineCompetence(event.target.value);
                  }
                }}
              />
            </label>
            <button onClick={() => onNavigate("assets")}>
              Painel de Máquinas <Icon name="arrow" size={14} />
            </button>
          </div>
        </header>

        <div className="construction-machine-table">
          <div className="construction-machine-table-head" aria-hidden="true">
            <span>Máquina e responsável</span>
            <span>Status e uso atual</span>
            <span>Parada e retorno</span>
            <span>Impacto da ocorrência</span>
            <span>Prioridade</span>
            <span />
          </div>
          {machineRows.map((row) => {
            const rowImpact = row.periodMaintenanceCost + row.periodLoss;
            const rowPriority =
              row.state === "active"
                ? { tone: "success", label: "Produzindo" }
                : rowImpact >= 5000 || row.idleDays >= 3
                  ? { tone: "critical", label: "Alta" }
                  : { tone: "warning", label: "Atenção" };
            return (
              <button
                key={row.asset.id}
                className={`construction-machine-row ${row.state}`}
                onClick={() =>
                  onOpenRecord(row.currentOccurrence || row.asset)
                }
              >
                <span className="construction-machine-main">
                  <i><Icon name="assets" size={18} /></i>
                  <span>
                    <strong>
                      {String(row.asset.payload.description || row.asset.title)}
                    </strong>
                    <small>
                      {String(row.asset.payload.responsible || "Sem responsável")}
                      {showInternalCodes ? ` • ${row.asset.reference}` : ""}
                    </small>
                  </span>
                </span>
                <span className="construction-machine-operation">
                  <b className={`construction-machine-status ${row.state}`}>
                    <i />
                    {machineStateLabel[row.state]}
                  </b>
                  <strong>{row.situation}</strong>
                  <small>
                    {row.currentOccurrence
                      ? String(
                          row.currentOccurrence.payload.correctionDescription ||
                            row.currentOccurrence.payload.whatHappened ||
                            "Ocorrência aberta",
                        )
                      : "Sem ocorrência operacional aberta"}
                  </small>
                </span>
                <span className="construction-machine-stop">
                  <strong>
                    {row.idleDays
                      ? executiveQuantity(row.idleDays, "dia parado", "dias parados")
                      : "Sem parada"}
                  </strong>
                  <small>Retorno: {row.forecast}</small>
                  <em>
                    Atualizado {new Date(row.updatedAt).toLocaleDateString("pt-BR")}
                  </em>
                </span>
                <span className="construction-machine-total-impact">
                  <strong>{currency.format(rowImpact)}</strong>
                  <small>
                    Manutenção {currency.format(row.periodMaintenanceCost)}
                  </small>
                  <em>Parada {currency.format(row.periodLoss)}</em>
                </span>
                <span className={`construction-machine-priority ${rowPriority.tone}`}>
                  {rowPriority.label}
                </span>
                <Icon name="arrow" size={15} />
              </button>
            );
          })}
          {!machineRows.length ? (
            <div className="construction-machine-empty">
              <span><Icon name="assets" size={22} /></span>
              <div>
                <strong>Nenhuma máquina vinculada a esta obra</strong>
                <p>
                  Vincule as máquinas para acompanhar capacidade, parada,
                  manutenção e impacto financeiro.
                </p>
              </div>
              {canEdit ? (
                <button onClick={() => onNew("assets")}>Cadastrar máquina</button>
              ) : null}
            </div>
          ) : null}
        </div>

        <div className="construction-fleet-impact-summary">
          <span><Icon name="alert" size={18} /></span>
          <div>
            <small>IMPACTO ECONÔMICO TOTAL DA FROTA</small>
            <strong>{currency.format(workEconomicImpact)}</strong>
          </div>
          <p>
            <b>{currency.format(workMaintenanceCost)}</b> de desembolso em
            manutenção <i>+</i> <b>{currency.format(workDowntimeLoss)}</b> de
            capacidade paga sem produção.
            {highestImpactMachine ? (
              <>
                {" "}Maior ocorrência: <b>{highestImpactMachine.asset.title}</b>.
              </>
            ) : null}
          </p>
        </div>

        <footer>
          <span>
            <Icon name="history" size={15} />
            {fleetLastUpdate
              ? `Frota atualizada em ${new Date(fleetLastUpdate).toLocaleString("pt-BR")}`
              : "Aguardando o primeiro registro de máquina"}
          </span>
          <span>
            Perda por parada é gerencial e não duplica o custo contábil.
          </span>
        </footer>
      </section>

      <footer className="construction-executive-footer">
        <span>
          <Icon name="check" size={16} />
          Capacidade geral = menor índice entre equipe própria, máquinas e horas
          produtivas; avanço e impactos dependem de registros validados.
        </span>
        <div>
          <button onClick={() => onOpenRecord(selectedWork)}>
            Abrir ficha da obra <Icon name="arrow" size={14} />
          </button>
          <button onClick={() => onNavigate("worklogs")}>
            Ver diários <Icon name="arrow" size={14} />
          </button>
        </div>
      </footer>
    </section>
  ) : (
    <section
      className={`construction-executive ${context === "module" ? "module-context" : ""}`}
      aria-label="Painel executivo de execução da obra"
    >
      <header className="construction-executive-header">
        <div>
          <span className="eyebrow">CENTRO DE CONTROLE OPERACIONAL</span>
          <h2>Execução da Obra e Produtividade</h2>
          <p>
            Avanço, equipes, máquinas e causas de parada organizados para a
            gerência identificar rapidamente onde agir.
          </p>
        </div>
        <div className="construction-header-actions">
          <label>
            <span>Selecione a obra para acompanhar</span>
            <select
              value={selectedWork.reference}
              onChange={(event) => setSelectedReference(event.target.value)}
            >
              {works.map((work) => (
                <option key={work.id} value={work.reference}>
                  {work.title}
                </option>
              ))}
            </select>
          </label>
          {canEdit ? (
            <>
              <button className="button secondary" onClick={() => onNew("worklogs")}>
                <Icon name="worklogs" size={17} /> Registrar diário
              </button>
              <button className="button primary" onClick={() => onNew("works")}>
                <Icon name="plus" size={17} /> Nova obra
              </button>
            </>
          ) : (
            <button className="button secondary" onClick={() => onNavigate("works")}>
              Ver obras
            </button>
          )}
        </div>
      </header>

      <div className="construction-executive-summary">
        <article className={`risk ${riskTone}`}>
          <small>SITUAÇÃO DA OBRA</small>
          <strong>{riskLevel}</strong>
          <span>
            {hasPlannedProgress
              ? `${decimalNumber(physicalProgress)}% executado de ${decimalNumber(plannedProgress)}% previsto`
              : `${decimalNumber(physicalProgress)}% executado`}
          </span>
        </article>
        <article className="productivity">
          <small>APROVEITAMENTO PRODUTIVO</small>
          <strong>{decimalNumber(utilizationPercent)}%</strong>
          <span>{decimalNumber(lostHours)} h perdidas nos diários</span>
        </article>
        <article className="availability">
          <small>DISPONIBILIDADE DAS MÁQUINAS</small>
          <strong>{decimalNumber(machineAvailability)}%</strong>
          <span>
            {activeMachines} em operação de {machineRows.length} vinculadas
          </span>
        </article>
        <article className="loss">
          <small>IMPACTO POR OCIOSIDADE</small>
          <strong>{currency.format(workDowntimeLoss)}</strong>
          <span>
            Indicador gerencial da competência{" "}
            {machineCompetence.split("-").reverse().join("/")}
          </span>
        </article>
      </div>

      <div className="construction-command-grid">
        <article className="construction-progress-card">
          <div className="construction-card-heading">
            <div>
              <small>AVANÇO FÍSICO</small>
              <strong>Avanço físico e prazo</strong>
            </div>
            <span className={`construction-status ${riskTone}`}>{riskLevel}</span>
          </div>
          <div className="construction-progress-main">
            <div
              className="construction-progress-ring"
              style={
                {
                  "--construction-progress": `${physicalProgress * 3.6}deg`,
                } as CSSProperties
              }
              aria-label={`${decimalNumber(physicalProgress)}% executado`}
            >
              <span>
                <strong>{decimalNumber(physicalProgress)}%</strong>
                <small>executado</small>
              </span>
            </div>
            <div className="construction-progress-comparison">
              <div>
                <span>Planejado até hoje</span>
                <strong>
                  {hasPlannedProgress
                    ? `${decimalNumber(plannedProgress)}%`
                    : "Não informado"}
                </strong>
              </div>
              <div className="schedule-position-summary">
                <span>
                  {scheduleDelta < 0
                    ? "Atraso informado pelo planejamento"
                    : "Situação do cronograma"}
                </span>
                <strong className={scheduleDelta < 0 ? "negative" : "positive"}>
                  {!hasPlannedProgress
                    ? "Sem linha de base"
                    : scheduleDelta < 0 && scheduleDelayDays > 0
                      ? executiveQuantity(
                          scheduleDelayDays,
                          "dia de atraso",
                          "dias de atraso",
                        )
                      : scheduleDelta < 0
                        ? "Atraso a apurar"
                        : scheduleDelta > 0
                          ? "Adiantado"
                          : "No prazo"}
                </strong>
                <small>
                  {!hasPlannedProgress
                    ? "Cadastre o avanço previsto para a data."
                    : scheduleDelta < 0
                      ? `${decimalNumber(progressGapPoints)} pontos de avanço abaixo do previsto.`
                      : scheduleDelta > 0
                        ? `${decimalNumber(scheduleDelta)} pontos de avanço acima do previsto.`
                        : "Executado e planejado estão alinhados."}
                </small>
              </div>
              <div className="schedule-lost-time-summary">
                <span>Tempo produtivo perdido</span>
                <strong className={lostHours > 0 ? "negative" : "positive"}>
                  {decimalNumber(lostHours)} h
                </strong>
                <small>
                  {executiveQuantity(
                    unproductiveDays,
                    "dia equivalente",
                    "dias equivalentes",
                  )}{" "}
                  • jornada de {decimalNumber(dailyWorkHours)} h
                </small>
              </div>
              <div>
                <span>Prazo total</span>
                <strong>
                  {totalPlannedDays ? `${totalPlannedDays} dias` : "Não informado"}
                </strong>
              </div>
            </div>
          </div>
          <div className="construction-plan-bars" aria-hidden="true">
            <span>
              <i>Planejado</i>
              <b><em style={{ width: `${plannedProgress}%` }} /></b>
              <strong>{hasPlannedProgress ? `${decimalNumber(plannedProgress)}%` : "—"}</strong>
            </span>
            <span>
              <i>Executado</i>
              <b className="actual"><em style={{ width: `${physicalProgress}%` }} /></b>
              <strong>{decimalNumber(physicalProgress)}%</strong>
            </span>
          </div>
          <div
            className={`construction-progress-explanation ${
              scheduleDelta < 0 ? "late" : "on-track"
            }`}
          >
            <strong>
              {scheduleDelta < 0
                ? `Faltam ${decimalNumber(progressGapPoints)} pontos de avanço para alcançar o previsto hoje.`
                : "O avanço executado está no nível planejado ou acima dele."}
            </strong>
            <span>
              O atraso em dias vem da linha de base; as horas perdidas vêm dos
              diários validados.
            </span>
          </div>
        </article>

        <article className="construction-productivity-card">
          <div className="construction-card-heading">
            <div>
              <small>PRODUTIVIDADE</small>
              <strong>Horas de produção e causas</strong>
            </div>
            <button onClick={() => onNavigate("worklogs")}>
              Abrir diário <Icon name="arrow" size={14} />
            </button>
          </div>
          <div className="productivity-day-kpis">
            <div className="productive">
              <strong>{decimalNumber(productiveHours)} h</strong>
              <span>
                {executiveQuantity(
                  productiveDays,
                  "dia equivalente produtivo",
                  "dias equivalentes produtivos",
                )}
              </span>
            </div>
            <div className={unproductiveDays ? "unproductive active" : "unproductive"}>
              <strong>{decimalNumber(lostHours)} h</strong>
              <span>
                {executiveQuantity(
                  unproductiveDays,
                  "dia equivalente perdido",
                  "dias equivalentes perdidos",
                )}
              </span>
            </div>
          </div>
          <div className="productivity-share">
            <span>
              <strong>{decimalNumber(utilizationPercent)}%</strong>
              aproveitamento das {decimalNumber(recordedHours)} h registradas em{" "}
              {executiveQuantity(recordedDays, "dia", "dias")}
            </span>
            <b>
              <i style={{ width: `${utilizationPercent}%` }} />
            </b>
          </div>
          <div className="unproductive-cause-list">
            {causes.slice(0, 3).map((cause) => (
              <div key={cause.cause}>
                <span>
                  <strong>{cause.cause}</strong>
                  <small>{decimalNumber(cause.hours)} h perdidas</small>
                </span>
                <b><i style={{ width: `${cause.share}%` }} /></b>
                <em>{decimalNumber(cause.share)}%</em>
              </div>
            ))}
            {!causes.length ? (
              <div className="construction-mini-empty">
                Nenhuma causa improdutiva registrada.
              </div>
            ) : null}
          </div>
          <p className="productivity-method-note">
            Conversão gerencial: 1 dia = {decimalNumber(dailyWorkHours)} h.
            Registre tempo de paralisação da frente, sem multiplicar pelo número
            de trabalhadores.
          </p>
          {latestUnproductiveLog ? (
            <button
              className="latest-unproductive-condition"
              onClick={() => onOpenRecord(latestUnproductiveLog)}
            >
              <span>
                <small>ÚLTIMA CONDIÇÃO REGISTRADA</small>
                <strong>
                  {String(
                    latestUnproductiveLog.payload.unproductiveCause ||
                      "Improdutividade",
                  )}
                </strong>
                <p>
                  {String(
                    latestUnproductiveLog.payload.conditionDetail ||
                      "Sem descrição detalhada.",
                  )}
                </p>
              </span>
              <Icon name="arrow" size={15} />
            </button>
          ) : null}
        </article>
      </div>

      <section
        className="construction-fleet-section"
        aria-label="Disponibilidade das máquinas vinculadas à obra"
      >
        <header>
          <div>
            <span className="eyebrow">MÁQUINAS DA OBRA</span>
            <h3>Disponibilidade, manutenção e ociosidade</h3>
            <p>
              O status atual considera a ficha da máquina e ocorrências ainda
              abertas. A perda financeira respeita a competência selecionada.
            </p>
          </div>
          <div className="construction-fleet-actions">
            <label>
              <span>Competência do impacto</span>
              <input
                type="month"
                value={machineCompetence}
                onChange={(event) => {
                  if (event.target.value) {
                    setMachineCompetence(event.target.value);
                  }
                }}
              />
            </label>
            <button onClick={() => onNavigate("assets")}>
              Painel de Máquinas <Icon name="arrow" size={14} />
            </button>
          </div>
        </header>

        <div className="construction-fleet-kpis">
          <article className="active">
            <span><Icon name="check" size={18} /></span>
            <div>
              <small>EM OPERAÇÃO</small>
              <strong>{activeMachines}</strong>
              <p>{decimalNumber(machineAvailability)}% da frota disponível</p>
            </div>
          </article>
          <article className="maintenance">
            <span><Icon name="asset_events" size={18} /></span>
            <div>
              <small>EM MANUTENÇÃO</small>
              <strong>{maintenanceMachines}</strong>
              <p>{currency.format(workMaintenanceCost)} em reparos no período</p>
            </div>
          </article>
          <article className="idle">
            <span><Icon name="history" size={18} /></span>
            <div>
              <small>OCIOSAS</small>
              <strong>{idleMachines}</strong>
              <p>Máquinas disponíveis, mas sem produzir</p>
            </div>
          </article>
          <article className="impact">
            <span><Icon name="alert" size={18} /></span>
            <div>
              <small>IMPACTO POR OCIOSIDADE</small>
              <strong>{currency.format(workDowntimeLoss)}</strong>
              <p>Perda gerencial; não duplica o custo contábil</p>
            </div>
          </article>
        </div>

        <div className="construction-machine-table">
          <div className="construction-machine-table-head" aria-hidden="true">
            <span>Máquina e responsável</span>
            <span>Status atual</span>
            <span>Condição identificada</span>
            <span>Parada</span>
            <span>Retorno previsto</span>
            <span>Custo manutenção</span>
            <span>Perda por parada</span>
            <span />
          </div>
          {machineRows.map((row) => (
            <button
              key={row.asset.id}
              className={`construction-machine-row ${row.state}`}
              onClick={() =>
                onOpenRecord(row.currentOccurrence || row.asset)
              }
            >
              <span className="construction-machine-main">
                <i><Icon name="assets" size={18} /></i>
                <span>
                  <strong>
                    {String(
                      row.asset.payload.description || row.asset.title,
                    )}
                  </strong>
                  <small>
                    {showInternalCodes ? `${row.asset.reference} • ` : ""}
                    {String(
                      row.asset.payload.responsible || "Sem responsável",
                    )}
                  </small>
                </span>
              </span>
              <span>
                <b className={`construction-machine-status ${row.state}`}>
                  <i />
                  {machineStateLabel[row.state]}
                </b>
              </span>
              <span className="construction-machine-condition">
                <strong>{row.situation}</strong>
                <small>
                  {row.currentOccurrence
                    ? String(
                        row.currentOccurrence.payload.correctionDescription ||
                          row.currentOccurrence.payload.whatHappened ||
                          "Ocorrência aberta",
                      )
                    : "Sem ocorrência operacional aberta"}
                </small>
              </span>
              <span className="construction-machine-days">
                <strong>{decimalNumber(row.idleDays)}</strong>
                <small>{row.idleDays === 1 ? "dia" : "dias"}</small>
              </span>
              <span className="construction-machine-forecast">
                <strong>{row.forecast}</strong>
                <small>
                  Atualizado{" "}
                  {new Date(row.updatedAt).toLocaleDateString("pt-BR")}
                </small>
              </span>
              <span className="construction-machine-maintenance">
                <strong>{currency.format(row.periodMaintenanceCost)}</strong>
                <small>reparo no período</small>
              </span>
              <span className="construction-machine-impact">
                <strong>{currency.format(row.periodLoss)}</strong>
                <small>tempo sem produzir</small>
              </span>
              <Icon name="arrow" size={15} />
            </button>
          ))}
          {!machineRows.length ? (
            <div className="construction-machine-empty">
              <span><Icon name="assets" size={22} /></span>
              <div>
                <strong>Nenhuma máquina vinculada a esta obra</strong>
                <p>
                  Vincule a máquina no cadastro para que disponibilidade,
                  manutenção, ociosidade e impacto sejam atualizados aqui.
                </p>
              </div>
              {canEdit ? (
                <button onClick={() => onNew("assets")}>Cadastrar máquina</button>
              ) : null}
            </div>
          ) : null}
        </div>

        <div className="construction-fleet-impact-summary">
          <span><Icon name="alert" size={18} /></span>
          <div>
            <small>IMPACTO ECONÔMICO DA FROTA NA COMPETÊNCIA</small>
            <strong>{currency.format(workEconomicImpact)}</strong>
          </div>
          <p>
            <b>{currency.format(workMaintenanceCost)}</b> em manutenção
            <i>+</i>
            <b>{currency.format(workDowntimeLoss)}</b> de perda por parada.
            A perda é gerencial e não é lançada novamente no custo contábil.
          </p>
        </div>

        <footer>
          <span>
            <Icon name="history" size={15} />
            {fleetLastUpdate
              ? `Última atualização da frota: ${new Date(
                  fleetLastUpdate,
                ).toLocaleString("pt-BR")}`
              : "Aguardando o primeiro registro de máquina"}
          </span>
          <span>
            Disponibilidade = máquinas produzindo ÷ máquinas vinculadas à obra
          </span>
        </footer>
      </section>

      <div className="construction-context-grid">
        <article className="construction-now">
          <span className="construction-context-icon">
            <Icon name="works" size={19} />
          </span>
          <div>
            <small>O QUE ESTÁ SENDO CONSTRUÍDO</small>
            <strong>{currentStage}</strong>
            <p>{currentActivity}</p>
          </div>
        </article>
        <article>
          <span className="construction-context-icon milestone">
            <Icon name="check" size={19} />
          </span>
          <div>
            <small>PRÓXIMO MARCO</small>
            <strong>{nextMilestone}</strong>
            <p>
              Previsão:{" "}
              {formatExecutiveDate(selectedWork.payload.nextMilestoneDate)}
            </p>
          </div>
        </article>
        <article>
          <span className="construction-context-icon people">
            <Icon name="people" size={19} />
          </span>
          <div>
            <small>EQUIPE MOBILIZADA</small>
            <strong>{ownTeamCount} pessoas</strong>
            <p>Equipe própria mobilizada</p>
          </div>
        </article>
        <article>
          <span className="construction-context-icon calendar">
            <Icon name="calendar" size={19} />
          </span>
          <div>
            <small>PREVISÃO DA OBRA</small>
            <strong>{formatExecutiveDate(selectedWork.payload.endDate)}</strong>
            <p>
              Gestor: {String(selectedWork.payload.manager || "Não informado")}
            </p>
          </div>
        </article>
      </div>

      <footer className="construction-executive-footer">
        <span>
          <Icon name="check" size={16} />
          Os percentuais devem ser comprovados por medição ou diário validado.
        </span>
        <div>
          <button onClick={() => onOpenRecord(selectedWork)}>
            Abrir ficha da obra <Icon name="arrow" size={14} />
          </button>
          <button onClick={() => onNavigate("works")}>
            Cadastros da execução <Icon name="arrow" size={14} />
          </button>
        </div>
      </footer>
    </section>
  );
}

function machinePaymentStatus(record: StoredRecord) {
  return String(record.payload.paymentStatus || "Pendente");
}

function machineCommittedAmount(record: StoredRecord) {
  if (record.module === "asset_events") {
    return Math.max(0, Number(record.payload.maintenanceCost || record.amount || 0));
  }
  return Math.max(0, Number(record.payload.monthlyCost || record.amount || 0));
}

function machineAssetCostForPeriod(
  record: StoredRecord,
  competenceStart: string,
  competenceEnd: string,
) {
  const total = machineCommittedAmount(record);
  const contractedDays = Math.max(
    0,
    Math.floor(Number(record.payload.rentalPeriodDays || 0)),
  );
  const startValue = String(record.payload.startDate || "").slice(0, 10);
  if (!startValue || contractedDays <= 0) return total;
  const toDay = (value: string) => {
    const [year, month, day] = value.split("-").map(Number);
    return year && month && day
      ? Math.floor(Date.UTC(year, month - 1, day) / 86_400_000)
      : Number.NaN;
  };
  const contractStart = toDay(startValue);
  const informedEnd = toDay(
    String(record.payload.rentalEndDate || "").slice(0, 10),
  );
  const contractEnd = Number.isFinite(informedEnd)
    ? informedEnd
    : contractStart + contractedDays - 1;
  const periodStart = toDay(competenceStart);
  const periodEnd = toDay(competenceEnd);
  if (
    ![contractStart, contractEnd, periodStart, periodEnd].every(Number.isFinite)
  ) {
    return total;
  }
  const overlapDays = Math.max(
    0,
    Math.min(contractEnd, periodEnd) - Math.max(contractStart, periodStart) + 1,
  );
  return (total / contractedDays) * Math.min(contractedDays, overlapDays);
}

function machinePaidAmount(record: StoredRecord) {
  const total = machineCommittedAmount(record);
  const status = machinePaymentStatus(record)
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();
  const informed = Math.max(0, Number(record.payload.paidAmount || 0));
  if (status === "pago") return informed > 0 ? Math.min(total, informed) : total;
  if (status === "parcial") return Math.min(total, informed);
  return 0;
}

function machineOutstandingAmount(record: StoredRecord) {
  const status = machinePaymentStatus(record)
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();
  if (status === "nao se aplica") return 0;
  return Math.max(0, machineCommittedAmount(record) - machinePaidAmount(record));
}

function MachineProductivityPanel({
  records,
  onNavigate,
}: {
  records: StoredRecord[];
  onNavigate: (view: string) => void;
}) {
  const works = useMemo(
    () =>
      records
        .filter((record) => record.module === "works")
        .sort((a, b) => {
          const rank = (status: string) =>
            status === "Ativa"
              ? 0
              : status === "Pausada"
                ? 1
                : status === "Planejada"
                  ? 2
                  : 3;
          return rank(a.status) - rank(b.status) || a.title.localeCompare(b.title);
        }),
    [records],
  );
  const [selectedReference, setSelectedReference] = useState("");
  const selectedWork =
    works.find((work) => work.reference === selectedReference) || works[0] || null;
  const workLogs = useMemo(
    () =>
      selectedWork
        ? records
            .filter(
              (record) =>
                record.module === "worklogs" &&
                belongsToWork(record, selectedWork),
            )
            .sort(
              (a, b) =>
                String(b.recordDate).localeCompare(String(a.recordDate)) ||
                b.id - a.id,
            )
        : [],
    [records, selectedWork],
  );

  const productivity = calculateWorkProductivity(
    workLogs.map((log) => ({
      date: String(log.payload.date || log.recordDate),
      productivityStatus: String(log.payload.productivityStatus || ""),
      lostHours: Number(log.payload.lostHours || 0),
      cause: String(log.payload.unproductiveCause || "Outro"),
    })),
    selectedWork?.payload.dailyWorkHours,
  );
  const {
    dailyWorkHours,
    recordedDays,
    recordedHours,
    productiveHours,
    lostHours,
    productiveDays,
    unproductiveDays,
    utilizationPercent,
    causes,
  } = productivity;

  return (
    <section
      className="machine-productivity-panel"
      aria-label="Produtividade e horas das máquinas na obra"
    >
      <header className="machine-productivity-header">
        <div>
          <span className="eyebrow">PRODUTIVIDADE COMPROVADA</span>
          <h1>Horas produzidas e causas de perda</h1>
          <p>
            Produção registrada nos diários da obra, com as perdas que afetam a
            disponibilidade das máquinas.
          </p>
        </div>
        <div className="machine-productivity-actions">
          {selectedWork ? (
            <label>
              <span>Obra acompanhada</span>
              <select
                value={selectedWork.reference}
                onChange={(event) => setSelectedReference(event.target.value)}
              >
                {works.map((work) => (
                  <option key={work.id} value={work.reference}>
                    {work.title}
                  </option>
                ))}
              </select>
            </label>
          ) : null}
          <button type="button" onClick={() => onNavigate("worklogs")}>
            Abrir diário <Icon name="arrow" size={15} />
          </button>
        </div>
      </header>

      {selectedWork ? (
        <div className="machine-productivity-content">
          <div className="machine-productivity-kpis">
            <article className="productive">
              <small>PRODUÇÃO</small>
              <strong>{decimalNumber(productiveHours)} h</strong>
              <span>
                {executiveQuantity(
                  productiveDays,
                  "dia equivalente",
                  "dias equivalentes",
                )}
              </span>
            </article>
            <article className="lost">
              <small>PERDA</small>
              <strong>{decimalNumber(lostHours)} h</strong>
              <span>
                {executiveQuantity(
                  unproductiveDays,
                  "dia equivalente",
                  "dias equivalentes",
                )}
              </span>
            </article>
            <div className="machine-productivity-utilization">
              <span>
                <strong>{decimalNumber(utilizationPercent)}%</strong>
                aproveitamento
              </span>
              <b aria-hidden="true">
                <i style={{ width: `${utilizationPercent}%` }} />
              </b>
              <small>
                {decimalNumber(recordedHours)} h em{" "}
                {executiveQuantity(recordedDays, "dia", "dias")} · jornada de{" "}
                {decimalNumber(dailyWorkHours)} h
              </small>
            </div>
          </div>

          <div className="machine-productivity-causes">
            <header>
              <span>CAUSAS DE PERDA</span>
              <small>{causes.length ? "Ordenadas pelo maior impacto" : "Sem perdas registradas"}</small>
            </header>
            <div>
              {causes.slice(0, 4).map((cause) => (
                <article key={cause.cause}>
                  <span>
                    <strong>{cause.cause}</strong>
                    <small>{decimalNumber(cause.hours)} h perdidas</small>
                  </span>
                  <b aria-hidden="true">
                    <i style={{ width: `${cause.share}%` }} />
                  </b>
                  <em>{decimalNumber(cause.share)}%</em>
                </article>
              ))}
              {!causes.length ? (
                <p>Nenhuma causa de improdutividade registrada nesta obra.</p>
              ) : null}
            </div>
          </div>
        </div>
      ) : (
        <div className="machine-productivity-empty">
          <span><Icon name="works" size={22} /></span>
          <div>
            <strong>Nenhuma obra cadastrada</strong>
            <p>Cadastre uma obra e seus diários para acompanhar as horas aqui.</p>
          </div>
          <button type="button" onClick={() => onNavigate("works")}>Abrir Obras</button>
        </div>
      )}
    </section>
  );
}

function MachineExecutivePanel({
  records,
  onNew,
  onOpenRecord,
  canEdit,
}: {
  records: StoredRecord[];
  onNew: (moduleId: string) => void;
  onOpenRecord: (record: StoredRecord) => void;
  canEdit: boolean;
}) {
  const [competence, setCompetence] = useState(() =>
    new Date().toISOString().slice(0, 7),
  );
  const [year, month] = competence.split("-").map(Number);
  const competenceStart = `${competence}-01`;
  const competenceEnd = `${competence}-${String(
    new Date(year, month, 0).getDate(),
  ).padStart(2, "0")}`;
  const normalize = (value: unknown) =>
    String(value || "")
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .trim()
      .toLowerCase();
  const assetRecords = records.filter((record) => {
    if (record.module !== "assets") return false;
    const start = String(record.payload.startDate || "").slice(0, 10);
    const end = String(record.payload.rentalEndDate || "").slice(0, 10);
    const status = normalize(record.status);
    return (
      (!start || start <= competenceEnd) &&
      (!end || end >= competenceStart) &&
      !["devolvido", "baixado"].includes(status)
    );
  });
  const occurrenceRecords = records
    .filter(
      (record) =>
        record.module === "asset_events" &&
        String(record.recordDate || record.payload.startDate || "").slice(0, 7) ===
          competence &&
        !["cancelado", "excluido"].includes(normalize(record.status)),
    )
    .sort(
      (a, b) =>
        String(b.recordDate).localeCompare(String(a.recordDate)) || b.id - a.id,
    );
  const assetKey = (record: StoredRecord) =>
    normalize(record.payload.assetId || record.reference);
  const eventAssetKey = (record: StoredRecord) =>
    normalize(record.payload.assetId);
  const rentalCost = assetRecords.reduce(
    (sum, record) =>
      sum + machineAssetCostForPeriod(record, competenceStart, competenceEnd),
    0,
  );
  const maintenanceCost = occurrenceRecords.reduce(
    (sum, record) => sum + machineCommittedAmount(record),
    0,
  );
  const downtimeLoss = occurrenceRecords.reduce(
    (sum, record) =>
      sum + Math.max(0, Number(record.payload.estimatedDowntimeLoss || 0)),
    0,
  );
  const allFinancialRecords = [...assetRecords, ...occurrenceRecords];
  const paidAmount = allFinancialRecords.reduce(
    (sum, record) => sum + machinePaidAmount(record),
    0,
  );
  const outstandingAmount = allFinancialRecords.reduce(
    (sum, record) => sum + machineOutstandingAmount(record),
    0,
  );
  const operationalCost = rentalCost + maintenanceCost;
  const economicImpact = operationalCost + downtimeLoss;
  const idleDays = occurrenceRecords.reduce(
    (sum, record) => sum + Math.max(0, Number(record.payload.idleDays || 0)),
    0,
  );
  const inactiveAssets = assetRecords.filter((record) =>
    ["ocioso", "em manutencao"].includes(normalize(record.status)),
  ).length;
  const maintenanceEvents = occurrenceRecords.filter((record) =>
    normalize(record.payload.eventType).startsWith("manutencao"),
  );
  const idleEvents = occurrenceRecords.filter(
    (record) => Number(record.payload.idleDays || 0) > 0,
  );
  const assetRows = assetRecords
    .map((asset) => {
      const linked = occurrenceRecords.filter(
        (event) => eventAssetKey(event) === assetKey(asset),
      );
      const rental = machineAssetCostForPeriod(
        asset,
        competenceStart,
        competenceEnd,
      );
      const maintenance = linked.reduce(
        (sum, event) => sum + machineCommittedAmount(event),
        0,
      );
      const loss = linked.reduce(
        (sum, event) =>
          sum + Math.max(0, Number(event.payload.estimatedDowntimeLoss || 0)),
        0,
      );
      const days = linked.reduce(
        (sum, event) => sum + Math.max(0, Number(event.payload.idleDays || 0)),
        0,
      );
      const paid =
        machinePaidAmount(asset) +
        linked.reduce((sum, event) => sum + machinePaidAmount(event), 0);
      const committed = rental + maintenance;
      return {
        asset,
        rental,
        maintenance,
        loss,
        days,
        paid,
        committed,
        impact: committed + loss,
      };
    })
    .sort((a, b) => b.impact - a.impact);
  const impactParts = [
    { label: "Locação e custo do período", value: rentalCost, color: "#2563eb" },
    { label: "Manutenção", value: maintenanceCost, color: "#f97316" },
    { label: "Perda por ociosidade", value: downtimeLoss, color: "#dc2626" },
  ];

  return (
    <section className="machine-executive" aria-label="Painel executivo de máquinas">
      <header className="machine-executive-header">
        <div>
          <span className="eyebrow">CENTRAL EXECUTIVA DE MÁQUINAS</span>
          <h1>Custo, disponibilidade e manutenção</h1>
          <p>
            Veja quanto cada máquina custa, o que está parado, o que está sendo
            corrigido e quanto a improdutividade representa em dinheiro.
          </p>
        </div>
        <div className="machine-header-actions">
          <label>
            <span>Competência</span>
            <input
              type="month"
              value={competence}
              onChange={(event) => {
                if (event.target.value) setCompetence(event.target.value);
              }}
            />
          </label>
          {canEdit ? (
            <div>
              <button className="button secondary" onClick={() => onNew("assets")}>
                <Icon name="plus" size={16} /> Nova máquina
              </button>
              <button
                className="button primary"
                onClick={() => onNew("asset_events")}
              >
                <Icon name="asset_events" size={16} /> Registrar manutenção ou
                ociosidade
              </button>
            </div>
          ) : null}
        </div>
      </header>

      <div className="machine-financial-kpis">
        <article className="cost">
          <span><Icon name="assets" size={20} /></span>
          <div>
            <small>CUSTO OPERACIONAL REAL</small>
            <strong>{currency.format(operationalCost)}</strong>
            <p>Locação {compactCurrency.format(rentalCost)} • manutenção {compactCurrency.format(maintenanceCost)}</p>
          </div>
        </article>
        <article className="loss">
          <span><Icon name="alert" size={20} /></span>
          <div>
            <small>PERDA POR OCIOSIDADE</small>
            <strong>{currency.format(downtimeLoss)}</strong>
            <p>{idleDays} dia(s) improdutivo(s) na competência</p>
          </div>
        </article>
        <article className="paid">
          <span><Icon name="check" size={20} /></span>
          <div>
            <small>JÁ PAGO</small>
            <strong>{currency.format(paidAmount)}</strong>
            <p>Valores confirmados nas locações e manutenções</p>
          </div>
        </article>
        <article className="payable">
          <span><Icon name="calendar" size={20} /></span>
          <div>
            <small>A PAGAR</small>
            <strong>{currency.format(outstandingAmount)}</strong>
            <p>{inactiveAssets} máquina(s) sem produção agora</p>
          </div>
        </article>
      </div>

      <div className="machine-command-grid">
        <article className="machine-impact-card">
          <header>
            <div>
              <span>IMPACTO ECONÔMICO</span>
              <strong>{currency.format(economicImpact)}</strong>
            </div>
            <small>{assetRecords.length} máquinas no período</small>
          </header>
          <p>
            Custo desembolsável somado à perda gerencial causada pelo tempo sem
            produção.
          </p>
          <div className="machine-impact-bar" aria-label="Composição do impacto das máquinas">
            {impactParts.map((part) => (
              <span
                key={part.label}
                style={{
                  width: `${economicImpact > 0 ? (part.value / economicImpact) * 100 : 0}%`,
                  backgroundColor: part.color,
                }}
              />
            ))}
          </div>
          <div className="machine-impact-legend">
            {impactParts.map((part) => (
              <div key={part.label}>
                <i style={{ backgroundColor: part.color }} />
                <span>
                  <small>{part.label}</small>
                  <strong>{currency.format(part.value)}</strong>
                </span>
                <b>
                  {economicImpact > 0
                    ? `${decimalNumber((part.value / economicImpact) * 100)}%`
                    : "0%"}
                </b>
              </div>
            ))}
          </div>
          <footer>
            <Icon name="alert" size={16} />
            A perda por ociosidade é gerencial e não é somada novamente ao custo
            contábil consolidado.
          </footer>
        </article>

        <article className="machine-fleet-card">
          <header>
            <div>
              <span className="eyebrow">FROTA E EQUIPAMENTOS</span>
              <h2>Impacto por máquina</h2>
            </div>
            <small>Ordenado pelo maior impacto</small>
          </header>
          <div className="machine-fleet-list">
            {assetRows.slice(0, 6).map((row) => {
              const paymentStatus = machinePaymentStatus(row.asset);
              return (
                <button
                  key={row.asset.id}
                  onClick={() => onOpenRecord(row.asset)}
                >
                  <span className="machine-row-icon">
                    <Icon name="assets" size={18} />
                  </span>
                  <span className="machine-row-main">
                    <strong>
                      {String(row.asset.payload.description || row.asset.title)}
                    </strong>
                    <small>
                      {row.days} dia(s) parado(s) • perda{" "}
                      {currency.format(row.loss)}
                    </small>
                  </span>
                  <span className="machine-row-finance">
                    <strong>{currency.format(row.impact)}</strong>
                    <small>impacto total</small>
                  </span>
                  <span
                    className={`machine-payment-chip ${statusTone(paymentStatus)}`}
                  >
                    {paymentStatus}
                  </span>
                  <Icon name="arrow" size={15} />
                </button>
              );
            })}
            {!assetRows.length ? (
              <p className="machine-empty">Nenhuma máquina ativa nesta competência.</p>
            ) : null}
          </div>
        </article>
      </div>

      <div className="machine-operations-grid">
        <article className="machine-events-card maintenance">
          <header>
            <div>
              <span><Icon name="asset_events" size={19} /></span>
              <div>
                <small>MANUTENÇÃO</small>
                <h2>O que foi ou está sendo corrigido</h2>
              </div>
            </div>
            <strong>{maintenanceEvents.length}</strong>
          </header>
          <div>
            {maintenanceEvents.slice(0, 5).map((event) => (
              <button key={event.id} onClick={() => onOpenRecord(event)}>
                <span>
                  <strong>{event.title}</strong>
                  <small>
                    {String(event.payload.assetName || "Máquina não informada")}
                  </small>
                  <p>
                    {String(
                      event.payload.correctionDescription ||
                        "Correção ainda não descrita.",
                    )}
                  </p>
                </span>
                <span className="machine-event-values">
                  <strong>{currency.format(machineCommittedAmount(event))}</strong>
                  <small className={statusTone(machinePaymentStatus(event))}>
                    {machinePaymentStatus(event)}
                  </small>
                </span>
                <Icon name="arrow" size={15} />
              </button>
            ))}
            {!maintenanceEvents.length ? (
              <p className="machine-empty">Nenhuma manutenção nesta competência.</p>
            ) : null}
          </div>
        </article>

        <article className="machine-events-card idle">
          <header>
            <div>
              <span><Icon name="history" size={19} /></span>
              <div>
                <small>OCIOSIDADE</small>
                <h2>Por que a máquina ficou parada</h2>
              </div>
            </div>
            <strong>{idleEvents.length}</strong>
          </header>
          <div>
            {idleEvents.slice(0, 5).map((event) => (
              <button key={event.id} onClick={() => onOpenRecord(event)}>
                <span className="machine-idle-days">
                  <strong>{Number(event.payload.idleDays || 0)}</strong>
                  <small>dias</small>
                </span>
                <span>
                  <strong>{String(event.payload.cause || "Motivo não informado")}</strong>
                  <small>{String(event.payload.assetName || event.title)}</small>
                  <p>{String(event.payload.whatHappened || event.title)}</p>
                </span>
                <span className="machine-event-values">
                  <strong>
                    {currency.format(
                      Number(event.payload.estimatedDowntimeLoss || 0),
                    )}
                  </strong>
                  <small>perda estimada</small>
                </span>
                <Icon name="arrow" size={15} />
              </button>
            ))}
            {!idleEvents.length ? (
              <p className="machine-empty">Nenhuma ociosidade registrada no período.</p>
            ) : null}
          </div>
        </article>
      </div>
    </section>
  );
}

function Dashboard({
  records,
  onNavigate,
  onNew,
  onOpenRecord,
  onOpenApprovalRecord,
  canEdit,
}: {
  records: StoredRecord[];
  onNavigate: (view: string) => void;
  onNew: (moduleId: string) => void;
  onOpenRecord: (record: StoredRecord) => void;
  onOpenApprovalRecord: (record: StoredRecord) => void;
  canEdit: boolean;
}) {
  const { visible: showInternalCodes } = useContext(
    InternalCodeVisibilityContext,
  );
  const [competence, setCompetence] = useState(() =>
    new Date().toISOString().slice(0, 7),
  );
  const [deadlineWindow, setDeadlineWindow] = useState<7 | 15 | 30>(7);
  const [managementFocus, setManagementFocus] =
    useState<ManagementQueue>("validation");
  const [managementProcess, setManagementProcess] = useState("all");

  const [competenceYear, competenceMonth] = competence.split("-").map(Number);
  const competenceStart = `${competence}-01`;
  const competenceEnd = `${competence}-${String(
    new Date(competenceYear, competenceMonth, 0).getDate(),
  ).padStart(2, "0")}`;
  const statusText = (record: StoredRecord) =>
    record.status
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .toLowerCase();
  const excludedFromCost = (record: StoredRecord) =>
    ["cancelad", "rejeitad", "devolvid", "baixad", "excluid"].some((term) =>
      statusText(record).includes(term),
    );
  const isPaid = (record: StoredRecord) =>
    ["pago", "paga"].includes(statusText(record).trim());
  const inCompetence = (value: unknown) =>
    String(value || "").slice(0, 7) === competence;
  const recordAmount = (record: StoredRecord) => {
    const paidAmount = Number(record.payload.paidAmount || 0);
    return isPaid(record) && paidAmount > 0
      ? paidAmount
      : Math.max(0, Number(record.amount || 0));
  };
  const competenceDate = (record: StoredRecord) => {
    if (record.module === "expenses") {
      return record.payload.issueDate || record.recordDate;
    }
    if (record.module === "taxes") {
      return record.payload.period || record.recordDate;
    }
    if (record.module === "cards") {
      return record.payload.billingPeriod || record.recordDate;
    }
    return record.recordDate;
  };
  const transactionRecords = (module: string) =>
    records.filter(
      (record) =>
        record.module === module &&
        inCompetence(competenceDate(record)) &&
        !excludedFromCost(record),
    );
  const activeDuringCompetence = (
    record: StoredRecord,
    startKey: string,
    endKey: string,
  ) => {
    const start = String(record.payload[startKey] || "").slice(0, 10);
    const end = String(record.payload[endKey] || "").slice(0, 10);
    return (
      (!start || start <= competenceEnd) &&
      (!end || end >= competenceStart)
    );
  };

  const expenseRecords = transactionRecords("expenses");
  const cardRecords = transactionRecords("cards");
  const foodRecords = transactionRecords("food");
  const taxRecords = transactionRecords("taxes");
  const purchaseRecords = transactionRecords("purchases");
  const assetEventRecords = transactionRecords("asset_events");
  const rentalRecords = records.filter(
    (record) =>
      record.module === "rentals" &&
      activeDuringCompetence(record, "startDate", "endDate") &&
      ["ativo", "a encerrar"].includes(statusText(record).trim()),
  );
  const assetRecords = records.filter(
    (record) =>
      record.module === "assets" &&
      activeDuringCompetence(record, "startDate", "rentalEndDate") &&
      !excludedFromCost(record) &&
      !["devolvido", "baixado"].includes(statusText(record).trim()),
  );
  const machineRentalCost = assetRecords.reduce(
    (sum, record) =>
      sum + machineAssetCostForPeriod(record, competenceStart, competenceEnd),
    0,
  );
  const machineMaintenanceCost = assetEventRecords.reduce(
    (sum, record) => sum + machineCommittedAmount(record),
    0,
  );
  const peopleRecords = records.filter(
    (record) =>
      record.module === "people" &&
      activeDuringCompetence(record, "admissionDate", "terminationDate") &&
      !["desligado"].includes(statusText(record).trim()),
  );
  const validatedPayroll = records.filter(
    (record) =>
      record.module === "payroll" &&
      inCompetence(record.recordDate) &&
      statusText(record).includes("validada") &&
      !excludedFromCost(record),
  );
  const payrollCost = validatedPayroll.reduce(
    (sum, record) =>
      sum +
      Math.max(
        0,
        Number(record.payload.employerCost || record.payload.custoEmpresarial || record.amount || 0),
      ),
    0,
  );
  const salaryBaseCost = peopleRecords.reduce(
    (sum, record) => sum + Math.max(0, Number(record.payload.salary || 0)),
    0,
  );

  const costRows: Array<{
    label: string;
    id: string;
    value: number;
    counted: boolean;
    note: string;
  }> = [
    {
      label: "Contas a pagar",
      id: "expenses",
      value: expenseRecords.reduce((sum, record) => sum + recordAmount(record), 0),
      counted: true,
      note: "Cobranças da competência",
    },
    {
      label: "Cartões corporativos",
      id: "cards",
      value: cardRecords.reduce((sum, record) => sum + recordAmount(record), 0),
      counted: true,
      note: "Despesas realizadas",
    },
    {
      label: "Imóveis e aluguéis",
      id: "rentals",
      value: rentalRecords.reduce((sum, record) => sum + recordAmount(record), 0),
      counted: true,
      note: "Contratos ativos no mês",
    },
    {
      label: "Máquinas",
      id: "assets",
      value: machineRentalCost + machineMaintenanceCost,
      counted: true,
      note: "Locações + manutenções",
    },
    {
      label: payrollCost > 0 ? "Folha e encargos" : "Salários-base",
      id: "people",
      value: payrollCost > 0 ? payrollCost : salaryBaseCost,
      counted: true,
      note: payrollCost > 0 ? "Folha validada" : "Estimativa sem encargos",
    },
    {
      label: "Alimentação",
      id: "food",
      value: foodRecords.reduce((sum, record) => sum + recordAmount(record), 0),
      counted: true,
      note: "Valor faturado",
    },
    {
      label: "Impostos",
      id: "taxes",
      value: taxRecords.reduce((sum, record) => sum + recordAmount(record), 0),
      counted: true,
      note: "Obrigações da competência",
    },
    {
      label: "Compras em processo",
      id: "purchases",
      value: purchaseRecords.reduce((sum, record) => sum + recordAmount(record), 0),
      counted: false,
      note: "Não somado para evitar duplicidade",
    },
  ];
  const totalCost = costRows
    .filter((row) => row.counted)
    .reduce((sum, row) => sum + row.value, 0);
  const costChartSegments = costRows
    .filter((row) => row.counted && row.value > 0)
    .map((row) => {
      const share = totalCost > 0 ? (row.value / totalCost) * 100 : 0;
      return { ...row, share };
    })
    .sort((a, b) => b.value - a.value);
  const largestCostRow = costChartSegments[0] || null;
  const chartMaximum = largestCostRow?.value || 1;
  const financeRecords = [...expenseRecords, ...taxRecords];
  const machineFinanceRecords = [...assetRecords, ...assetEventRecords];
  const pendingExpenses = [
    ...financeRecords.filter((record) => !isPaid(record)),
    ...machineFinanceRecords.filter(
      (record) => machineOutstandingAmount(record) > 0,
    ),
  ];
  const payable = pendingExpenses.reduce(
    (sum, record) =>
      sum +
      (["assets", "asset_events"].includes(record.module)
          ? machineOutstandingAmount(record)
          : recordAmount(record)),
    0,
  );
  const paidFinance = [
    ...financeRecords.filter(isPaid),
    ...machineFinanceRecords.filter(
      (record) => machinePaidAmount(record) > 0,
    ),
  ].reduce(
    (sum, record) =>
      sum +
      (["assets", "asset_events"].includes(record.module)
          ? machinePaidAmount(record)
          : recordAmount(record)),
    0,
  );
  const managementRequests = records.filter(isManagementRequest);
  const readyManagementRequests = managementRequests.filter(
    requestIsReadyForManagement,
  );
  const rejectedRequestRecords = managementRequests.filter(
    (record) => requestDecisionState(record) === "rejected",
  );
  const missingRequestRecords = readyManagementRequests.filter(
    (record) => !requestHasRequiredDocument(record),
  );
  const validationRequestRecords = readyManagementRequests.filter(
    requestHasRequiredDocument,
  );
  const managementProcessOptions = [
    ["all", "Todos os processos"],
    ["purchases", "Compras"],
    ["expenses", "Pagamentos"],
    ["cards", "Cartões corporativos"],
  ];
  const todayDate = new Date();
  todayDate.setHours(0, 0, 0, 0);
  const parseRecordDate = (value: string) => {
    const [year, month, day] = value.slice(0, 10).split("-").map(Number);
    return year && month && day ? new Date(year, month - 1, day) : null;
  };
  const paymentDeadlines = records
    .filter(
      (record) =>
        ["expenses", "taxes"].includes(record.module) &&
        Boolean(record.recordDate) &&
        !isPaid(record) &&
        !excludedFromCost(record),
    )
    .map((record) => {
      const date = parseRecordDate(record.recordDate);
      const daysUntil = date
        ? Math.round((date.getTime() - todayDate.getTime()) / 86_400_000)
        : Number.POSITIVE_INFINITY;
      return { record, daysUntil };
    })
    .filter((entry) => entry.daysUntil <= deadlineWindow)
    .sort((a, b) => a.daysUntil - b.daysUntil);
  const overdueCount = paymentDeadlines.filter(
    (entry) => entry.daysUntil < 0,
  ).length;
  const managementRecords = (
    managementFocus === "validation"
      ? validationRequestRecords
      : managementFocus === "rejected"
        ? rejectedRequestRecords
        : missingRequestRecords
  )
    .filter(
      (record) =>
        managementProcess === "all" || record.module === managementProcess,
    )
    .sort((a, b) => {
      const priority = (record: StoredRecord) => {
        const value = normalizedWorkflowText(record.payload.priority);
        if (value === "urgente") return 4;
        if (value === "alta") return 3;
        if (value === "media") return 2;
        return 1;
      };
      return (
        priority(b) - priority(a) ||
        new Date(a.recordDate || a.createdAt).getTime() -
          new Date(b.recordDate || b.createdAt).getTime()
      );
    });
  const managementQueueTotal = managementRecords.reduce(
    (sum, record) => sum + Math.max(0, Number(record.amount || 0)),
    0,
  );
  const managementDemoCount = managementRecords.filter(isDemoRecord).length;


  return (
    <div className="page-stack">
      <section className="dashboard-grid executive-priority-grid">
        <article className="content-card cost-card consolidated-card">
          <div className="consolidated-heading">
            <div>
              <span className="eyebrow">PAINEL EXECUTIVO DE CUSTOS</span>
              <h1>Acompanhamento financeiro da competência</h1>
              <p>
                Veja o custo apurado, o que já foi pago e os compromissos em
                aberto. O impacto por ociosidade agora fica junto das máquinas,
                onde a gerência consegue identificar a causa e o equipamento.
              </p>
            </div>
            <label className="dashboard-competence">
              <span>Competência</span>
              <input
                type="month"
                value={competence}
                onChange={(event) => {
                  if (event.target.value) setCompetence(event.target.value);
                }}
              />
            </label>
          </div>
          <section
            className="cost-monitor"
            aria-label="Acompanhamento executivo dos custos"
          >
            <div className="cost-monitor-grid">
              <article className="primary">
                <span>Custo apurado no mês</span>
                <strong>{currency.format(totalCost)}</strong>
                <small>{costChartSegments.length} grupos consolidados</small>
              </article>
              <article className="paid">
                <span>Já pago</span>
                <strong>{currency.format(paidFinance)}</strong>
                <small>Valores com quitação confirmada</small>
              </article>
              <article className="open">
                <span>Comprometido em aberto</span>
                <strong>{currency.format(payable)}</strong>
                <small>{pendingExpenses.length} obrigações localizadas</small>
              </article>
            </div>

          </section>
          <div className="executive-cost-layout">
            <section className="cost-composition-card" aria-label="Composição do custo total">
              <header className="cost-chart-heading cost-bar-heading">
                <div>
                  <span>MAPA EXECUTIVO</span>
                  <strong>Distribuição dos custos por grupo</strong>
                  <p>Compare os maiores impactos e abra cada área diretamente pelo gráfico.</p>
                </div>
                <div className="cost-total-highlight">
                  <span>Custo consolidado · {competence.split("-").reverse().join("/")}</span>
                  <strong>{currency.format(totalCost)}</strong>
                  <small>{costChartSegments.length} grupos no valor total</small>
                </div>
              </header>

              <div className="cost-bar-legend" aria-hidden="true">
                <span>Grupo de custo</span>
                <span>Comparação entre os grupos</span>
                <span>Valor e participação</span>
              </div>

              <div
                className="cost-executive-bars"
                role="group"
                aria-label={`Gráfico dos custos que formam ${currency.format(totalCost)}`}
              >
                {costChartSegments.map((row, index) => {
                  const relativeWidth = Math.max(
                    2.5,
                    (row.value / chartMaximum) * 100,
                  );
                  const shareLabel = row.share.toLocaleString("pt-BR", {
                    maximumFractionDigits: 1,
                  });
                  return (
                    <button
                      key={row.id}
                      className={index === 0 ? "cost-bar-row leader" : "cost-bar-row"}
                      type="button"
                      style={
                        {
                          "--cost-color":
                            row.id === "expenses"
                              ? "#38bdf8"
                              : moduleMap[row.id]?.color || "#64748b",
                        } as CSSProperties
                      }
                      title={`${row.label}: ${currency.format(row.value)} • ${shareLabel}% do total`}
                      aria-label={`Abrir ${row.label}: ${currency.format(row.value)}, ${shareLabel}% do total`}
                      onClick={() => onNavigate(row.id)}
                    >
                      <span className="cost-bar-label">
                        <i />
                        <span>
                          <b>{row.label}</b>
                          <small>{index === 0 ? "Maior impacto da competência" : row.note}</small>
                        </span>
                      </span>
                      <span className="cost-bar-track" aria-hidden="true">
                        <span style={{ width: `${relativeWidth}%` }} />
                      </span>
                      <span className="cost-bar-value">
                        <strong>{compactCurrency.format(row.value)}</strong>
                        <small>{shareLabel}% do total</small>
                      </span>
                      <Icon name="arrow" size={15} />
                    </button>
                  );
                })}
                {costChartSegments.length === 0 ? (
                  <div className="cost-chart-empty">
                    Nenhum custo registrado nesta competência.
                  </div>
                ) : null}
              </div>

              <div className="cost-chart-footer">
                <button
                  className="cost-payable-cta"
                  type="button"
                  onClick={() => onNavigate("expenses")}
                >
                  <span className="kpi-icon navy">
                    <Icon name="expenses" size={18} />
                  </span>
                  <span>
                    <small>Compromissos a pagar</small>
                    <strong>{currency.format(payable)}</strong>
                    <em>{pendingExpenses.length} obrigações abertas · clique para conferir</em>
                  </span>
                  <Icon name="arrow" size={16} />
                </button>

                <div className="cost-paid-row">
                  <span>Já pago na competência</span>
                  <strong>{currency.format(paidFinance)}</strong>
                  <small>Financeiro, locações e manutenções confirmadas</small>
                </div>
              </div>
            </section>
          </div>

        </article>

        <article className="content-card pending-card deadline-card">
          <div className="deadline-heading">
            <div>
              <span className="eyebrow">AGENDA FINANCEIRA</span>
              <h2>Vencimentos em até {deadlineWindow} dias</h2>
              <p>O que já venceu permanece primeiro e destacado em vermelho.</p>
            </div>
            <div className="deadline-tools">
              <div className="deadline-filter" aria-label="Período dos vencimentos">
                {([7, 15, 30] as const).map((days) => (
                  <button
                    key={days}
                    type="button"
                    className={deadlineWindow === days ? "active" : ""}
                    aria-pressed={deadlineWindow === days}
                    onClick={() => setDeadlineWindow(days)}
                  >
                    {days} dias
                  </button>
                ))}
              </div>
              <div className="deadline-counts">
                {overdueCount ? <span className="overdue-count">{overdueCount} vencido(s)</span> : null}
                <span
                  className={`count-badge ${paymentDeadlines.length ? "danger" : ""}`}
                  title={`${paymentDeadlines.length} vencimento(s) exibido(s)`}
                >
                  {paymentDeadlines.length}
                </span>
              </div>
            </div>
          </div>
          <div className="deadline-list">
            {paymentDeadlines.length ? (
              paymentDeadlines.slice(0, 8).map(({ record, daysUntil }) => {
                const tone =
                  daysUntil < 0
                    ? "overdue"
                    : daysUntil === 0
                      ? "today"
                      : daysUntil <= 2
                        ? "urgent"
                        : "upcoming";
                const urgency =
                  daysUntil < 0
                    ? `Vencido há ${Math.abs(daysUntil)} dia(s)`
                    : daysUntil === 0
                      ? "Vence hoje"
                      : daysUntil === 1
                        ? "Vence amanhã"
                        : `Vence em ${daysUntil} dias`;
                return (
                  <button
                    key={record.id}
                    className={`deadline-row ${tone}`}
                    onClick={() => onOpenRecord(record)}
                  >
                    <span className="deadline-date">
                      <strong>{formatValue({ type: "date" } as ModuleField, record.recordDate)}</strong>
                      <small>Vencimento</small>
                    </span>
                    <span className="deadline-main">
                      <strong>{record.title}</strong>
                      <small>
                        {moduleMap[record.module]?.shortLabel}
                        {showInternalCodes ? ` • ${record.reference}` : ""}
                      </small>
                    </span>
                    <span className="deadline-value">
                      <strong>{currency.format(recordAmount(record))}</strong>
                      <small>{urgency}</small>
                    </span>
                    <Icon name="arrow" size={17} />
                  </button>
                );
              })
            ) : (
              <div className="card-empty compact deadline-empty">
                <span className="empty-check"><Icon name="check" /></span>
                <strong>Nenhum vencimento urgente</strong>
                <p>Não há contas ou impostos vencidos nem com vencimento nos próximos {deadlineWindow} dias.</p>
              </div>
            )}
          </div>
          <button className="deadline-footer" type="button" onClick={() => onNavigate("expenses")}>
            Ver todas as contas a pagar <Icon name="arrow" size={15} />
          </button>
        </article>
      </section>

      <ConstructionExecutivePanel
        records={records}
        onNavigate={onNavigate}
        onNew={onNew}
        onOpenRecord={onOpenRecord}
        canEdit={canEdit}
      />

      <section className="management-center content-card">
        <div className="management-heading">
          <div>
            <span className="eyebrow">CENTRAL DE PEDIDOS</span>
            <h2>Central de decisões gerenciais</h2>
            <p>
              Pedidos documentados, organizados por etapa e prontos para
              conferência. Cada decisão fica registrada com responsável,
              justificativa e histórico.
            </p>
          </div>
          <div className="management-heading-tools">
            <span className="real-records-chip">
              <Icon name="database" size={14} /> Dados reais e fictícios
            </span>
            <span className="management-total">
              {managementRecords.length}{" "}
              {managementRecords.length === 1 ? "pedido" : "pedidos"}
            </span>
          </div>
        </div>
        <div className="management-overview">
          <article className="validation">
            <span><Icon name="history" size={17} /></span>
            <div>
              <small>Aguardando validação</small>
              <strong>{validationRequestRecords.length}</strong>
              <em>com documentação pronta</em>
            </div>
          </article>
          <article className="rejected">
            <span><Icon name="close" size={17} /></span>
            <div>
              <small>Reprovados</small>
              <strong>{rejectedRequestRecords.length}</strong>
              <em>com motivo registrado</em>
            </div>
          </article>
          <article className="missing">
            <span><Icon name="alert" size={17} /></span>
            <div>
              <small>Documentos ausentes</small>
              <strong>{missingRequestRecords.length}</strong>
              <em>aprovação bloqueada</em>
            </div>
          </article>
        </div>
        <div className="management-tabs">
          <button
            className={managementFocus === "validation" ? "active" : ""}
            onClick={() => setManagementFocus("validation")}
          >
            Aguardando Validação <span>{validationRequestRecords.length}</span>
          </button>
          <button
            className={managementFocus === "rejected" ? "active" : ""}
            onClick={() => setManagementFocus("rejected")}
          >
            Reprovados <span>{rejectedRequestRecords.length}</span>
          </button>
          <button
            className={managementFocus === "missing" ? "active" : ""}
            onClick={() => setManagementFocus("missing")}
          >
            Ausentes <span>{missingRequestRecords.length}</span>
          </button>
          <label className="management-process-filter">
            <span>Processo</span>
            <select
              value={managementProcess}
              onChange={(event) => setManagementProcess(event.target.value)}
            >
              {managementProcessOptions.map(([value, label]) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
            </select>
          </label>
        </div>
        <div className="management-list">
          {managementRecords.length ? managementRecords.slice(0, 10).map((record) => {
            const missingDocument = requiredRequestDocument(record);
            const queueLabel =
              managementFocus === "validation"
                ? "Pronto para decisão"
                : managementFocus === "rejected"
                  ? "Reprovado"
                  : "Documento ausente";
            const queueTone =
              managementFocus === "validation"
                ? "warning"
                : managementFocus === "rejected"
                  ? "danger"
                  : "neutral";
            return (
              <button
                key={record.id}
                className={`management-request-row ${managementFocus}`}
                onClick={() => onOpenApprovalRecord(record)}
              >
                <span
                  className="management-icon"
                  style={{
                    color: moduleMap[record.module]?.color,
                    background: moduleMap[record.module]?.lightColor,
                  }}
                >
                  <Icon name={record.module} size={18} />
                </span>
                <span className="management-main">
                  <strong>{record.title}</strong>
                  <small>
                    {moduleMap[record.module]?.shortLabel}
                    {showInternalCodes ? ` • ${record.reference}` : ""}
                    {" • "}Responsável: {requestOwner(record)}
                  </small>
                  {managementFocus === "rejected" &&
                  String(record.payload.managementDecisionReason || "").trim() ? (
                    <em>
                      Motivo: {String(record.payload.managementDecisionReason)}
                    </em>
                  ) : managementFocus === "missing" ? (
                    <em>Falta: {missingDocument.label}</em>
                  ) : (
                    <em>
                      {String(record.payload.priority || "Prioridade normal")}
                      {record.recordDate
                        ? ` • ${formatValue(
                            { type: "date" } as ModuleField,
                            record.recordDate,
                          )}`
                        : ""}
                    </em>
                  )}
                </span>
                <span className={`status-pill ${queueTone}`}>{queueLabel}</span>
                <span className="management-value">
                  {record.amount
                    ? currency.format(record.amount)
                    : formatValue(
                        { type: "date" } as ModuleField,
                        record.recordDate,
                      )}
                </span>
                <Icon name="arrow" size={17} />
              </button>
            );
          }) : (
            <div className="management-empty">
              <Icon
                name={managementFocus === "rejected" ? "history" : "check"}
                size={20}
              />
              <strong>Nenhum pedido nesta fila</strong>
              <small>
                Nenhum registro real ou fictício atende aos critérios desta etapa.
              </small>
            </div>
          )}
        </div>
        <footer className="management-footer management-footer-v75">
          <article className="management-footer-stat">
            <span><Icon name="queue" size={16} /></span>
            <div>
              <small>Registros na fila</small>
              <strong>{managementRecords.length} {managementRecords.length === 1 ? "pedido" : "pedidos"}</strong>
            </div>
          </article>
          <article className="management-footer-stat demo">
            <span>T</span>
            <div>
              <small>Dados de teste</small>
              <strong>{managementDemoCount} fictício(s)</strong>
            </div>
          </article>
          <article className="management-footer-stat">
            <span><Icon name="lock" size={16} /></span>
            <div>
              <small>Integridade</small>
              <strong>Auditoria ativa</strong>
            </div>
          </article>
          <article className="management-footer-stat value">
            <span>R$</span>
            <div>
              <small>Valor total da fila</small>
              <strong>{currency.format(managementQueueTotal)}</strong>
            </div>
          </article>
          <p className="management-footer-note">
            <Icon name="alert" size={14} />
            Registros fictícios permanecem visíveis em todo o sistema para testes até a remoção manual pelo administrador.
          </p>
        </footer>
      </section>

    </div>
  );
}

function ModulePage({
  module,
  records,
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
  headerModule,
  topNavigation,
  variant,
  hideHeading = false,
  hidePrimaryAction = false,
}: {
  module: ModuleDefinition;
  records: StoredRecord[];
  search: string;
  setSearch: (value: string) => void;
  status: string;
  setStatus: (value: string) => void;
  onNew: () => void;
  onEdit: (record: StoredRecord) => void;
  onDelete: (record: StoredRecord) => void;
  onImport: () => void;
  onOpen: (record: StoredRecord) => void;
  canEdit: boolean;
  headerModule?: ModuleDefinition;
  topNavigation?: ReactNode;
  /* Quem renderiza sabe a estrutura; o ModulePage não deduz. */
  variant: ModuleHeaderVariant;
  /*
   * Telas com painel próprio acima (Obra e Máquinas) não mostram o
   * cabeçalho genérico. Isso era feito escondendo-o por CSS — no V101 com
   * uma classe posta por JavaScript, no V107 com `:has()`. Agora é uma
   * condição declarada por quem renderiza: mais simples de ler, e imune à
   * remoção das classes globais.
   */
  hideHeading?: boolean;
  /*
   * A tela Administrativo concentra os cadastros no painel "Ações
   * rápidas", logo abaixo — o botão do cabeçalho seria o mesmo comando
   * duas vezes na mesma tela.
   *
   * Isso era feito por CSS, escondendo `.button.primary` dentro de
   * `.module-heading`. A regra morreu junto com a classe global na etapa
   * 5D, e a linha de base não teria acusado: ela roda em modo visitante,
   * onde o cabeçalho mostra um selo de consulta e não há botão nenhum
   * para esconder.
   */
  hidePrimaryAction?: boolean;
}) {
  const { visible: showInternalCodes, toggle: toggleInternalCodes } =
    useContext(InternalCodeVisibilityContext);
  /*
   * Aba de treinamento escolhida. Vazia significa "todos".
   *
   * Mora aqui, e não numa segunda lista, porque a aba RECORTA a tabela de
   * baixo em vez de duplicá-la. Uma lista por aba mais a lista geral seriam
   * dois lugares mostrando o mesmo dado — e a hora em que discordassem seria
   * exatamente a hora de conferir antes da reunião de segurança.
   */
  const [trainingTab, setTrainingTab] = useState("");
  const presentationModule = headerModule || module;
  const statuses = Array.from(
    new Set(records.map(recordStatusLabel).filter(Boolean)),
  );
  const peopleStatusCounts = {
    active: records.filter((record) => recordStatusLabel(record) === "Ativo").length,
    vacation: records.filter((record) => recordStatusLabel(record) === "Férias").length,
    inactive: records.filter((record) =>
      ["Em desligamento", "Desligado"].includes(recordStatusLabel(record)),
    ).length,
  };
  const visibleRecords = records.filter((record) => {
    const haystack = `${record.title} ${record.reference} ${JSON.stringify(
      record.payload,
    )}`.toLowerCase();
    const displayedStatus = recordStatusLabel(record);
    const matchesStatus =
      !status ||
      (module.id === "people" && status === "__inactive__"
        ? ["Em desligamento", "Desligado"].includes(displayedStatus)
        : displayedStatus === status);
    const matchesTraining =
      module.id !== "trainings" ||
      !trainingTab ||
      String(record.payload.trainingType ?? "").trim() === trainingTab;
    return (
      (!search || haystack.includes(search.toLowerCase())) &&
      matchesStatus &&
      matchesTraining
    );
  });
  const total = records.reduce(
    (sum, record) =>
      sum +
      (module.id === "people"
        ? Number(record.payload.salary || 0)
        : Number(record.amount)),
    0,
  );
  const open = records.filter(isPending).length;
  const hasAmount = Boolean(module.amountField);
  const tableColumns = module.tableColumns.filter(
    (key) => showInternalCodes || !isInternalCodeField(module, key),
  );

  return (
    <div className="page-stack">
      {hideHeading ? null : (
        <ModuleHeader
          variant={variant}
          moduleId={presentationModule.id}
          iconStyle={{
            color: presentationModule.color,
            backgroundColor: presentationModule.lightColor,
          }}
          icon={<Icon name={presentationModule.id} size={26} />}
          eyebrow={presentationModule.eyebrow}
          title={presentationModule.label}
          description={presentationModule.description}
          actions={
            canEdit && !hidePrimaryAction ? (
              <button className="button primary" onClick={onNew}>
                <Icon name="plus" size={18} />
                {actionLabels[module.id] || "Novo registro"}
              </button>
            ) : canEdit ? null : (
              <span className="read-only-chip">
                <Icon name="eye" size={16} /> Consulta protegida
              </span>
            )
          }
        />
      )}

      <aside className="module-guide">
        <span className="guide-icon">
          <Icon name="check" size={18} />
        </span>
        <div>
          <strong>Como usar esta tela</strong>
          <p>{moduleTips[module.id]}</p>
        </div>
      </aside>

      {topNavigation}

      {module.id === "field_leave" ? (
        <FieldLeaveSummary records={records} />
      ) : null}

      {module.id === "trainings" ? (
        <>
          <TrainingsSummary records={records} />
          <TrainingsTabs
            records={records}
            active={trainingTab}
            onSelect={setTrainingTab}
          />
        </>
      ) : null}

      {module.id === "people" ? (
        <nav className="people-status-tabs" aria-label="Situação dos colaboradores">
          {[
            ["Ativos", "Ativo", peopleStatusCounts.active],
            ["Férias", "Férias", peopleStatusCounts.vacation],
            ["Inativos", "__inactive__", peopleStatusCounts.inactive],
          ].map(([label, value, count]) => (
            <button
              key={String(value)}
              type="button"
              className={status === value ? "active" : ""}
              onClick={() => setStatus(status === value ? "" : String(value))}
            >
              <span>{label}</span>
              <strong>{String(count)}</strong>
            </button>
          ))}
          <p>O status é reutilizado na seleção da folha e dos cálculos. Férias não usam uma data padrão: cada colaborador mantém seu próprio período aquisitivo.</p>
        </nav>
      ) : null}

      {module.id === "rules" ? (
        <aside className="rule-engine-explainer">
          <div>
            <strong>O que o Motor de Regras faz hoje</strong>
            <p>Versiona fontes, vigências e parâmetros homologados usados pelos cálculos e validações do sistema.</p>
          </div>
          <div>
            <strong>O que ele não faz sozinho</strong>
            <p>Uma regra cadastrada não executa código automaticamente. Ela precisa estar ligada a uma validação ou cálculo testado.</p>
          </div>
          <div>
            <strong>Como melhorar com segurança</strong>
            <p>Definir condição, ação, prioridade, vigência, responsável, cenário de teste e aprovação antes de ativar.</p>
          </div>
        </aside>
      ) : null}

      {module.id === "emails" ? (
        <aside className="info-strip microsoft">
          <span className="info-logo">M</span>
          <div>
            <strong>Administração do Microsoft 365</strong>
            <p>
              Este módulo controla contas, licenças e segurança. A criação da
              caixa postal e as políticas de criptografia são aplicadas no
              Exchange Admin pela conta administrativa da Beta.
            </p>
          </div>
          <a href="https://admin.microsoft.com" target="_blank" rel="noreferrer">
            Abrir Microsoft 365 Admin <Icon name="arrow" size={16} />
          </a>
        </aside>
      ) : null}

      <section className="mini-kpis">
        <article>
          <span>Registros</span>
          <strong>{records.length}</strong>
          <small>itens cadastrados</small>
        </article>
        <article>
          <span>Pendências</span>
          <strong>{open}</strong>
          <small>exigem conferência</small>
        </article>
        <article>
          <span>{hasAmount ? "Valor registrado" : "Atualizados hoje"}</span>
          <strong>
            {hasAmount
              ? compactCurrency.format(total)
              : records.filter(
                  (record) =>
                    record.updatedAt.slice(0, 10) ===
                    new Date().toISOString().slice(0, 10),
                ).length}
          </strong>
          <small>{hasAmount ? "total deste módulo" : "registros"}</small>
        </article>
      </section>

      <section className="content-card table-card">
        <div className="table-toolbar">
          <label className="search-box">
            <Icon name="search" size={18} />
            <input
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder={`Buscar em ${module.shortLabel.toLowerCase()}…`}
            />
          </label>
          {module.id !== "people" ? (
            <select
              className="filter-select"
              value={status}
              onChange={(event) => setStatus(event.target.value)}
            >
              <option value="">Todos os status</option>
              {statuses.map((item) => (
                <option key={item}>{item}</option>
              ))}
            </select>
          ) : null}
          {canEdit && isImportableModule(module.id) ? (
            <>
              {/*
                * O modelo vem ANTES do botão de importar de propósito: é a
                * ordem em que o trabalho acontece. Baixar, preencher,
                * importar.
                *
                * Sem ele, quem nunca importou precisa adivinhar os nomes das
                * colunas — e uma coluna com nome errado é ignorada em
                * silêncio, o que parece "importou e não veio nada".
                */}
              <button
                className="button secondary compact-button"
                onClick={() => exportImportTemplate(module)}
                title="Planilha em branco com as colunas certas e uma aba explicando cada uma"
              >
                <Icon name="download" size={17} /> Modelo
              </button>
              <button className="button secondary compact-button" onClick={onImport}>
                <Icon name="upload" size={17} /> Importar
              </button>
            </>
          ) : null}
          {canEdit ? (
            <button
              type="button"
              className={`button secondary compact-button internal-code-button ${
                showInternalCodes ? "active" : ""
              }`}
              onClick={toggleInternalCodes}
            >
              <Icon name={showInternalCodes ? "eye" : "lock"} size={16} />
              {showInternalCodes
                ? "Ocultar identificadores"
                : "Mostrar identificadores"}
            </button>
          ) : null}
          {canEdit ? (
            <button
              className="button secondary compact-button"
              disabled={!records.length}
              onClick={() => exportModuleWorkbook(module, records)}
            >
              <Icon name="download" size={17} /> Excel
            </button>
          ) : null}
        </div>
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                {tableColumns.map((key) => (
                  <th key={key}>{fieldByKey(module, key)?.label || key}</th>
                ))}
                <th className="actions-head">
                  {canEdit ? "Ações" : "Detalhes"}
                </th>
              </tr>
            </thead>
            <tbody>
              {visibleRecords.map((record) => (
                <tr
                  key={record.id}
                  className="clickable-row"
                  onClick={() => onOpen(record)}
                  tabIndex={0}
                  onKeyDown={(event) => {
                    if (event.key === "Enter" || event.key === " ") onOpen(record);
                  }}
                >
                  {tableColumns.map((key) => {
                    const field = fieldByKey(module, key);
                    const value = record.payload[key];
                    if (field?.type === "url") {
                      return (
                        <td key={key}>
                          {value ? (
                            <a
                              className="document-link"
                              href={String(value)}
                              target="_blank"
                              rel="noreferrer"
                              onClick={(event) => event.stopPropagation()}
                            >
                              <Icon name="link" size={15} /> Abrir
                            </a>
                          ) : (
                            <span className="missing-link">Pendente</span>
                          )}
                        </td>
                      );
                    }
                    if (key === module.statusField) {
                      const displayedStatus = recordStatusLabel(record);
                      return (
                        <td key={key}>
                          <span
                            className={`status-pill ${statusTone(
                              displayedStatus,
                            )}`}
                          >
                            {displayedStatus}
                          </span>
                        </td>
                      );
                    }
                    if (key === "paymentStatus") {
                      return (
                        <td key={key}>
                          <span
                            className={`status-pill ${statusTone(
                              String(value || "Pendente"),
                            )}`}
                          >
                            {String(value || "Pendente")}
                          </span>
                        </td>
                      );
                    }
                    return (
                      <td key={key} title={String(value ?? "")}>
                        {formatValue(field, value)}
                      </td>
                    );
                  })}
                  <td className="row-actions">
                    <button
                      onClick={(event) => {
                        event.stopPropagation();
                        onOpen(record);
                      }}
                      aria-label="Ver detalhes"
                    >
                      <Icon name="eye" size={17} />
                    </button>
                    {canEdit ? (
                      <>
                        <button
                          onClick={(event) => {
                            event.stopPropagation();
                            onEdit(record);
                          }}
                          aria-label="Editar"
                        >
                          <Icon name="edit" size={17} />
                        </button>
                        <button
                          className="danger-action"
                          onClick={(event) => {
                            event.stopPropagation();
                            onDelete(record);
                          }}
                          aria-label="Excluir"
                        >
                          <Icon name="trash" size={17} />
                        </button>
                      </>
                    ) : null}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {!visibleRecords.length ? (
            <div className="table-empty">
              <span
                style={{ color: module.color, background: module.lightColor }}
              >
                <Icon name={module.id} size={26} />
              </span>
              <strong>
                {records.length
                  ? "Nenhum registro encontrado"
                  : `Nenhum item em ${module.shortLabel.toLowerCase()}`}
              </strong>
              <p>
                {records.length
                  ? "Ajuste os filtros para ampliar a busca."
                  : isImportableModule(module.id)
                    ? "Importe a planilha existente ou faça o primeiro cadastro."
                    : "Faça o primeiro cadastro para iniciar este módulo."}
              </p>
              {!records.length && canEdit ? (
                <div className="empty-actions">
                  {isImportableModule(module.id) ? (
                    <button className="button secondary" onClick={onImport}>
                      <Icon name="upload" size={17} /> Importar planilha
                    </button>
                  ) : null}
                  <button className="button primary" onClick={onNew}>
                    <Icon name="plus" size={17} /> Novo registro
                  </button>
                </div>
              ) : null}
            </div>
          ) : null}
        </div>
      </section>
    </div>
  );
}

function FinancialCenterPage({
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
  const [tab, setTab] = useState<"expenses" | "suppliers" | "approved" | "purchases">(
    "expenses",
  );
  const expenseRecords = allRecords.filter((record) => record.module === "expenses");
  const supplierRecords = allRecords.filter((record) => record.module === "suppliers");
  const purchaseRecords = allRecords.filter((record) => record.module === "purchases");
  const approvedRecords = expenseRecords.filter(
    (record) => requestDecisionState(record) === "approved",
  );
  const payableRecords = expenseRecords.filter(
    (record) => requestDecisionState(record) !== "approved",
  );
  const selectedModule =
    tab === "suppliers"
      ? moduleMap.suppliers
      : tab === "purchases"
        ? moduleMap.purchases
        : moduleMap.expenses;
  const selectedRecords =
    tab === "suppliers"
      ? supplierRecords
      : tab === "purchases"
        ? purchaseRecords
        : tab === "approved"
          ? approvedRecords
          : payableRecords;

  function selectTab(next: "expenses" | "suppliers" | "approved" | "purchases") {
    setTab(next);
    setSearch("");
    setStatus("");
  }

  return (
    <ModulePage
      variant="financial"
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
          <button
            type="button"
            className={tab === "purchases" ? "active" : ""}
            onClick={() => selectTab("purchases")}
          >
            Compras <span>{purchaseRecords.length}</span>
          </button>
        </nav>
      )}
    />
  );
}

function IntegrationHub({
  records,
  allRecords,
  importRuns,
  onNew,
  onEdit,
  onDelete,
  onImportAll,
  onResolveImportError,
  canEdit,
}: {
  records: StoredRecord[];
  allRecords: StoredRecord[];
  importRuns: ImportRunView[];
  onNew: () => void;
  onEdit: (record: StoredRecord) => void;
  onDelete: (record: StoredRecord) => void;
  onImportAll: () => void;
  onResolveImportError: (id: string) => void;
  canEdit: boolean;
}) {
  const services = [
    {
      name: "SharePoint",
      detail: "Notas, contratos, comprovantes e documentos oficiais",
      status: records.some((r) => String(r.payload.service) === "SharePoint" && r.status === "Publicado")
        ? "Publicado"
        : "Aguardando configuração",
      href: records.find((r) => String(r.payload.service) === "SharePoint")?.payload.url,
    },
    {
      name: "Microsoft Lists",
      detail: "Bases colaborativas para os módulos operacionais",
      status: records.some((r) => String(r.payload.service) === "Microsoft Lists" && r.status === "Publicado")
        ? "Publicado"
        : "Mapeado",
      href: records.find((r) => String(r.payload.service) === "Microsoft Lists")?.payload.url,
    },
    {
      name: "Teams",
      detail: "Portal de acesso para gestores e equipes",
      status: records.some((r) => String(r.payload.service) === "Teams" && r.status === "Publicado")
        ? "Publicado"
        : "Aguardando configuração",
      href: records.find((r) => String(r.payload.service) === "Teams")?.payload.url,
    },
    {
      name: "Power Automate",
      detail: "Aprovações, alertas de vencimento e cobranças",
      status: records.some((r) => String(r.payload.service) === "Power Automate" && r.status === "Publicado")
        ? "Publicado"
        : "Fluxos planejados",
      href: records.find((r) => String(r.payload.service) === "Power Automate")?.payload.url,
    },
    {
      name: "Outlook / Exchange",
      detail: "E-mails @betaconstrutora.com.br e segurança",
      status: records.some((r) => String(r.payload.service) === "Outlook/Exchange" && r.status === "Publicado")
        ? "Publicado"
        : "Aguardando tenant",
      href: records.find((r) => String(r.payload.service) === "Outlook/Exchange")?.payload.url,
    },
    {
      name: "Excel",
      detail: "Importador inteligente controlado para Obras, Custos, Máquinas e Funcionários",
      status: "Pronto",
      href: "",
    },
  ];

  return (
    <div className="page-stack">
      <ModuleHeader
        variant="executive"
        iconClass="microsoft-icon"
        icon={<Icon name="m365" size={26} />}
        eyebrow="MICROSOFT 365"
        title="Integrações e publicação"
        description={
          <>
            Conecte o sistema às bases, documentos, equipes e caixas postais
            oficiais da Beta.
          </>
        }
        actions={
          canEdit ? (
            <button className="button primary" onClick={onNew}>
              <Icon name="plus" size={18} /> Registrar integração
            </button>
          ) : (
            <span className="read-only-chip">
              <Icon name="eye" size={16} /> Catálogo em consulta
            </span>
          )
        }
      />

      <section className="integration-hero">
        <div>
          <span className="hero-kicker">TRANSIÇÃO SEM REDIGITAÇÃO</span>
          <h2>As planilhas já criadas entram direto no sistema.</h2>
          <p>
            O Importador Inteligente aceita Obras, Custos, Máquinas e
            Funcionários em Excel ou CSV. Ele reconhece tabelas verticais,
            horizontais e matrizes de datas, apresenta uma prévia e isola as
            linhas inválidas para correção.
          </p>
          <div className="hero-actions">
            {canEdit ? (
              <>
                <button className="button light" onClick={onImportAll}>
                  <Icon name="upload" size={18} /> Importar Obras, Custos, Máquinas ou Funcionários
                </button>
                <button
                  className="button ghost-light"
                  disabled={!allRecords.length}
                  onClick={() => exportAllWorkbook(allRecords)}
                >
                  <Icon name="download" size={18} /> Backup completo em Excel
                </button>
              </>
            ) : (
              <span className="integration-view-label">
                Dados de integração disponíveis para consulta
              </span>
            )}
          </div>
        </div>
        <div className="import-metrics">
          <strong>{allRecords.length}</strong>
          <span>registros no sistema</span>
          <small>Banco online com auditoria</small>
        </div>
      </section>

      {canEdit ? (
        <section className="content-card table-card">
          <div className="card-heading integration-table-title">
            <div>
              <span className="eyebrow">IMPORTAÇÕES E FILA DE CORREÇÃO</span>
              <h2>Histórico dos arquivos processados</h2>
              <p>
                Linhas válidas são gravadas em lotes; pendências ficam isoladas
                aqui e não contaminam os registros corretos.
              </p>
            </div>
            <span className="soft-badge">
              {importRuns.reduce((total, run) => total + run.errors.length, 0)} pendências
            </span>
          </div>
          {importRuns.length ? (
            <div className="table-wrap">
              <table>
                <thead>
                  <tr>
                    <th>Arquivo</th>
                    <th>Situação</th>
                    <th>Incluídos</th>
                    <th>Atualizados</th>
                    <th>Ignorados</th>
                    <th>Pendências</th>
                    <th>Finalização</th>
                  </tr>
                </thead>
                <tbody>
                  {importRuns.map((run) => (
                    <tr key={run.id}>
                      <td>
                        <strong>{run.fileName}</strong>
                        <small>{run.targetModule || "Detecção automática"}</small>
                      </td>
                      <td>
                        <span
                          className={`status-pill ${
                            run.status === "Falha"
                              ? "danger"
                              : run.errors.length
                                ? "warning"
                                : statusTone(run.status)
                          }`}
                        >
                          {run.status}
                        </span>
                      </td>
                      <td>{run.totalSuccess}</td>
                      <td>{run.totalUpdated}</td>
                      <td>{run.totalSkipped}</td>
                      <td>
                        {run.errors.length ? (
                          <details>
                            <summary>{run.errors.length} para corrigir</summary>
                            <div className="import-error-list">
                              {run.errors.map((error) => (
                                <article key={error.id}>
                                  <strong>
                                    {error.sheet || "Planilha"} • linha {error.rowNumber}
                                  </strong>
                                  <p>{error.reason}</p>
                                  <button
                                    type="button"
                                    className="button secondary"
                                    onClick={() => onResolveImportError(error.id)}
                                  >
                                    <Icon name="check" size={15} /> Marcar como resolvida
                                  </button>
                                </article>
                              ))}
                            </div>
                          </details>
                        ) : (
                          <span className="soft-badge">Nenhuma</span>
                        )}
                      </td>
                      <td>
                        {run.finishedAt
                          ? new Date(run.finishedAt).toLocaleString("pt-BR")
                          : "Em processamento"}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="empty-state compact-empty">
              <Icon name="upload" size={24} />
              <strong>Nenhum arquivo processado nesta versão.</strong>
              <p>O primeiro relatório aparecerá após uma importação confirmada.</p>
            </div>
          )}
        </section>
      ) : null}

      <section className="service-grid">
        {services.map((service) => (
          <article key={service.name} className="service-card">
            <span className="service-logo">{service.name.slice(0, 1)}</span>
            <div>
              <h3>{service.name}</h3>
              <p>{service.detail}</p>
            </div>
            <span className={`status-pill ${statusTone(service.status)}`}>
              {service.status}
            </span>
            {service.href ? (
              <a href={String(service.href)} target="_blank" rel="noreferrer">
                Abrir <Icon name="arrow" size={15} />
              </a>
            ) : null}
          </article>
        ))}
      </section>

      <aside className="info-strip">
        <span className="info-icon">
          <Icon name="alert" />
        </span>
        <div>
          <strong>O sistema já funciona de forma independente.</strong>
          <p>
            A sincronização automática com o ambiente Microsoft 365 exige que a
            Beta forneça acesso administrativo acompanhado ao tenant, domínio e
            sites. Até isso ocorrer, a importação e o backup em Excel mantêm a
            transição segura.
          </p>
        </div>
      </aside>

      <section className="content-card table-card">
        <div className="card-heading integration-table-title">
          <div>
            <span className="eyebrow">CATÁLOGO DE PUBLICAÇÃO</span>
            <h2>Links e objetos configurados</h2>
          </div>
          <span className="soft-badge">{records.length} objetos</span>
        </div>
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Serviço</th>
                <th>Objeto / nome</th>
                <th>Responsável</th>
                <th>Status</th>
                <th>Link</th>
                {canEdit ? <th className="actions-head">Ações</th> : null}
              </tr>
            </thead>
            <tbody>
              {records.map((record) => (
                <tr key={record.id}>
                  <td>{formatValue(fieldByKey(moduleMap.m365, "service"), record.payload.service)}</td>
                  <td>{record.title}</td>
                  <td>{formatValue(fieldByKey(moduleMap.m365, "owner"), record.payload.owner)}</td>
                  <td>
                    <span className={`status-pill ${statusTone(record.status)}`}>
                      {record.status}
                    </span>
                  </td>
                  <td>
                    {record.payload.url ? (
                      <a
                        className="document-link"
                        href={String(record.payload.url)}
                        target="_blank"
                        rel="noreferrer"
                      >
                        <Icon name="link" size={15} /> Abrir
                      </a>
                    ) : (
                      <span className="missing-link">Pendente</span>
                    )}
                  </td>
                  {canEdit ? (
                    <td className="row-actions">
                      <button onClick={() => onEdit(record)} aria-label="Editar">
                        <Icon name="edit" size={17} />
                      </button>
                      <button
                        className="danger-action"
                        onClick={() => onDelete(record)}
                        aria-label="Excluir"
                      >
                        <Icon name="trash" size={17} />
                      </button>
                    </td>
                  ) : null}
                </tr>
              ))}
            </tbody>
          </table>
          {!records.length ? (
            <div className="table-empty">
              <span className="microsoft-icon">
                <Icon name="m365" size={26} />
              </span>
              <strong>Nenhum link do Microsoft 365 registrado</strong>
              <p>
                Cadastre os objetos à medida que Teams, SharePoint, Lists e
                fluxos forem publicados.
              </p>
              {canEdit ? (
                <button className="button primary" onClick={onNew}>
                  <Icon name="plus" size={17} /> Registrar integração
                </button>
              ) : null}
            </div>
          ) : null}
        </div>
      </section>
    </div>
  );
}

function ComplianceCenter({
  records,
  search,
  setSearch,
  status,
  setStatus,
  onNavigate,
  onNew,
  onEdit,
  onDelete,
  onImport,
  onOpen,
  canEdit,
}: {
  records: StoredRecord[];
  search: string;
  setSearch: (value: string) => void;
  status: string;
  setStatus: (value: string) => void;
  onNavigate: (view: string) => void;
  onNew: (moduleId: string) => void;
  onEdit: (record: StoredRecord) => void;
  onDelete: (record: StoredRecord) => void;
  onImport: (moduleId: string) => void;
  onOpen: (record: StoredRecord) => void;
  canEdit: boolean;
}) {
  const [tab, setTab] = useState<"overview" | "rules">("overview");
  const events = records.filter((record) => record.module === "compliance");
  const rules = records.filter((record) => record.module === "rules");
  const sealedOrReady = events.filter((record) =>
    ["Validado internamente", "Pronto para transmissão"].includes(record.status),
  ).length;
  const processing = events.filter((record) =>
    ["Transmitido", "Em processamento"].includes(record.status),
  ).length;
  const completed = events.filter(
    (record) => record.status === "Processado com sucesso",
  ).length;
  const rejected = events.filter((record) =>
    record.status.toLowerCase().includes("rejeitado"),
  ).length;
  const activeRules = rules.filter((record) => record.status === "Ativa").length;

  function selectTab(next: "overview" | "rules") {
    setTab(next);
    setSearch("");
    setStatus("");
  }

  const complianceTabs = (
    <nav className="financial-center-tabs" aria-label="Áreas da Central Fiscal e Compliance">
      <button
        type="button"
        className={tab === "overview" ? "active" : ""}
        onClick={() => selectTab("overview")}
      >
        Visão geral <span>{events.length}</span>
      </button>
      <button
        type="button"
        className={tab === "rules" ? "active" : ""}
        onClick={() => selectTab("rules")}
      >
        Motor de Regras <span>{rules.length}</span>
      </button>
    </nav>
  );

  if (tab === "rules") {
    return (
      <ModulePage
        variant="financial"
        module={moduleMap.rules}
        records={rules}
        search={search}
        setSearch={setSearch}
        status={status}
        setStatus={setStatus}
        onNew={() => onNew("rules")}
        onEdit={onEdit}
        onDelete={onDelete}
        onImport={() => onImport("rules")}
        onOpen={onOpen}
        canEdit={canEdit}
        topNavigation={complianceTabs}
      />
    );
  }

  return (
    <div className="page-stack compliance-page">
      <ModuleHeader
        variant="financial"
        accent="compliance"
        variantClass="compliance-heading"
        iconClass="compliance-icon"
        icon={<Icon name="compliance" size={27} />}
        eyebrow="FISCAL • REGRAS • OBRIGAÇÕES DIGITAIS"
        title="Central Fiscal & Compliance"
        description={
          <>
            Controle de leiautes, vigências, eventos, protocolos, recibos,
            CNO e evidências de homologação em uma trilha única.
          </>
        }
        actions={
          <div className="compliance-heading-actions">
            {canEdit ? (
              <>
                <button className="button primary" onClick={() => onNew("compliance")}>
                  <Icon name="plus" size={17} /> Preparar evento
                </button>
                <button className="button secondary" onClick={() => onNew("rules")}>
                  <Icon name="rules" size={17} /> Cadastrar regra
                </button>
              </>
            ) : (
              <span className="read-only-chip">
                <Icon name="eye" size={16} /> Visão demonstrativa
              </span>
            )}
          </div>
        }
      />

      {complianceTabs}

      <aside className="compliance-boundary-note">
        <Icon name="lock" size={20} />
        <div>
          <strong>Preparação não é transmissão oficial</strong>
          <p>
            O sistema só considera um evento transmitido quando existe protocolo e
            só considera sucesso quando existe recibo/retorno. A assinatura A1/A3 e
            o envio ao governo dependem do conector seguro e das credenciais da empresa.
          </p>
        </div>
      </aside>

      <section className="compliance-kpis">
        {[
          ["Eventos preparados", events.length, `${sealedOrReady} validados ou prontos`, "compliance"],
          ["Em processamento", processing, `${completed} concluídos`, "queue"],
          ["Regras ativas", activeRules, `${rules.length} versões cadastradas`, "rules"],
        ].map(([label, value, detail, icon]) => (
          <article key={String(label)}>
            <span><Icon name={String(icon)} size={19} /></span>
            <div>
              <small>{label}</small>
              <strong>{String(value)}</strong>
              <p>{detail}</p>
            </div>
          </article>
        ))}
      </section>

      <section className="content-card compliance-pipeline">
        <div className="card-heading">
          <div>
            <span className="eyebrow">PIPELINE DE OBRIGAÇÕES</span>
            <h2>Da preparação ao recibo oficial</h2>
          </div>
          <span className={`status-pill ${rejected ? "danger" : "success"}`}>
            {rejected ? `${rejected} rejeição(ões)` : "Sem rejeições abertas"}
          </span>
        </div>
        <div className="pipeline-steps">
          {[
            ["1", "Preparar", events.length, "Dados e competência"],
            ["2", "Validar", sealedOrReady, "Leiaute e regras"],
            ["3", "Transmitir", processing, "Protocolo do lote"],
            ["4", "Confirmar", completed, "Recibo e retorno"],
          ].map(([step, title, value, detail]) => (
            <article key={String(step)}>
              <span>{step}</span>
              <div>
                <strong>{title}</strong>
                <small>{detail}</small>
              </div>
              <b>{String(value)}</b>
            </article>
          ))}
        </div>
      </section>

      <section className="context-grid">
        {boundedContexts.map((context) => (
          <article key={context.id}>
            <span className="context-icon">
              <Icon
                name={
                  context.id === "engineering"
                    ? "works"
                    : context.id === "people"
                      ? "people"
                      : context.id === "compliance"
                        ? "compliance"
                        : "expenses"
                }
                size={21}
              />
            </span>
            <h3>{context.title}</h3>
            <p>{context.description}</p>
            <div>
              {context.modules.map((moduleId) => (
                <button
                  key={moduleId}
                  onClick={() =>
                    moduleId === "rules" ? selectTab("rules") : onNavigate(moduleId)
                  }
                >
                  {moduleMap[moduleId]?.shortLabel || moduleId}
                </button>
              ))}
            </div>
          </article>
        ))}
      </section>

      <section className="content-card capability-card">
        <div className="card-heading">
          <div>
            <span className="eyebrow">CAPACIDADE REAL DO DEPLOY</span>
            <h2>O que está operacional e o que exige infraestrutura externa</h2>
          </div>
        </div>
        <div className="capability-list">
          {erpCapabilities.map((capability) => (
            <article key={capability.id}>
              <span
                className={`capability-state ${capability.state.toLowerCase()}`}
              >
                {capabilityLabel(capability.state)}
              </span>
              <div>
                <strong>{capability.title}</strong>
                <p>{capability.description}</p>
                <small>{capability.detail}</small>
              </div>
            </article>
          ))}
        </div>
      </section>

      <div className="compliance-columns">
        <section className="content-card compliance-events">
          <div className="card-heading">
            <div>
              <span className="eyebrow">EVENTOS</span>
              <h2>Fila fiscal e retornos</h2>
            </div>
            {canEdit ? (
              <button
                className="text-button"
                onClick={() => onNew("compliance")}
              >
                Novo evento <Icon name="arrow" size={14} />
              </button>
            ) : null}
          </div>
          <div className="compliance-event-list">
            {events.slice(0, 8).map((record) => (
              <button key={record.id} onClick={() => onOpen(record)}>
                <span className="event-system">
                  {String(record.payload.system || "Fiscal").slice(0, 3)}
                </span>
                <span>
                  <strong>{record.title}</strong>
                  <small>
                    {String(record.payload.eventCode || "Sem código")} •{" "}
                    {String(record.payload.layoutVersion || "Leiaute a definir")}
                  </small>
                </span>
                <span className={`status-pill ${statusTone(record.status)}`}>
                  {record.status}
                </span>
                <Icon name="arrow" size={15} />
              </button>
            ))}
            {!events.length ? (
              <p className="compact-empty">Nenhum evento fiscal cadastrado.</p>
            ) : null}
          </div>
        </section>

        <section className="content-card compliance-rules">
          <div className="card-heading">
            <div>
              <span className="eyebrow">REGRAS E VIGÊNCIAS</span>
              <h2>Catálogo homologável</h2>
            </div>
            <button className="text-button" onClick={() => selectTab("rules")}>
              Ver regras <Icon name="arrow" size={14} />
            </button>
          </div>
          <div className="rule-version-list">
            {rules.slice(0, 6).map((record) => (
              <button key={record.id} onClick={() => onOpen(record)}>
                <span><Icon name="rules" size={17} /></span>
                <div>
                  <strong>{record.title}</strong>
                  <small>
                    {String(record.payload.version || "Sem versão")} • vigência{" "}
                    {String(record.payload.validFrom || record.recordDate).slice(0, 10)}
                  </small>
                </div>
                <span className={`status-pill ${statusTone(record.status)}`}>
                  {record.status}
                </span>
              </button>
            ))}
          </div>
          <footer>
            <strong>Fontes oficiais de referência</strong>
            {complianceSources.map((source) => (
              <a key={source.label} href={source.url} target="_blank" rel="noreferrer">
                <span>{source.label}</span>
                <small>{source.version}</small>
                <Icon name="arrow" size={14} />
              </a>
            ))}
          </footer>
        </section>
      </div>
    </div>
  );
}

const defaultPayrollInput: PayrollInput = {
  employeeName: "",
  employeeCode: "",
  role: "",
  workName: "",
  competence: "2026-07-01",
  baseSalary: 0,
  monthlyHours: 220,
  overtimeHours: 0,
  overtimePercent: 50,
  additionalType: "NONE",
  insalubrityDegree: 20,
  insalubrityBase: payrollRules2026.minimumWage,
  taxableAdditions: 0,
  nonTaxableEarnings: 0,
  dependents: 0,
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
};

function PayrollStudio({
  people,
  previews,
  saving,
  onSave,
  onRunBatch,
  companyProfile,
  canEdit,
}: {
  people: StoredRecord[];
  previews: StoredRecord[];
  saving: boolean;
  onSave: (input: PayrollInput) => Promise<void>;
  onRunBatch: (
    competence: string,
    work: string,
  ) => Promise<BatchPayrollResponse>;
  companyProfile: SystemSettings;
  canEdit: boolean;
}) {
  const { visible: showInternalCodes } = useContext(
    InternalCodeVisibilityContext,
  );
  const [input, setInput] = useState<PayrollInput>(defaultPayrollInput);
  const [syncInfo, setSyncInfo] = useState(false);
  const [batchCompetence, setBatchCompetence] = useState("2026-07");
  const [batchWork, setBatchWork] = useState("");
  const [batchRunning, setBatchRunning] = useState(false);
  const [batchResult, setBatchResult] = useState<BatchPayrollResponse | null>(
    null,
  );
  const [batchError, setBatchError] = useState("");
  const result = useMemo(() => calculatePayroll(input), [input]);
  const parseProfileNumber = (value: string, fallback: number) => {
    const normalized = String(value || "").trim().replace(",", ".");
    if (!normalized) return fallback;
    const parsed = Number(normalized);
    return Number.isFinite(parsed) ? parsed : fallback;
  };
  const setNumber = (key: keyof PayrollInput, value: string) =>
    setInput((current) => ({ ...current, [key]: Number(value) || 0 }));
  const batchWorks = Array.from(
    new Set(
      people
        .map((person) => String(person.payload.work || "").trim())
        .filter(Boolean),
    ),
  ).sort();
  const eligibleBatchPeople = people.filter(
    (person) =>
      person.status.toLowerCase() === "ativo" &&
      (!batchWork || String(person.payload.work || "").trim() === batchWork),
  );

  async function runBatch() {
    setBatchRunning(true);
    setBatchError("");
    try {
      const response = await onRunBatch(batchCompetence, batchWork);
      setBatchResult(response);
    } catch (error) {
      setBatchResult(null);
      setBatchError(
        error instanceof Error
          ? error.message
          : "Não foi possível processar o lote.",
      );
    } finally {
      setBatchRunning(false);
    }
  }

  useEffect(() => {
    const configured = [
      companyProfile.employerInssPercent,
      companyProfile.rat,
      companyProfile.fap,
      companyProfile.thirdPartiesPercent,
    ].every((value) => String(value || "").trim());
    const timer = window.setTimeout(() => {
      setInput((current) => ({
        ...current,
        employerInssPercent: parseProfileNumber(
          companyProfile.employerInssPercent,
          current.employerInssPercent,
        ),
        ratPercent: parseProfileNumber(
          companyProfile.rat,
          current.ratPercent,
        ),
        fapFactor: parseProfileNumber(
          companyProfile.fap,
          current.fapFactor,
        ),
        thirdPartiesPercent: parseProfileNumber(
          companyProfile.thirdPartiesPercent,
          current.thirdPartiesPercent,
        ),
        employerParameterSource: configured
          ? "COMPANY_PROFILE"
          : "ESTIMATE",
      }));
    }, 0);
    return () => window.clearTimeout(timer);
  }, [
    companyProfile.employerInssPercent,
    companyProfile.rat,
    companyProfile.fap,
    companyProfile.thirdPartiesPercent,
  ]);

  const chooseEmployee = (recordId: string) => {
    const person = people.find((item) => String(item.id) === recordId);
    if (!person) {
      setInput((current) => ({
        ...current,
        employeeName: "",
        employeeCode: "",
        role: "",
        workName: "",
        baseSalary: 0,
      }));
      return;
    }
    setInput((current) => ({
      ...current,
      employeeName: String(person.payload.name || person.title),
      employeeCode: String(person.payload.employeeCode || person.reference),
      role: String(person.payload.role || ""),
      workName: String(person.payload.work || ""),
      baseSalary: Number(person.payload.salary || 0),
      monthlyHours: Number(person.payload.monthlyHours || 220),
      dependents: Number(person.payload.dependents || 0),
      fgtsCategory: /aprendiz/i.test(String(person.payload.contractType || ""))
        ? "APPRENTICE"
        : "STANDARD",
    }));
  };

  return (
    <div className="page-stack payroll-page">
      <ModuleHeader
        variant="executive"
        accent="payroll"
        variantClass="payroll-heading"
        iconClass="payroll-icon"
        icon={<Icon name="payroll" size={27} />}
        eyebrow="RH • MOTOR DE CÁLCULO"
        title="Cálculo de Folha"
        description={
          <>
            Simulação mensal com INSS progressivo, IRRF 2026, redução mensal,
            FGTS, encargos e memória de cálculo.
          </>
        }
        actions={
          <div className="payroll-heading-actions">
            <button className="time-sync-button" onClick={() => setSyncInfo((current) => !current)}>
              <Icon name="refresh" size={17} />
              Sincronizar com o ponto
              <small>Integração futura</small>
            </button>
            <span className="rules-chip">
              Regras {payrollRules2026.version}
            </span>
          </div>
        }
      />

      {syncInfo ? (
        <aside className="future-sync-panel">
          <span><Icon name="history" size={19} /></span>
          <div>
            <strong>Conector preparado para a próxima etapa</strong>
            <p>
              Futuramente, este botão importará horas normais, extras, faltas e
              ocorrências do sistema de ponto e da planilha auxiliar. Nenhum
              dado é sincronizado agora, evitando valores incorretos no cálculo.
            </p>
          </div>
          <button onClick={() => setSyncInfo(false)} aria-label="Fechar aviso">
            <Icon name="close" size={17} />
          </button>
        </aside>
      ) : null}

      <aside className="payroll-legal-note">
        <Icon name="alert" size={19} />
        <div>
          <strong>Cálculo administrativo para conferência</strong>
          <p>
            O resultado não fecha nem transmite a folha oficial. Convenção
            coletiva, enquadramento tributário e incidências das rubricas devem
            ser validados pela contabilidade.
          </p>
        </div>
      </aside>

      <section className="content-card batch-payroll-panel">
        <div className="batch-payroll-intro">
          <span className="batch-icon"><Icon name="queue" size={22} /></span>
          <div>
            <span className="eyebrow">PROCESSAMENTO SERVER-SIDE</span>
            <h2>Folha em lote por competência e obra</h2>
            <p>
              O servidor lê os colaboradores ativos diretamente do Cadastro de
              Funcionários, aplica a mesma versão de regras e grava um resumo com
              hash da execução para conferência.
            </p>
          </div>
          <span className="batch-limit">Até 500 colaboradores por lote</span>
        </div>
        <div className="batch-controls">
          <label>
            <span>Competência do lote</span>
            <input
              type="month"
              value={batchCompetence}
              onChange={(event) => setBatchCompetence(event.target.value)}
            />
          </label>
          <label>
            <span>Obra / centro de custo</span>
            <select
              value={batchWork}
              onChange={(event) => setBatchWork(event.target.value)}
            >
              <option value="">Todas as obras</option>
              {batchWorks.map((work) => <option key={work}>{work}</option>)}
            </select>
          </label>
          <div className="batch-scope">
            <span>Escopo encontrado</span>
            <strong>{eligibleBatchPeople.length} colaboradores ativos</strong>
            <small>Fonte: Cadastro de Funcionários persistente</small>
          </div>
          {canEdit ? (
            <button
              className="button primary"
              disabled={
                batchRunning ||
                !batchCompetence ||
                eligibleBatchPeople.length === 0
              }
              onClick={runBatch}
            >
              <Icon name="queue" size={17} />
              {batchRunning ? "Processando lote…" : "Calcular e registrar lote"}
            </button>
          ) : (
            <button
              className="button secondary"
              type="button"
              disabled
              title="A administração é autenticada pelo Cloudflare Access."
            >
              Acesso administrativo protegido
            </button>
          )}
        </div>
        {batchError ? (
          <p className="batch-message error"><Icon name="alert" size={15} /> {batchError}</p>
        ) : null}
        {batchResult ? (
          <div className="batch-result">
            <header>
              <div>
                <span className="eyebrow">LOTE PROCESSADO</span>
                <strong>
                  {batchResult.meta.quantidadeColaboradores} colaboradores •{" "}
                  {batchResult.meta.competencia.slice(0, 7)}
                </strong>
                <small>
                  {batchResult.meta.fonte} • regras{" "}
                  {batchResult.meta.rulesVersion || payrollRules2026.version}
                </small>
              </div>
              <span className="status-pill success">Salvo para conferência</span>
            </header>
            <div className="batch-totals">
              {[
                ["Bruto", batchResult.totais.totalBruto],
                ["Líquido", batchResult.totais.totalLiquido],
                ["INSS retido", batchResult.totais.totalINSS],
                ["IRRF", batchResult.totais.totalIRRF],
                ["FGTS", batchResult.totais.totalFGTS],
                ["Custo empresarial", batchResult.totais.custoEmpresarialTotal],
              ].map(([label, value]) => (
                <article key={String(label)}>
                  <span>{label}</span>
                  <strong>{currency.format(Number(value))}</strong>
                </article>
              ))}
            </div>
            <details>
              <summary>Ver memória resumida por colaborador</summary>
              <div className="batch-detail-table table-wrap">
                <table>
                  <thead>
                    <tr>
                      <th>Colaborador</th>
                      <th>Cargo / obra</th>
                      <th>Bruto</th>
                      <th>INSS</th>
                      <th>IRRF</th>
                      <th>Líquido</th>
                      <th>Custo empresa</th>
                    </tr>
                  </thead>
                  <tbody>
                    {batchResult.detalhes.map((detail) => (
                      <tr key={detail.colaboradorId}>
                        <td><strong>{detail.nome}</strong></td>
                        <td>
                          {detail.cargo || "—"}
                          <small>{batchWork || "Todas as obras"}</small>
                        </td>
                        <td>{currency.format(detail.resultado.gross)}</td>
                        <td>{currency.format(detail.resultado.inss)}</td>
                        <td>{currency.format(detail.resultado.irrf)}</td>
                        <td><strong>{currency.format(detail.resultado.net)}</strong></td>
                        <td>{currency.format(detail.resultado.totalEmployerCost)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </details>
          </div>
        ) : null}
        <footer className="batch-infrastructure-note">
          <Icon name="database" size={16} />
          <span>
            O deploy atual usa D1 e execução controlada. Para milhares de
            colaboradores simultâneos, a próxima camada será PostgreSQL com RLS,
            Redis/BullMQ e workers dedicados.
          </span>
        </footer>
      </section>

      <section className="company-tax-profile">
        <div className="tax-profile-main">
          <span className="eyebrow">ENQUADRAMENTO DA EMPRESA</span>
          <strong>{companyProfile.taxRegime}</strong>
          <small>
            {input.employerParameterSource === "COMPANY_PROFILE"
              ? "Parâmetros patronais carregados do cadastro da empresa"
              : "Parâmetros incompletos — cálculo em modo estimado"}
          </small>
        </div>
        {[
          ["CNAE preponderante", companyProfile.cnae],
          [
            "FPAS / outras entidades",
            companyProfile.fpas || companyProfile.thirdPartiesCode
              ? `${companyProfile.fpas || "—"} / ${companyProfile.thirdPartiesCode || "—"}`
              : "",
          ],
          [
            "Patronal / outras entidades",
            companyProfile.employerInssPercent &&
            companyProfile.thirdPartiesPercent
              ? `${companyProfile.employerInssPercent}% / ${companyProfile.thirdPartiesPercent}%`
              : "",
          ],
          [
            "RAT / FAP",
            companyProfile.rat && companyProfile.fap
              ? `${companyProfile.rat}% / ${companyProfile.fap}`
              : "",
          ],
        ].map(([label, value]) => (
          <div key={label}>
            <span>{label}</span>
            <strong>{value || "A parametrizar"}</strong>
          </div>
        ))}
      </section>

      <div className="payroll-workspace">
        <section className="content-card payroll-form-card">
          <div className="card-heading">
            <div>
              <span className="eyebrow">DADOS DA SIMULAÇÃO</span>
              <h2>Funcionário e competência</h2>
            </div>
          </div>
          <div className="payroll-form-grid">
            <label className="wide">
              <span>Selecionar funcionário cadastrado</span>
              <select onChange={(event) => chooseEmployee(event.target.value)}>
                <option value="">Selecione para preencher automaticamente</option>
                {people
                  .filter((person) => person.status !== "Desligado")
                  .map((person) => (
                    <option key={person.id} value={person.id}>
                      {String(person.payload.name || person.title)}
                      {showInternalCodes
                        ? ` • ${String(
                            person.payload.employeeCode || person.reference,
                          )}`
                        : ""}
                    </option>
                  ))}
              </select>
            </label>
            <label>
              <span>Nome do funcionário</span>
              <input
                value={input.employeeName}
                onChange={(event) =>
                  setInput((current) => ({
                    ...current,
                    employeeName: event.target.value,
                  }))
                }
                placeholder="Nome completo"
              />
            </label>
            <label>
              <span>Competência</span>
              <input
                type="month"
                value={input.competence.slice(0, 7)}
                onChange={(event) =>
                  setInput((current) => ({
                    ...current,
                    competence: `${event.target.value}-01`,
                  }))
                }
              />
            </label>
            <label>
              <span>Cargo / função</span>
              <input
                value={input.role}
                onChange={(event) =>
                  setInput((current) => ({
                    ...current,
                    role: event.target.value,
                  }))
                }
                placeholder="Preenchido pelo Cadastro de Funcionários"
              />
            </label>
            <label>
              <span>Obra / centro de custo</span>
              <input
                value={input.workName}
                onChange={(event) =>
                  setInput((current) => ({
                    ...current,
                    workName: event.target.value,
                  }))
                }
                placeholder="Obra de alocação"
              />
            </label>
          </div>

          <div className="payroll-section-title">
            <strong>Remuneração</strong>
            <small>Valores que formam o bruto estimado</small>
          </div>
          <div className="payroll-form-grid">
            {[
              ["baseSalary", "Salário-base (R$)", "0,00"],
              ["monthlyHours", "Horas mensais", "220"],
              ["overtimeHours", "Horas extras", "0"],
              ["overtimePercent", "Adicional de hora extra (%)", "50"],
              ["taxableAdditions", "Outros proventos tributáveis (R$)", "0,00"],
              ["nonTaxableEarnings", "Proventos não tributáveis (R$)", "0,00"],
            ].map(([key, label, placeholder]) => (
              <label key={key}>
                <span>{label}</span>
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  value={input[key as keyof PayrollInput] as number}
                  placeholder={placeholder}
                  onChange={(event) =>
                    setNumber(key as keyof PayrollInput, event.target.value)
                  }
                />
              </label>
            ))}
          </div>

          <div className="payroll-section-title">
            <strong>Adicionais e vínculo</strong>
            <small>Parâmetros específicos da construção civil</small>
          </div>
          <div className="payroll-form-grid payroll-additional-grid">
            <label>
              <span>Adicional ocupacional</span>
              <select
                value={input.additionalType}
                onChange={(event) =>
                  setInput((current) => ({
                    ...current,
                    additionalType: event.target
                      .value as PayrollInput["additionalType"],
                  }))
                }
              >
                <option value="NONE">Nenhum</option>
                <option value="INSALUBRITY">Insalubridade</option>
                <option value="HAZARD">Periculosidade</option>
              </select>
            </label>
            <label>
              <span>Categoria para FGTS</span>
              <select
                value={input.fgtsCategory}
                onChange={(event) =>
                  setInput((current) => ({
                    ...current,
                    fgtsCategory: event.target
                      .value as PayrollInput["fgtsCategory"],
                  }))
                }
              >
                <option value="STANDARD">Empregado CLT — 8%</option>
                <option value="APPRENTICE">Contrato de aprendizagem — 2%</option>
              </select>
            </label>
            {input.additionalType === "INSALUBRITY" ? (
              <>
                <label>
                  <span>Grau de insalubridade</span>
                  <select
                    value={input.insalubrityDegree}
                    onChange={(event) =>
                      setInput((current) => ({
                        ...current,
                        insalubrityDegree: Number(event.target.value) as
                          | 10
                          | 20
                          | 40,
                      }))
                    }
                  >
                    <option value={10}>Mínimo — 10%</option>
                    <option value={20}>Médio — 20%</option>
                    <option value={40}>Máximo — 40%</option>
                  </select>
                </label>
                <label>
                  <span>Base da insalubridade (R$)</span>
                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    value={input.insalubrityBase}
                    onChange={(event) =>
                      setNumber("insalubrityBase", event.target.value)
                    }
                  />
                  <small>
                    Referência inicial 2026:{" "}
                    {currency.format(payrollRules2026.minimumWage)}. Confirme a
                    convenção coletiva.
                  </small>
                </label>
              </>
            ) : null}
            <div className="payroll-calculation-preview">
              <span>Adicional calculado</span>
              <strong>{currency.format(result.additionalAmount)}</strong>
              <small>
                {input.additionalType === "NONE"
                  ? "Nenhum adicional selecionado"
                  : input.additionalType === "HAZARD"
                    ? "30% do salário-base"
                    : `${input.insalubrityDegree}% da base informada`}
              </small>
            </div>
          </div>

          <div className="payroll-section-title">
            <strong>Deduções e descontos</strong>
            <small>Informações para o líquido estimado</small>
          </div>
          <div className="payroll-form-grid">
            {[
              ["dependents", "Dependentes para IRRF"],
              ["pensionDeduction", "Pensão alimentícia dedutível (R$)"],
              ["salaryAdvance", "Adiantamento salarial (R$)"],
              ["consignments", "Consignados e convênios (R$)"],
              ["unionContribution", "Contribuição sindical autorizada (R$)"],
              ["otherDeductions", "Outros descontos (R$)"],
            ].map(([key, label]) => (
              <label key={key}>
                <span>{label}</span>
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  value={input[key as keyof PayrollInput] as number}
                  onChange={(event) =>
                    setNumber(key as keyof PayrollInput, event.target.value)
                  }
                />
              </label>
            ))}
          </div>

          <details className="advanced-payroll">
            <summary>
              Parâmetros patronais •{" "}
              {input.employerParameterSource === "COMPANY_PROFILE"
                ? "carregados do Regime Tributário"
                : "estimativa pendente de cadastro"}
            </summary>
            <div className="payroll-form-grid">
              {[
                ["employerInssPercent", "Contribuição patronal (%)"],
                ["ratPercent", "RAT básico (%)"],
                ["fapFactor", "FAP (fator)"],
                ["thirdPartiesPercent", "Outras entidades e fundos (%)"],
              ].map(([key, label]) => (
                <label key={key}>
                  <span>{label}</span>
                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    value={input[key as keyof PayrollInput] as number}
                    onChange={(event) =>
                      setNumber(key as keyof PayrollInput, event.target.value)
                    }
                  />
                </label>
              ))}
            </div>
            <p className="payroll-parameter-note">
              RAT ajustado calculado: <strong>{result.ratAdjustedPercent}%</strong>{" "}
              (RAT × FAP). Os parâmetros definitivos devem vir da lotação
              tributária e da contabilidade.
            </p>
          </details>
        </section>

        <section className="content-card payroll-result-card">
          <div className="card-heading">
            <div>
              <span className="eyebrow">RESULTADO EM TEMPO REAL</span>
              <h2>Resumo do cálculo</h2>
            </div>
          </div>
          <div className="payroll-summary-grid">
            <article>
              <span>Bruto estimado</span>
              <strong>{currency.format(result.gross)}</strong>
            </article>
            <article>
              <span>INSS</span>
              <strong>- {currency.format(result.inss)}</strong>
            </article>
            <article>
              <span>IRRF</span>
              <strong>- {currency.format(result.irrf)}</strong>
              <small>{result.irrfDeductionMethod}</small>
            </article>
            <article className="net-result">
              <span>Líquido estimado</span>
              <strong>{currency.format(result.net)}</strong>
            </article>
          </div>
          <div className="employer-cost">
            <div>
              <span>Adicional ocupacional</span>
              <strong>{currency.format(result.additionalAmount)}</strong>
            </div>
            <div>
              <span>Horas extras</span>
              <strong>{currency.format(result.overtimeAmount)}</strong>
            </div>
            <div>
              <span>FGTS estimado</span>
              <strong>{currency.format(result.fgts)}</strong>
            </div>
            <div>
              <span>Encargos patronais</span>
              <strong>{currency.format(result.employerCharges)}</strong>
            </div>
            <div>
              <span>Provisões mensais</span>
              <strong>{currency.format(result.provisions)}</strong>
            </div>
            <div className="total-cost">
              <span>Custo empresarial estimado</span>
              <strong>{currency.format(result.totalEmployerCost)}</strong>
            </div>
          </div>
          {canEdit ? (
            <button
              className="button primary payroll-save"
              disabled={saving || !input.employeeName || !input.baseSalary}
              onClick={() => onSave(input)}
            >
              <Icon name="check" size={18} />
              {saving ? "Salvando cálculo…" : "Salvar cálculo para conferência"}
            </button>
          ) : (
            <div className="read-only-inline">
              <Icon name="eye" size={17} />
              A simulação pode ser testada, mas somente o administrador pode salvá-la.
            </div>
          )}
        </section>
      </div>

      <section className="content-card payroll-memory payment-statement">
        <div className="card-heading">
          <div>
            <span className="eyebrow">DADOS DO PAGAMENTO</span>
            <h2>
              Salário • {input.competence.slice(5, 7)}/{input.competence.slice(0, 4)}
              {showInternalCodes && input.employeeCode
                ? ` • ${input.employeeCode}`
                : ""}
            </h2>
          </div>
          <div className="statement-legend">
            <span className="earning">Proventos</span>
            <span className="deduction">Descontos</span>
            <span className="employer">Outros / empresa</span>
          </div>
        </div>
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                {/*
                  * O código da rubrica é coluna fixa do contracheque, e não
                  * um "código interno" do sistema: é por ele que a folha é
                  * conferida contra a contabilidade, e quem recebe o
                  * demonstrativo espera encontrá-lo. A regra de ocultar
                  * códigos internos continua valendo para os identificadores
                  * de registro dos outros módulos.
                  */}
                <th>Verba</th>
                <th>Nome da verba</th>
                <th>Tipo de verba</th>
                <th>Referência</th>
                <th>Base de cálculo</th>
                <th>Valor</th>
              </tr>
            </thead>
            <tbody>
              {result.lines.map((line) => (
                <tr key={line.code} className={`statement-row ${line.kind}`}>
                  <td className="statement-code">{line.code}</td>
                  <td><strong>{line.label}</strong></td>
                  <td>{line.kind === "earning" ? "Proventos" : line.kind === "deduction" ? "Descontos" : line.kind === "employer" ? "Outros / empresa" : "Provisões"}</td>
                  {/*
                    * Quantidade quando a verba é medida em horas, alíquota
                    * quando é percentual, e 1,00 quando é valor fixo
                    * informado — como no contracheque de referência. Ver a
                    * base repetida em toda linha não permitia conferir nada.
                    */}
                  <td className="statement-reference">
                    {formatReference(line)}
                  </td>
                  <td>{line.base ? currency.format(line.base) : "—"}</td>
                  <td>{currency.format(line.amount)}</td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr>
                <td colSpan={3}>
                  <strong>Totais do cálculo</strong>
                </td>
                <td className="statement-total">
                  <span>Bruto</span>
                  <strong>{currency.format(result.gross)}</strong>
                </td>
                <td className="statement-total">
                  <span>Descontos</span>
                  <strong>{currency.format(result.totalDeductions)}</strong>
                </td>
                <td>
                  <span>Líquido estimado</span>
                  <strong>{currency.format(result.net)}</strong>
                </td>
              </tr>
            </tfoot>
          </table>
        </div>
        <p className="statement-hint">
          <strong>Como ler a referência:</strong> <em>h</em> são horas do mês
          ou horas extras lançadas; <em>%</em> é a alíquota efetivamente
          aplicada sobre a base ao lado — no INSS e no IRRF ela sai do
          cálculo por faixas, então costuma diferir da alíquota de tabela;
          <em>un.</em> é uma ocorrência, usada em verba de valor fixo.
        </p>
        <details className="statement-rules">
          <summary>Ver regras aplicadas em cada verba</summary>
          <div>
            {result.lines.map((line) => (
              <p key={line.code}>
                <strong>
                  {line.code} • {line.label}:
                </strong>{" "}
                {line.note}
              </p>
            ))}
          </div>
        </details>
        <div className="payroll-warnings">
          {result.warnings.map((warning) => (
            <p key={warning}><Icon name="alert" size={16} /> {warning}</p>
          ))}
        </div>
      </section>

      <section className="content-card saved-previews">
        <div className="card-heading">
          <div>
            <span className="eyebrow">HISTÓRICO</span>
            <h2>Cálculos salvos</h2>
          </div>
          <span className="soft-badge">{previews.length} registros</span>
        </div>
        {previews.length ? (
          <div className="preview-list">
            {previews.slice(0, 8).map((preview) => (
              <article key={preview.id}>
                <span>
                  <strong>{preview.title}</strong>
                  <small>
                    {String(preview.payload.competence || preview.recordDate).slice(0, 7)}
                    {" • "}{String(preview.payload.rulesVersion || "")}
                  </small>
                </span>
                <span>
                  <small>Líquido estimado</small>
                  <strong>{currency.format(Number(preview.payload.netAmount || preview.amount))}</strong>
                </span>
                <span className={`status-pill ${statusTone(preview.status)}`}>
                  {preview.status}
                </span>
              </article>
            ))}
          </div>
        ) : (
          <div className="card-empty compact">
            <strong>Nenhum cálculo salvo</strong>
            <p>Preencha a simulação acima e salve para iniciar o histórico.</p>
          </div>
        )}
      </section>
    </div>
  );
}

type ManualEntry = {
  title: string;
  summary: string;
  paragraphs: string[];
};

const manualEntries: ManualEntry[] = [
  {
    title: "Compras e Contas a pagar: duas aprovações separadas",
    summary:
      "Como funciona a aprovação de uma compra de material, do pedido até o pagamento.",
    paragraphs: [
      "Com a separação que fizemos, uma compra de material agora passa por duas aprovações na mesma Central de Decisões: primeiro aprova-se a necessidade de comprar (em Compras), depois — já como um lançamento separado em Contas a pagar, referenciando o código da compra — aprova-se o pagamento em si.",
      "Isso é mais correto ainda do ponto de vista de controle, porque as duas aprovações passam pelo mesmo lugar, mas em momentos diferentes (uma pra liberar a compra, outra pra liberar o dinheiro).",
    ],
  },
];

function SystemManualPage() {
  return (
    <div className="page-stack">
      <ModuleHeader
        variant="standard"
        variantClass="manual-heading"
        iconClass="manual-icon"
        icon={<Icon name="manual" size={26} />}
        eyebrow="COMO O SISTEMA FUNCIONA"
        title="Manual do sistema"
        description={
          <>
            Explicações das regras de negócio que orientam o uso do sistema
            no dia a dia, reunidas aqui para consulta sempre que precisar.
          </>
        }
      />

      {manualEntries.map((entry, index) => (
        <section className="settings-card manual-entry-card" key={entry.title}>
          <header>
            <span>{index + 1}</span>
            <div>
              <h2>{entry.title}</h2>
              <p>{entry.summary}</p>
            </div>
          </header>
          <div className="manual-entry-body">
            {entry.paragraphs.map((paragraph) => (
              <p key={paragraph}>{paragraph}</p>
            ))}
          </div>
        </section>
      ))}
    </div>
  );
}

function AdminPanel({
  settings,
  onSave,
  saving,
  adminEmail,
}: {
  settings: SystemSettings;
  onSave: (settings: SystemSettings) => Promise<void>;
  saving: boolean;
  adminEmail?: string | null;
}) {
  const [draft, setDraft] = useState<SystemSettings>({ ...settings });

  function update(key: keyof SystemSettings, value: string) {
    setDraft((current) => ({ ...current, [key]: value }));
  }

  async function submit(event: FormEvent) {
    event.preventDefault();
    await onSave(draft);
  }

  return (
    <div className="page-stack">
      <ModuleHeader
        variant="standard"
        accent="admin"
        variantClass="admin-heading"
        iconClass="admin-icon"
        icon={<Icon name="admin" size={26} />}
        eyebrow="ACESSO EXCLUSIVO"
        title="Administração do sistema"
        description={
          <>
            Personalize a apresentação do sistema sem alterar os cadastros da
            empresa.
          </>
        }
        actions={
          <span className="admin-lock">
            <Icon name="check" size={16} /> Somente administrador
          </span>
        }
      />

      <aside className="admin-security-note">
        <span>
          <Icon name="admin" size={19} />
        </span>
        <div>
          <strong>Área protegida</strong>
          <p>
            Colaboradores comuns não visualizam esta tela. Alterações feitas
            aqui afetam a identidade e as informações gerais do sistema.
          </p>
        </div>
      </aside>

      <form className="admin-form" onSubmit={submit}>
        <section className="settings-card">
          <header>
            <span>1</span>
            <div>
              <h2>Identidade da empresa</h2>
              <p>Nome, marca e cor exibidos para os usuários.</p>
            </div>
          </header>
          <div className="settings-grid">
            <label>
              <span>Nome da empresa</span>
              <input
                required
                value={draft.companyName}
                onChange={(event) => update("companyName", event.target.value)}
                placeholder="Ex.: Beta Construtora"
              />
            </label>
            <label>
              <span>Nome do sistema</span>
              <input
                required
                value={draft.systemName}
                onChange={(event) => update("systemName", event.target.value)}
                placeholder="Ex.: Beta Gestão 365"
              />
            </label>
            <label className="wide">
              <span>Link do logotipo</span>
              <input
                type="url"
                value={draft.logoUrl}
                onChange={(event) => update("logoUrl", event.target.value)}
                placeholder="Cole o link público do logotipo"
              />
              <small>
                Se ficar vazio, o símbolo padrão do sistema será utilizado.
              </small>
            </label>
            <label>
              <span>Cor principal</span>
              <div className="color-control">
                <input
                  type="color"
                  value={draft.primaryColor}
                  onChange={(event) =>
                    update("primaryColor", event.target.value)
                  }
                  aria-label="Selecionar cor principal"
                />
                <input
                  value={draft.primaryColor}
                  onChange={(event) =>
                    update("primaryColor", event.target.value)
                  }
                  placeholder="#173f58"
                />
              </div>
            </label>
            <label>
              <span>Mensagem inicial</span>
              <input
                value={draft.welcomeMessage}
                onChange={(event) =>
                  update("welcomeMessage", event.target.value)
                }
                placeholder="Mensagem exibida no painel"
              />
            </label>
          </div>
        </section>

        <section className="settings-card">
          <header>
            <span>2</span>
            <div>
              <h2>Perfil tributário e previdenciário</h2>
              <p>Parâmetros usados para estimar os encargos da folha.</p>
            </div>
          </header>
          <div className="settings-grid">
            <label>
              <span>Regime tributário</span>
              <select
                value={draft.taxRegime}
                onChange={(event) => update("taxRegime", event.target.value)}
              >
                <option>Não informado</option>
                <option>Lucro Real</option>
                <option>Lucro Presumido</option>
                <option>Simples Nacional</option>
                <option>Simples Nacional — MEI</option>
                <option>Lucro Arbitrado</option>
              </select>
              <small>Selecione somente após confirmação com a contabilidade.</small>
            </label>
            <label>
              <span>CNPJ</span>
              <input value={draft.cnpj} onChange={(event) => update("cnpj", event.target.value)} placeholder="00.000.000/0000-00" />
            </label>
            <label>
              <span>Natureza jurídica</span>
              <input value={draft.legalNature} onChange={(event) => update("legalNature", event.target.value)} placeholder="Ex.: Sociedade Empresária Limitada" />
            </label>
            <label>
              <span>Porte da empresa</span>
              <select value={draft.companySize} onChange={(event) => update("companySize", event.target.value)}>
                <option value="">Não informado</option>
                <option>MEI</option>
                <option>Microempresa (ME)</option>
                <option>Empresa de Pequeno Porte (EPP)</option>
                <option>Demais portes</option>
              </select>
            </label>
            <label>
              <span>CNAE preponderante</span>
              <input value={draft.cnae} onChange={(event) => update("cnae", event.target.value)} placeholder="Ex.: 4120-4/00" />
            </label>
            <label>
              <span>FPAS</span>
              <input value={draft.fpas} onChange={(event) => update("fpas", event.target.value)} placeholder="Código FPAS" />
            </label>
            <label>
              <span>Código de outras entidades e fundos</span>
              <input value={draft.thirdPartiesCode} onChange={(event) => update("thirdPartiesCode", event.target.value)} placeholder="Código informado no eSocial" />
            </label>
            <label>
              <span>RAT (%)</span>
              <input value={draft.rat} onChange={(event) => update("rat", event.target.value)} placeholder="Ex.: 2,00" />
            </label>
            <label>
              <span>FAP</span>
              <input value={draft.fap} onChange={(event) => update("fap", event.target.value)} placeholder="Ex.: 1,0000" />
            </label>
          </div>
        </section>

        <section className="settings-card">
          <header>
            <span>3</span>
            <div>
              <h2>Suporte e responsável</h2>
              <p>Contato apresentado quando um usuário precisar de ajuda.</p>
            </div>
          </header>
          <div className="settings-grid">
            <label>
              <span>Responsável pelo suporte</span>
              <input
                value={draft.supportName}
                onChange={(event) => update("supportName", event.target.value)}
              />
            </label>
            <label>
              <span>E-mail de suporte</span>
              <input
                type="email"
                value={draft.supportEmail}
                onChange={(event) => update("supportEmail", event.target.value)}
              />
            </label>
            <label>
              <span>Telefone ou WhatsApp</span>
              <input
                value={draft.supportPhone}
                onChange={(event) => update("supportPhone", event.target.value)}
                placeholder="Ex.: (19) 99999-9999"
              />
            </label>
            <label>
              <span>Administrador Geral</span>
              <input
                type="text"
                value={adminEmail || "Administrador autenticado"}
                readOnly
              />
              <small>
                Acesso exclusivo e protegido. Outros usuários não visualizam
                esta área.
              </small>
            </label>
          </div>
        </section>

        <section className="settings-card">
          <header>
            <span>4</span>
            <div>
              <h2>Situação da base de dados</h2>
              <p>
                Separa o sistema em demonstração do sistema em operação. É a
                única decisão desta tela que muda o que os outros enxergam.
              </p>
            </div>
          </header>
          <div className="settings-grid">
            <label className="wide">
              <span>Esta base já é real?</span>
              <select
                value={draft.officialBase || "Não"}
                onChange={(event) => update("officialBase", event.target.value)}
              >
                <option value="Não">
                  Não — demonstração, com dados fictícios
                </option>
                <option value="Sim">
                  Sim — base real, em operação
                </option>
              </select>
              <small>
                Marcando <strong>Sim</strong>, três coisas mudam de uma vez: os
                colaboradores fictícios somem das listas e dos totais e param
                de voltar sozinhos quando apagados; e nome e salário deixam de
                aparecer para quem abre o sistema sem entrar com conta
                autorizada. Nada é apagado do banco — voltando para{" "}
                <strong>Não</strong>, a demonstração retorna inteira, útil no
                dia em que precisar apresentar o sistema sem expor a operação.
              </small>
            </label>
          </div>
        </section>

        <section className="settings-card">
          <header>
            <span>5</span>
            <div>
              <h2>Domínio e entrega comercial</h2>
              <p>Informações para administrar ou vender a solução.</p>
            </div>
          </header>
          <div className="settings-grid">
            <label className="wide">
              <span>Domínio próprio desejado</span>
              <input
                value={draft.corporateDomain}
                onChange={(event) =>
                  update("corporateDomain", event.target.value)
                }
                placeholder="Ex.: betaconstrutora365.com.br"
              />
              <small>
                O registro, renovação e DNS continuam sendo administrados no
                Registro.br.
              </small>
            </label>
            <label className="wide">
              <span>Anotações comerciais</span>
              <textarea
                rows={4}
                value={draft.commercialNotes}
                onChange={(event) =>
                  update("commercialNotes", event.target.value)
                }
                placeholder="Ex.: cliente, valor contratado, data de renovação ou observações da entrega"
              />
            </label>
          </div>
          <a
            className="domain-admin-link"
            href="https://registro.br/"
            target="_blank"
            rel="noreferrer"
          >
            Abrir administração de domínios no Registro.br
            <Icon name="arrow" size={16} />
          </a>
        </section>

        <footer className="admin-save-bar">
          <div>
            <strong>As configurações ficam salvas no sistema.</strong>
            <span>Os registros operacionais não serão alterados.</span>
          </div>
          <button className="button primary" type="submit" disabled={saving}>
            <Icon name="check" size={17} />
            {saving ? "Salvando…" : "Salvar configurações"}
          </button>
        </footer>
      </form>
    </div>
  );
}

function TaxProfilePanel({
  settings,
  onSave,
  saving,
  canEdit,
}: {
  settings: SystemSettings;
  onSave: (settings: SystemSettings) => Promise<void>;
  saving: boolean;
  canEdit: boolean;
}) {
  const [draft, setDraft] = useState<SystemSettings>({ ...settings });
  const [autoLookup, setAutoLookup] = useState(true);
  const [searchingCnpj, setSearchingCnpj] = useState(false);
  const [lookupMessage, setLookupMessage] = useState("");
  const update = (key: keyof SystemSettings, value: string) =>
    setDraft((current) => ({ ...current, [key]: value }));

  async function lookupCnpj() {
    setLookupMessage("");
    setSearchingCnpj(true);
    try {
      const response = await fetch(
        `/api/cnpj?cnpj=${encodeURIComponent(draft.cnpj)}`,
        { cache: "no-store" },
      );
      const body = (await response.json()) as {
        company?: Partial<SystemSettings>;
        error?: string;
      };
      if (!response.ok || !body.company) {
        throw new Error(body.error || "Não foi possível consultar o CNPJ.");
      }
      setDraft((current) => ({ ...current, ...body.company }));
      setLookupMessage(
        body.company.taxRegime === "Não informado"
          ? "Dados cadastrais encontrados. Confirme o regime tributário com a contabilidade."
          : "Dados cadastrais e opção pelo Simples/MEI identificados.",
      );
    } catch (error) {
      setLookupMessage(
        error instanceof Error
          ? error.message
          : "A consulta não pôde ser realizada.",
      );
    } finally {
      setSearchingCnpj(false);
    }
  }

  return (
    <div className="page-stack tax-profile-page">
      <ModuleHeader
        variant="standard"
        accent="tax"
        variantClass="tax-heading"
        iconClass="tax-icon"
        icon={<Icon name="taxes" size={26} />}
        eyebrow="EMPRESA • ENQUADRAMENTO"
        title="Regime Tributário"
        description="Dados fiscais e previdenciários utilizados nas estimativas da folha."
        actions={
          <span className="tax-regime-badge">
            <Icon name={draft.taxRegime === "Não informado" ? "alert" : "check"} size={16} />
            {draft.taxRegime === "Não informado"
              ? "Enquadramento pendente"
              : `Enquadrado: ${draft.taxRegime}`}
          </span>
        }
      />

      <aside className="module-guide">
        <span className="guide-icon"><Icon name="check" size={18} /></span>
        <div>
          <strong>Preenchimento pela empresa</strong>
          <p>
            O responsável contábil ou de RH deve copiar estes dados do cadastro
            vigente no eSocial ou das informações fornecidas pela contabilidade.
          </p>
        </div>
      </aside>

      <form
        className="content-card tax-profile-form"
        onSubmit={async (event) => {
          event.preventDefault();
          if (!canEdit) return;
          await onSave(draft);
        }}
      >
        <fieldset className="read-only-fieldset" disabled={!canEdit}>
        <div className="tax-regime-hero">
          <span>REGIME TRIBUTÁRIO ATUAL</span>
          <strong>{draft.taxRegime}</strong>
          <p>Preencha conforme a orientação da contabilidade responsável.</p>
        </div>
        <div className="cnpj-lookup-control">
          <label>
            <input
              type="checkbox"
              checked={autoLookup}
              onChange={(event) => setAutoLookup(event.target.checked)}
            />
            <span>
              <strong>Consultar dados automaticamente pelo CNPJ</strong>
              <small>Preenche os dados públicos disponíveis; você poderá revisar tudo antes de salvar.</small>
            </span>
          </label>
          {autoLookup ? (
            <button
              className="button secondary"
              type="button"
              disabled={searchingCnpj || draft.cnpj.replace(/\D/g, "").length !== 14}
              onClick={lookupCnpj}
            >
              <Icon name="search" size={17} />
              {searchingCnpj ? "Consultando…" : "Buscar dados do CNPJ"}
            </button>
          ) : null}
        </div>
        {lookupMessage ? (
          <p className="cnpj-lookup-message">
            <Icon name="check" size={16} /> {lookupMessage}
          </p>
        ) : null}
        <div className="tax-fields">
          <label>
            <span>Regime tributário</span>
            <select value={draft.taxRegime} onChange={(event) => update("taxRegime", event.target.value)}>
              <option>Não informado</option>
              <option>Lucro Real</option>
              <option>Lucro Presumido</option>
              <option>Simples Nacional</option>
              <option>Simples Nacional — MEI</option>
              <option>Lucro Arbitrado</option>
            </select>
            <small>O cartão do CNPJ não substitui a confirmação do regime pela contabilidade.</small>
          </label>
          <label>
            <span>CNPJ</span>
            <input value={draft.cnpj} onChange={(event) => update("cnpj", event.target.value)} placeholder="00.000.000/0000-00" />
          </label>
          <label>
            <span>Razão social</span>
            <input value={draft.legalName} onChange={(event) => update("legalName", event.target.value)} placeholder="Nome empresarial no CNPJ" />
          </label>
          <label>
            <span>Nome fantasia</span>
            <input value={draft.tradeName} onChange={(event) => update("tradeName", event.target.value)} placeholder="Se houver" />
          </label>
          <label>
            <span>Natureza jurídica</span>
            <input value={draft.legalNature} onChange={(event) => update("legalNature", event.target.value)} placeholder="Preenchida pela consulta ou manualmente" />
          </label>
          <label>
            <span>Porte da empresa</span>
            <select value={draft.companySize} onChange={(event) => update("companySize", event.target.value)}>
              <option value="">Não informado</option>
              <option>MEI</option>
              <option>Microempresa (ME)</option>
              <option>Empresa de Pequeno Porte (EPP)</option>
              <option>Demais portes</option>
            </select>
          </label>
          <label>
            <span>Situação cadastral</span>
            <input value={draft.registrationStatus} onChange={(event) => update("registrationStatus", event.target.value)} placeholder="Ex.: ATIVA" />
          </label>
          <label>
            <span>Atividade econômica principal</span>
            <input value={draft.primaryActivity} onChange={(event) => update("primaryActivity", event.target.value)} placeholder="Descrição do CNAE principal" />
          </label>
          <label>
            <span>CNAE preponderante</span>
            <input value={draft.cnae} onChange={(event) => update("cnae", event.target.value)} placeholder="Ex.: 4120-4/00" />
          </label>
          <label>
            <span>FPAS</span>
            <input value={draft.fpas} onChange={(event) => update("fpas", event.target.value)} placeholder="Informe o código FPAS" />
          </label>
          <label>
            <span>Código de outras entidades e fundos</span>
            <input value={draft.thirdPartiesCode} onChange={(event) => update("thirdPartiesCode", event.target.value)} placeholder="Conforme lotação tributária" />
          </label>
          <label>
            <span>Contribuição patronal (%)</span>
            <input value={draft.employerInssPercent} onChange={(event) => update("employerInssPercent", event.target.value)} placeholder="Ex.: 20,00" />
            <small>Informe a alíquota efetiva aplicável à folha.</small>
          </label>
          <label>
            <span>Outras entidades e fundos (%)</span>
            <input value={draft.thirdPartiesPercent} onChange={(event) => update("thirdPartiesPercent", event.target.value)} placeholder="Ex.: 5,80" />
            <small>Percentual vinculado ao FPAS e ao código de outras entidades e fundos.</small>
          </label>
          <label>
            <span>RAT básico (%)</span>
            <input value={draft.rat} onChange={(event) => update("rat", event.target.value)} placeholder="Ex.: 2,00" />
          </label>
          <label>
            <span>FAP (fator)</span>
            <input value={draft.fap} onChange={(event) => update("fap", event.target.value)} placeholder="Ex.: 1,0000" />
            <small>O motor aplica RAT × FAP para obter o RAT ajustado.</small>
          </label>
        </div>
        <footer className="tax-save-bar">
          <div>
            <strong>Esses dados alimentam o Cálculo de Folha.</strong>
            <span>
              {canEdit
                ? "Revise as informações antes de salvar."
                : "A edição é liberada somente após entrar como administrador."}
            </span>
          </div>
          {canEdit ? (
            <button className="button primary" type="submit" disabled={saving}>
              <Icon name="check" size={17} />
              {saving ? "Salvando…" : "Salvar enquadramento"}
            </button>
          ) : (
            <span className="read-only-chip">
              <Icon name="eye" size={16} /> Somente consulta
            </span>
          )}
        </footer>
        </fieldset>
      </form>
    </div>
  );
}

export default function BetaApp({
  userName,
  userEmail,
  isAdmin,
  onActiveViewChange,
}: {
  userName?: string | null;
  userEmail?: string | null;
  isAdmin: boolean;
  onActiveViewChange?: (view: string) => void;
}) {
  const [activeView, setActiveView] = useState("dashboard");
  const [records, setRecords] = useState<StoredRecord[]>([]);
  const [importRuns, setImportRuns] = useState<ImportRunView[]>([]);
  const [taxProfile, setTaxProfile] = useState<Partial<SystemSettings>>({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [modalModule, setModalModule] = useState<ModuleDefinition | null>(null);
  const [editing, setEditing] = useState<StoredRecord | null>(null);
  const [selectedRecord, setSelectedRecord] = useState<StoredRecord | null>(null);
  const [decisionRecordId, setDecisionRecordId] = useState<number | null>(null);
  const [decisionSaving, setDecisionSaving] = useState(false);
  const [pendingDelete, setPendingDelete] = useState<StoredRecord | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [toast, setToast] = useState<Toast>(null);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [importTarget, setImportTarget] = useState<string | undefined>(undefined);
  const [showInternalCodes, setShowInternalCodes] = useState(false);
  const fileInput = useRef<HTMLInputElement>(null);

  useEffect(() => {
    onActiveViewChange?.(activeView);
  }, [activeView, onActiveViewChange]);

  async function loadRecords(showLoading = false) {
    if (showLoading) setLoading(true);
    try {
      const response = await fetch("/api/records", { cache: "no-store" });
      const result = (await response.json()) as {
        records?: StoredRecord[];
        error?: string;
      };
      if (!response.ok) throw new Error(result.error);
      setRecords(result.records || []);
    } catch (error) {
      setToast({
        kind: "error",
        text:
          error instanceof Error
            ? error.message
            : "Não foi possível carregar os dados.",
      });
    } finally {
      setLoading(false);
    }
  }

  const loadImportRuns = useCallback(async () => {
    if (!isAdmin) return;
    try {
      const response = await fetch("/api/records?view=imports", {
        cache: "no-store",
      });
      const result = (await response.json()) as {
        imports?: ImportRunView[];
        error?: string;
      };
      if (!response.ok) throw new Error(result.error);
      setImportRuns(result.imports || []);
    } catch (error) {
      setToast({
        kind: "error",
        text:
          error instanceof Error
            ? error.message
            : "Não foi possível carregar o histórico de importações.",
      });
    }
  }, [isAdmin]);

  useEffect(() => {
    let cancelled = false;
    fetch("/api/records", { cache: "no-store" })
      .then(async (response) => {
        const result = (await response.json()) as {
          records?: StoredRecord[];
          error?: string;
        };
        if (!response.ok) throw new Error(result.error);
        if (!cancelled) setRecords(result.records || []);
      })
      .catch((error: unknown) => {
        if (cancelled) return;
        setToast({
          kind: "error",
          text:
            error instanceof Error
              ? error.message
              : "Não foi possível carregar os dados.",
        });
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    fetch("/api/tax-profile", { cache: "no-store" })
      .then((response) => response.json())
      .then((body: { profile?: Partial<SystemSettings> }) =>
        setTaxProfile(body.profile || {}),
      )
      .catch(() => setTaxProfile({}));
  }, []);

  useEffect(() => {
    if (!toast) return;
    const timer = window.setTimeout(() => setToast(null), 4200);
    return () => window.clearTimeout(timer);
  }, [toast]);

  /*
   * Ponte para as "Ações rápidas" da tela Administrativo.
   *
   * Aquele painel vive em `BetaAppV52`, que é IRMÃO deste componente na
   * árvore — não há contexto compartilhado entre os dois, e por isso o
   * atalho sempre precisou falar com esta tela por fora do React.
   *
   * O jeito antigo era procurar no DOM o botão "Novo registro" do cabeçalho
   * e clicar nele. Isso amarrava uma função a um detalhe visual: quando o
   * cabeçalho de Administrativo deixou de exibir o botão (e o de Máquinas
   * deixou de existir), "Cadastrar funcionário" e "Abrir máquinas" pararam
   * de abrir a ficha — em silêncio, sem erro no console.
   *
   * Um evento nomeado não tem esse problema: quem pede o cadastro diz qual
   * módulo quer, e a tela abre o formulário exista ou não botão na página.
   */
  useEffect(() => {
    function abrirCadastro(event: Event) {
      const moduleId = (event as CustomEvent<{ moduleId?: string }>).detail
        ?.moduleId;
      if (!moduleId || !moduleMap[moduleId]) return;
      if (!isAdmin) {
        setToast({
          kind: "error",
          text: "Este acesso é somente para consulta. Entre como administrador para alterar dados.",
        });
        return;
      }
      setEditing(null);
      setModalModule(moduleMap[moduleId]);
    }

    window.addEventListener(NOVO_REGISTRO_EVENTO, abrirCadastro);
    return () => window.removeEventListener(NOVO_REGISTRO_EVENTO, abrirCadastro);
  }, [isAdmin]);

  const operationalRecords = useMemo(
    () =>
      records.filter((record) => Boolean(moduleMap[record.module])),
    [records],
  );
  const activeModule = moduleMap[activeView] || null;
  const moduleRecords = useMemo(
    () =>
      operationalRecords.filter((record) => record.module === activeView),
    [operationalRecords, activeView],
  );
  const settingsRecord =
    records.find((record) => record.module === "settings") || null;
  const settings = useMemo(
    () => ({
      ...defaultSettings,
      ...(settingsRecord?.payload || {}),
      ...taxProfile,
    }) as SystemSettings,
    [settingsRecord, taxProfile],
  );
  const companyNavigationGroups = [
    ...navigationGroups,
    { label: "EMPRESA", items: ["tax-profile"] },
    { label: "SISTEMA", items: ["infrastructure"] },
  ];
  const visibleNavigationGroups = isAdmin
    ? [
        ...companyNavigationGroups,
        { label: "ADMINISTRAÇÃO", items: ["admin"] },
      ]
    : companyNavigationGroups;

  function navigate(view: string) {
    setActiveView(view);
    setSearch("");
    setStatusFilter("");
    setSidebarOpen(false);
    if (view === "m365" && isAdmin) void loadImportRuns();
  }

  function openRecord(record: StoredRecord) {
    setDecisionRecordId(null);
    setSelectedRecord(record);
  }

  function openApprovalRecord(record: StoredRecord) {
    setDecisionRecordId(record.id);
    setSelectedRecord(record);
  }

  function closeRecord() {
    setSelectedRecord(null);
    setDecisionRecordId(null);
  }

  function hasEditingAccess() {
    if (isAdmin) return true;
    setToast({
      kind: "error",
      text: "Este acesso é somente para consulta. Entre como administrador para alterar dados.",
    });
    return false;
  }

  function openNew(moduleId: string) {
    if (!hasEditingAccess()) return;
    setEditing(null);
    setModalModule(moduleMap[moduleId]);
  }

  function openEdit(record: StoredRecord) {
    if (!hasEditingAccess()) return;
    closeRecord();
    setEditing(record);
    setModalModule(moduleMap[record.module]);
  }

  async function save(payload: Record<string, unknown>) {
    if (!modalModule || !hasEditingAccess()) return;
    setSaving(true);
    try {
      const finalPayload =
        modalModule.id === "worklogs"
          ? {
              ...payload,
              ...worklogAutoFields(payload, records, editing?.id ?? null),
            }
          : payload;
      const recordPayload = {
        module: modalModule.id,
        title: String(finalPayload[modalModule.titleField] || "").trim(),
        reference: String(finalPayload[modalModule.referenceField] || "").trim(),
        status: String(finalPayload[modalModule.statusField] || "").trim(),
        recordDate: String(finalPayload[modalModule.dateField] || "").trim(),
        amount: amountForPayload(modalModule, finalPayload),
        payload: finalPayload,
        source: editing?.source || "Sistema web",
      };
      const response = await fetch("/api/records", {
        method: editing ? "PUT" : "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(
          editing
            ? {
                id: editing.id,
                record: recordPayload,
                expectedUpdatedAt: editing.updatedAt,
              }
            : { record: recordPayload },
        ),
      });
      const result = (await response.json()) as {
        record?: StoredRecord;
        error?: string;
      };
      if (!response.ok || !result.record) {
        throw new Error(result.error || "Não foi possível salvar.");
      }
      setRecords((current) =>
        editing
          ? current.map((item) =>
              item.id === result.record!.id ? result.record! : item,
            )
          : [result.record!, ...current],
      );
      setModalModule(null);
      setEditing(null);
      setToast({
        kind: "success",
        text: editing
          ? "Tudo certo! As alterações foram salvas."
          : "Pronto! O registro foi cadastrado com sucesso.",
      });
    } catch (error) {
      setToast({
        kind: "error",
        text: error instanceof Error ? error.message : "Erro ao salvar.",
      });
    } finally {
      setSaving(false);
    }
  }

  async function decideManagementRequest(
    record: StoredRecord,
    decision: ManagementDecision,
    reason: string,
  ) {
    if (!hasEditingAccess()) return;
    if (decision === "approve" && !requestHasRequiredDocument(record)) {
      setToast({
        kind: "error",
        text: `A aprovação está bloqueada. Vincule ${requiredRequestDocument(
          record,
        ).label.toLowerCase()} antes de decidir.`,
      });
      return;
    }
    if (decision === "reject" && !reason.trim()) {
      setToast({
        kind: "error",
        text: "Informe o motivo da reprovação para registrar a decisão.",
      });
      return;
    }

    setDecisionSaving(true);
    try {
      const approved = decision === "approve";
      const decisionAt = new Date().toISOString();
      const nextPayload = {
        ...record.payload,
        approval: approved ? "Aprovada" : "Rejeitada",
        managementDecision: approved ? "APPROVED" : "REJECTED",
        managementDecisionLabel: approved ? "Aprovado" : "Reprovado",
        managementDecisionReason: approved ? "" : reason.trim(),
        managementDecisionAt: decisionAt,
        managementDecisionBy: userName || "Administrador do sistema",
      };
      const recordPayload = {
        module: record.module,
        title: record.title,
        reference: record.reference,
        status: approved
          ? requestApprovedStatus(record)
          : requestRejectedStatus(record),
        recordDate: record.recordDate,
        amount: record.amount,
        payload: nextPayload,
        source: record.source || "Sistema web",
      };
      const response = await fetch("/api/records", {
        method: "PUT",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          id: record.id,
          record: recordPayload,
          expectedUpdatedAt: record.updatedAt,
        }),
      });
      const result = (await response.json()) as {
        record?: StoredRecord;
        error?: string;
      };
      if (!response.ok || !result.record) {
        throw new Error(result.error || "Não foi possível registrar a decisão.");
      }
      setRecords((current) =>
        current.map((item) =>
          item.id === result.record!.id ? result.record! : item,
        ),
      );
      closeRecord();
      setToast({
        kind: "success",
        text: approved
          ? "Pedido aprovado. A decisão foi registrada na auditoria."
          : "Pedido reprovado com o motivo informado e movido para Reprovados.",
      });
    } catch (error) {
      setToast({
        kind: "error",
        text:
          error instanceof Error
            ? error.message
            : "Não foi possível registrar a decisão.",
      });
    } finally {
      setDecisionSaving(false);
    }
  }

  async function saveSystemSettings(nextSettings: SystemSettings) {
    if (!hasEditingAccess()) return;
    setSaving(true);
    try {
      const recordPayload = {
        module: "settings",
        title: nextSettings.systemName.trim() || "Configurações do sistema",
        reference: "system-config",
        status: "Ativa",
        recordDate: new Date().toISOString().slice(0, 10),
        amount: 0,
        payload: nextSettings,
        source: "Administração do sistema",
      };
      const response = await fetch("/api/records", {
        method: settingsRecord ? "PUT" : "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(
          settingsRecord
            ? {
                id: settingsRecord.id,
                record: recordPayload,
                expectedUpdatedAt: settingsRecord.updatedAt,
              }
            : { record: recordPayload },
        ),
      });
      const result = (await response.json()) as {
        record?: StoredRecord;
        error?: string;
      };
      if (!response.ok || !result.record) {
        throw new Error(result.error || "Não foi possível salvar.");
      }
      setRecords((current) =>
        settingsRecord
          ? current.map((item) =>
              item.id === result.record!.id ? result.record! : item,
            )
          : [result.record!, ...current],
      );
      setToast({
        kind: "success",
        text: "Configurações atualizadas! A nova identidade já está aplicada.",
      });
    } catch (error) {
      setToast({
        kind: "error",
        text:
          error instanceof Error
            ? error.message
            : "Não foi possível salvar as configurações.",
      });
    } finally {
      setSaving(false);
    }
  }

  async function saveTaxProfile(nextSettings: SystemSettings) {
    if (!hasEditingAccess()) return;
    setSaving(true);
    try {
      const response = await fetch("/api/tax-profile", {
        method: "PUT",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          ...nextSettings,
          _expectedUpdatedAt: settingsRecord?.updatedAt,
        }),
      });
      const result = (await response.json()) as {
        record?: StoredRecord;
        error?: string;
      };
      if (!response.ok || !result.record) {
        throw new Error(result.error || "Não foi possível salvar o enquadramento.");
      }
      setRecords((current) => {
        const exists = current.some((item) => item.id === result.record!.id);
        return exists
          ? current.map((item) =>
              item.id === result.record!.id ? result.record! : item,
            )
          : [result.record!, ...current];
      });
      setTaxProfile(result.record.payload as Partial<SystemSettings>);
      setToast({
        kind: "success",
        text: "Dados do CNPJ e enquadramento salvos com sucesso.",
      });
    } catch (error) {
      setToast({
        kind: "error",
        text:
          error instanceof Error
            ? error.message
            : "Não foi possível salvar o enquadramento.",
      });
    } finally {
      setSaving(false);
    }
  }

  async function savePayrollPreview(input: PayrollInput) {
    if (!hasEditingAccess()) return;
    setSaving(true);
    try {
      const response = await fetch("/api/payroll-preview", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ input }),
      });
      const body = (await response.json()) as {
        record?: StoredRecord;
        result?: PayrollResult;
        error?: string;
      };
      if (!response.ok || !body.record) {
        throw new Error(body.error || "Não foi possível salvar o cálculo.");
      }
      setRecords((current) => [body.record!, ...current]);
      setToast({
        kind: "success",
        text: `Cálculo reprocessado no servidor e salvo com as regras ${body.result?.rulesVersion || payrollRules2026.version}.`,
      });
    } catch (error) {
      setToast({
        kind: "error",
        text:
          error instanceof Error
            ? error.message
            : "Não foi possível salvar o cálculo.",
      });
    } finally {
      setSaving(false);
    }
  }

  async function saveTerminationPreview(input: TerminationInput) {
    if (!hasEditingAccess()) return;
    setSaving(true);
    try {
      const response = await fetch("/api/termination-preview", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ input }),
      });
      const body = (await response.json()) as {
        record?: StoredRecord;
        result?: TerminationResult;
        error?: string;
      };
      if (!response.ok || !body.record) {
        throw new Error(
          body.error || "Não foi possível salvar a prévia rescisória.",
        );
      }
      setRecords((current) => [body.record!, ...current]);
      setToast({
        kind: "success",
        text: `Prévia rescisória recalculada no servidor e salva com as regras ${body.result?.rulesVersion || terminationRules2026.version}. Nenhum dado foi transmitido.`,
      });
    } catch (error) {
      setToast({
        kind: "error",
        text:
          error instanceof Error
            ? error.message
            : "Não foi possível salvar a prévia rescisória.",
      });
    } finally {
      setSaving(false);
    }
  }

  async function runPayrollBatch(competence: string, work: string) {
    if (!hasEditingAccess()) {
      throw new Error(
        "Entre como administrador para processar e registrar a folha em lote.",
      );
    }
    const response = await fetch("/api/payroll-preview", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        registeredBatch: {
          competencia: competence,
          obra: work,
        },
      }),
    });
    const body = (await response.json()) as BatchPayrollResponse & {
      error?: string;
    };
    if (!response.ok || !body.success) {
      throw new Error(body.error || "Não foi possível processar o lote.");
    }
    if (body.record) {
      setRecords((current) => [body.record!, ...current]);
    }
    setToast({
      kind: "success",
      text: `Lote de ${body.meta.quantidadeColaboradores} colaboradores calculado no servidor e salvo para conferência.`,
    });
    return body;
  }

  function remove(record: StoredRecord) {
    if (!hasEditingAccess()) return;
    setPendingDelete(record);
  }

  async function confirmRemove() {
    if (!pendingDelete || !hasEditingAccess()) return;
    const record = pendingDelete;
    setDeleting(true);
    try {
      const response = await fetch(`/api/records?id=${record.id}`, {
        method: "DELETE",
      });
      const result = (await response.json()) as { error?: string };
      if (!response.ok) throw new Error(result.error);
      setRecords((current) => current.filter((item) => item.id !== record.id));
      setPendingDelete(null);
      setToast({
        kind: "success",
        text: "Tudo certo! O registro foi excluído.",
      });
    } catch (error) {
      setToast({
        kind: "error",
        text: error instanceof Error ? error.message : "Erro ao excluir.",
      });
    } finally {
      setDeleting(false);
    }
  }

  function requestImport(moduleId?: string) {
    if (!hasEditingAccess()) return;
    if (moduleId && !isImportableModule(moduleId)) {
      setToast({
        kind: "error",
        text:
          "Este módulo não aceita importação automática. O Importador Inteligente recebe somente " +
          importScopeDescription,
      });
      return;
    }
    setImportTarget(moduleId);
    fileInput.current?.click();
  }

  async function handleImport(file?: File) {
    if (!file || !hasEditingAccess()) return;
    const importId = crypto.randomUUID();
    const startedAt = new Date().toISOString();
    let reportStarted = false;
    let plannedTotalRows = 0;
    let clientSkipped = 0;
    let insertedCount = 0;
    let updatedCount = 0;
    let serverSkipped = 0;
    try {
      setToast({ kind: "success", text: "Lendo, identificando e validando a planilha…" });
      const imported = await importWorkbook(file, importTarget);
      clientSkipped = imported.report.reduce(
        (total, item) => total + item.duplicates + item.skipped,
        0,
      );
      plannedTotalRows =
        imported.records.length + imported.failures.length + clientSkipped;
      if (!imported.records.length) {
        if (imported.failures.length) {
          const failureReportResponse = await fetch("/api/records", {
            method: "POST",
            headers: { "content-type": "application/json" },
            body: JSON.stringify({
              importReport: {
                id: importId,
                fileName: file.name,
                targetModule: importTarget || "Detecção automática",
                status: "Concluída com pendências",
                totalRows: imported.failures.length + clientSkipped,
                inserted: 0,
                updated: 0,
                skipped: clientSkipped,
                failures: imported.failures,
                startedAt,
                finishedAt: new Date().toISOString(),
              },
            }),
          });
          if (!failureReportResponse.ok) {
            const failureReport = (await failureReportResponse.json()) as {
              error?: string;
            };
            throw new Error(
              failureReport.error ||
                "As pendências foram detectadas, mas o relatório não pôde ser salvo.",
            );
          }
          await loadImportRuns();
        }
        const unmatched = imported.unmatchedSheets.length
          ? " Abas não reconhecidas: " + imported.unmatchedSheets.join(", ") + "."
          : "";
        throw new Error(
          "Nenhum registro válido foi encontrado." + unmatched + " Revise os cabeçalhos e os campos obrigatórios.",
        );
      }

      const preview = imported.report
        .map((item) => {
          const errors = item.invalidExamples.length
            ? "\n  Pendências encontradas: " + item.invalidExamples.join(" | ")
            : "";
          return (
            item.sheet +
            " → " +
            item.family +
            " / " +
            item.module +
            " • " +
            item.layout +
            " • confiança " +
            item.confidence +
            "%: " +
            item.imported +
            " válidos, " +
            item.invalid +
            " inválidos, " +
            item.duplicates +
            " duplicados reais, " +
            item.skipped +
            " ignorados" +
            errors
          );
        })
        .join("\n\n");
      const confirmed = window.confirm(
        "Prévia da importação\n\n" + preview + "\n\nTotal pronto para importar: " + imported.records.length + ".\n\nConfirma a gravação?",
      );
      if (!confirmed) {
        setToast({ kind: "success", text: "Importação revisada e cancelada sem gravar dados." });
        return;
      }

      const processingResponse = await fetch("/api/records", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          importReport: {
            id: importId,
            fileName: file.name,
            targetModule: importTarget || "Detecção automática",
            status: "Processando",
            totalRows: plannedTotalRows,
            inserted: 0,
            updated: 0,
            skipped: clientSkipped,
            failures: [],
            startedAt,
          },
        }),
      });
      const processingResult = (await processingResponse.json()) as {
        error?: string;
      };
      if (!processingResponse.ok) {
        throw new Error(
          processingResult.error ||
            "Não foi possível iniciar o controle da importação.",
        );
      }
      reportStarted = true;

      const serverFailures: Array<{
        module: string;
        sheet: string;
        location: string;
        reason: string;
        payload: Record<string, unknown>;
      }> = [];
      const batchSize = 250;
      const concurrencyLimit = 2;
      const batches = Array.from(
        { length: Math.ceil(imported.records.length / batchSize) },
        (_, batchIndex) =>
imported.records.slice(
  batchIndex * batchSize,
  (batchIndex + 1) * batchSize,
),
      );

      async function uploadImportBatch(
        batch: typeof imported.records,
        batchIndex: number,
      ) {
        const response = await fetch("/api/records", {
method: "POST",
headers: { "content-type": "application/json" },
body: JSON.stringify({ records: batch }),
        });
        const result = (await response.json()) as {
result?: {
  count?: number;
  inserted?: number;
  updated?: number;
  skipped?: number;
  failures?: Array<{
    index: number;
    reason: string;
    payload: Record<string, unknown>;
  }>;
};
error?: string;
        };
        if (!response.ok) {
throw new Error(
  result.error || `Falha ao gravar o lote ${batchIndex + 1}.`,
);
        }

        const failures = (result.result?.failures || []).map((failure) => {
const sourceRecord = batch[failure.index];
return {
  module: sourceRecord?.module || importTarget || "",
  sheet:
    sourceRecord?.importSheet ||
    sourceRecord?.source?.split(" / ").at(-1) ||
    file.name,
  location:
    sourceRecord?.importLocation ||
    `lote ${batchIndex + 1}, registro ${failure.index + 1}`,
  reason: failure.reason,
  payload: failure.payload || sourceRecord?.payload || {},
};
        });

        return {
inserted:
  result.result?.inserted ??
  result.result?.count ??
  batch.length,
updated: result.result?.updated || 0,
skipped: result.result?.skipped || 0,
failures,
        };
      }

      for (
        let offset = 0;
        offset < batches.length;
        offset += concurrencyLimit
      ) {
        const group = batches.slice(offset, offset + concurrencyLimit);
        const outcomes = await Promise.allSettled(
group.map((batch, relativeIndex) =>
  uploadImportBatch(batch, offset + relativeIndex),
),
        );
        const failedMessages: string[] = [];

        for (const outcome of outcomes) {
if (outcome.status === "fulfilled") {
  insertedCount += outcome.value.inserted;
  updatedCount += outcome.value.updated;
  serverSkipped += outcome.value.skipped;
  serverFailures.push(...outcome.value.failures);
} else {
  failedMessages.push(
    outcome.reason instanceof Error
      ? outcome.reason.message
      : String(outcome.reason),
  );
}
        }

        if (failedMessages.length) {
throw new Error(
  `A importação foi interrompida após falha em ${failedMessages.length} lote(s): ${failedMessages.join(" | ")}`,
);
        }
      }

      const reportResponse = await fetch("/api/records", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          importReport: {
            id: importId,
            fileName: file.name,
            targetModule: importTarget || "Detecção automática",
            status: "Concluída",
            totalRows: plannedTotalRows,
            inserted: insertedCount,
            updated: updatedCount,
            skipped: clientSkipped + serverSkipped,
            failures: [...imported.failures, ...serverFailures],
            startedAt,
            finishedAt: new Date().toISOString(),
          },
        }),
      });
      const reportResult = (await reportResponse.json()) as { error?: string };
      if (!reportResponse.ok) {
        throw new Error(
          reportResult.error ||
            "Os dados foram gravados, mas o relatório da importação não pôde ser salvo.",
        );
      }
      reportStarted = false;
      await loadRecords();
      await loadImportRuns();
      setToast({
        kind: "success",
        text:
          `${insertedCount} incluídos, ${updatedCount} atualizados, ` +
          `${clientSkipped + serverSkipped} ignorados e ` +
          `${imported.failures.length + serverFailures.length} pendências registradas.`,
      });
    } catch (error) {
      const failureMessage =
        error instanceof Error
          ? error.message
          : "Não foi possível importar a planilha.";
      if (reportStarted) {
        try {
          await fetch("/api/records", {
            method: "POST",
            headers: { "content-type": "application/json" },
            body: JSON.stringify({
              importReport: {
                id: importId,
                fileName: file.name,
                targetModule: importTarget || "Detecção automática",
                status: "Falha",
                totalRows: plannedTotalRows,
                inserted: insertedCount,
                updated: updatedCount,
                skipped: clientSkipped + serverSkipped,
                failures: [
                  {
                    module: importTarget || "",
                    sheet: file.name,
                    location: "processamento",
                    reason: failureMessage,
                    payload: {},
                  },
                ],
                startedAt,
                finishedAt: new Date().toISOString(),
              },
            }),
          });
          await loadImportRuns();
        } catch {
          // A falha original continua sendo apresentada ao administrador.
        }
      }
      setToast({
        kind: "error",
        text: failureMessage,
      });
    } finally {
      if (fileInput.current) fileInput.current.value = "";
      setImportTarget(undefined);
    }
  }

  async function resolveImportFailure(id: string) {
    if (!hasEditingAccess()) return;
    try {
      const response = await fetch("/api/records", {
        method: "PUT",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ resolveImportErrorId: id }),
      });
      const result = (await response.json()) as { error?: string };
      if (!response.ok) throw new Error(result.error);
      await loadImportRuns();
      setToast({
        kind: "success",
        text: "Pendência de importação marcada como resolvida.",
      });
    } catch (error) {
      setToast({
        kind: "error",
        text:
          error instanceof Error
            ? error.message
            : "Não foi possível resolver a pendência.",
      });
    }
  }

  const displayName = isAdmin
    ? userName || "Administrador"
    : userName || "Visitante";
  const displayRole = isAdmin
    ? userEmail || "Administração protegida"
    : userEmail
      ? "Acesso autenticado • consulta"
      : "Acesso público • consulta";
  const initials =
    (displayName || userEmail || "Visitante")
      .split(/[\s@.]+/)
      .filter(Boolean)
      .slice(0, 2)
      .map((part) => part[0]?.toUpperCase())
    .join("") || "VG";
  const demoCount = operationalRecords.filter((record) =>
    record.source.startsWith("Demonstração"),
  ).length;

  return (
    <InternalCodeVisibilityContext.Provider
      value={{
        visible: isAdmin && showInternalCodes,
        toggle: () => {
          if (isAdmin) setShowInternalCodes((current) => !current);
        },
      }}
    >
      <div
        className="app-shell"
        style={
          {
            "--brand-primary": settings.primaryColor,
          } as CSSProperties
        }
      >
      <input
        ref={fileInput}
        className="hidden-file-input"
        type="file"
        accept=".xlsx,.csv"
        disabled={!isAdmin}
        onChange={(event) => handleImport(event.target.files?.[0])}
      />
      <aside className={`sidebar ${sidebarOpen ? "open" : ""}`}>
        <div className="brand">
          {settings.logoUrl ? (
            <span
              className="brand-logo"
              role="img"
              aria-label={`Logotipo ${settings.companyName}`}
              style={{ backgroundImage: `url("${settings.logoUrl}")` }}
            />
          ) : (
            /*
             * Só chega aqui quem apagar o campo Logotipo. O padrão aponta
             * para o arquivo da empresa; a letra grega fica como último
             * recurso, para a barra nunca ficar sem marca nenhuma.
             */
            <span className="brand-mark">β</span>
          )}
          <span>
            {/*
             * Só o nome da empresa, em maiúsculas. O nome do sistema saiu
             * daqui a pedido de Samuel Scolari: quem abre a tela trabalha na
             * Beta, não no "Beta Gestão 365", e a segunda linha competia com
             * a primeira sem acrescentar nada.
             */}
            <strong>{settings.companyName}</strong>
          </span>
        </div>
        <nav>
          {visibleNavigationGroups.map((group) => (
            <div className="nav-group" key={group.label}>
              <span>{group.label}</span>
              {group.items.map((item) => {
                const navModule = moduleMap[item];
                const label =
                  item === "dashboard"
                    ? "Visão geral"
                    : item === "manual"
                      ? "Manual do sistema"
                    : item === "tax-profile"
                      ? "Regime Tributário"
                    : item === "infrastructure"
                      ? "Infraestrutura ERP"
                    : item === "admin"
                      ? "Administração"
                      : navModule?.shortLabel || item;
                return (
                  <button
                    key={item}
                    className={activeView === item ? "active" : ""}
                    /* Âncora estável para testes: navegar comparando o texto
                       do botão quebra quando um rótulo é renomeado. */
                    data-view={item}
                    onClick={() => navigate(item)}
                  >
                    <Icon name={item === "tax-profile" ? "taxes" : item} size={19} />
                    <span>{label}</span>
                    {!["dashboard", "manual", "admin", "tax-profile", "infrastructure"].includes(item) &&
                    records.filter((record) => record.module === item).length ? (
                      <small>
                        {records.filter((record) => record.module === item).length}
                      </small>
                    ) : null}
                  </button>
                );
              })}
            </div>
          ))}
        </nav>
        <div className="sidebar-footer">
          <span className="user-avatar">{initials}</span>
          <span>
            <strong>{displayName}</strong>
            <small>{displayRole}</small>
          </span>
        </div>
      </aside>
      {sidebarOpen ? (
        <button
          className="sidebar-scrim"
          aria-label="Fechar menu"
          onClick={() => setSidebarOpen(false)}
        />
      ) : null}

      <main className="main-area">
        <header className="topbar">
          <div className="topbar-left">
            <button
              className="menu-button"
              onClick={() => setSidebarOpen(true)}
              aria-label="Abrir menu"
            >
              <Icon name="menu" />
            </button>
            <div>
              <span>{settings.companyName}</span>
              <strong>
                {activeView === "dashboard"
                  ? "Central operacional"
                  : activeView === "manual"
                    ? "Manual do sistema"
                  : activeView === "admin"
                    ? "Administração do sistema"
                    : activeView === "tax-profile"
                      ? "Regime Tributário"
                    : activeView === "infrastructure"
                      ? "Núcleo ERP & Infraestrutura"
                    : activeModule?.label || "Gestão"}
              </strong>
            </div>
          </div>
          <div className="topbar-actions">
            {isAdmin ? (
              <button
                type="button"
                className={`sync-chip internal-code-chip ${
                  showInternalCodes ? "active" : ""
                }`}
                onClick={() => setShowInternalCodes((current) => !current)}
                aria-pressed={showInternalCodes}
              >
                <Icon name={showInternalCodes ? "eye" : "lock"} size={16} />
                <span>
                  {showInternalCodes
                    ? "Identificadores visíveis"
                    : "Identificadores ocultos"}
                </span>
              </button>
            ) : null}
            <button
              className="sync-chip"
              onClick={() => loadRecords(true)}
              aria-label="Atualizar dados"
            >
              <Icon name="refresh" size={16} />
              <span>Atualizar</span>
            </button>
            <span className="tenant-chip">
              <i />
              Empresa ativa: {settings.companyName}
            </span>
            <span className="top-avatar">{initials}</span>
          </div>
        </header>
        {demoCount ? (
          <div className="demo-banner" role="status">
            <Icon name="alert" size={18} />
            <span>
              <strong>Ambiente de testes:</strong> {demoCount} registros
              fictícios estão ativos para validar todas as áreas. Não use esses
              dados como informações reais da empresa.
            </span>
          </div>
        ) : null}
        {!isAdmin ? (
          <div className="read-only-banner" role="status">
            <span><Icon name="eye" size={18} /></span>
            <div>
              <strong>Modo público de demonstração</strong>
              <small>
                Você pode navegar e testar os cálculos. Inclusões, alterações,
                exclusões, importações e exportações exigem o administrador.
              </small>
            </div>
            <span title="A identidade administrativa é validada pelo Cloudflare Access.">
              Acesso via Cloudflare
            </span>
          </div>
        ) : null}

        <div className="page-area" data-executive-module={activeModule ? "true" : "false"}>
          {loading ? (
            <LoadingState />
          ) : activeView === "dashboard" ? (
            <Dashboard
              records={operationalRecords}
              onNavigate={navigate}
              onNew={openNew}
              onOpenRecord={openRecord}
              onOpenApprovalRecord={openApprovalRecord}
              canEdit={isAdmin}
            />
          ) : activeView === "manual" ? (
            <SystemManualPage />
          ) : activeView === "admin" && isAdmin ? (
            <AdminPanel
              settings={settings}
              onSave={saveSystemSettings}
              saving={saving}
              adminEmail={userEmail}
            />
          ) : activeView === "tax-profile" ? (
            <TaxProfilePanel
              settings={settings}
              onSave={saveTaxProfile}
              saving={saving}
              canEdit={isAdmin}
            />
          ) : activeView === "infrastructure" ? (
            <InfrastructureCenter canEdit={isAdmin} />
          ) : activeView === "compliance" ? (
            <ComplianceCenter
              records={operationalRecords}
              search={search}
              setSearch={setSearch}
              status={statusFilter}
              setStatus={setStatusFilter}
              onNavigate={navigate}
              onNew={openNew}
              onEdit={openEdit}
              onDelete={remove}
              onImport={requestImport}
              onOpen={openRecord}
              canEdit={isAdmin}
            />
          ) : activeView === "payroll" ? (
            <PayrollStudio
              people={operationalRecords.filter(
                (record) => record.module === "people",
              )}
              previews={moduleRecords}
              saving={saving}
              onSave={savePayrollPreview}
              onRunBatch={runPayrollBatch}
              companyProfile={settings}
              canEdit={isAdmin}
            />
          ) : activeView === "terminations" ? (
            <TerminationStudio
              people={operationalRecords.filter(
                (record) => record.module === "people",
              )}
              payrollRecords={operationalRecords.filter(
                (record) => record.module === "payroll",
              )}
              terminations={moduleRecords}
              saving={saving}
              onSave={saveTerminationPreview}
              companyProfile={settings}
              canEdit={isAdmin}
              showInternalCodes={isAdmin && showInternalCodes}
            />
          ) : activeView === "m365" ? (
            <IntegrationHub
              records={moduleRecords}
              allRecords={operationalRecords}
              importRuns={importRuns}
              onNew={() => openNew("m365")}
              onEdit={openEdit}
              onDelete={remove}
              onImportAll={() => requestImport()}
              onResolveImportError={resolveImportFailure}
              canEdit={isAdmin}
            />
          ) : activeModule ? (
            <div className="integrated-view-stack">
              {activeView === "taxes" ? (
                <IbsCbsTaxCenter isAdmin={isAdmin} />
              ) : null}
              {activeView === "works" ? (
                <ConstructionExecutivePanel
                  records={operationalRecords}
                  onNavigate={navigate}
                  onNew={openNew}
                  onOpenRecord={openRecord}
                  canEdit={isAdmin}
                  context="module"
                />
              ) : null}
              {activeView === "assets" ? (
                <>
                  <MachineProductivityPanel
                    records={operationalRecords}
                    onNavigate={navigate}
                  />
                  <MachineExecutivePanel
                    records={operationalRecords}
                    onNew={openNew}
                    onOpenRecord={openRecord}
                    canEdit={isAdmin}
                  />
                </>
              ) : null}
              {activeView === "expenses" ? (
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
                  variant="executive"
                  /* Obra e Máquinas já têm painel próprio acima. */
                  hideHeading={activeView === "works" || activeView === "assets"}
                  /* Administrativo já oferece o cadastro em "Ações rápidas". */
                  hidePrimaryAction={activeView === "people"}
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
              )}
            </div>
          ) : null}
        </div>
      </main>

      {modalModule && isAdmin ? (
        <Modal
          module={modalModule}
          record={editing}
          assets={operationalRecords.filter(
            (record) => record.module === "assets",
          )}
          onClose={() => {
            setModalModule(null);
            setEditing(null);
          }}
          onSave={save}
          saving={saving}
        />
      ) : null}

      {selectedRecord && moduleMap[selectedRecord.module] ? (
        <RecordDetails
          module={moduleMap[selectedRecord.module]}
          record={selectedRecord}
          onClose={closeRecord}
          onEdit={() => openEdit(selectedRecord)}
          canEdit={isAdmin}
          decisionMode={decisionRecordId === selectedRecord.id}
          onDecision={decideManagementRequest}
          decisionSaving={decisionSaving}
        />
      ) : null}

      {pendingDelete && isAdmin ? (
        <div className="confirm-backdrop">
          <section
            className="confirm-dialog"
            role="dialog"
            aria-modal="true"
            aria-labelledby="delete-record-title"
          >
            <span className="confirm-icon">
              <Icon name="trash" size={22} />
            </span>
            <div>
              <span className="eyebrow">Confirmação de exclusão</span>
              <h2 id="delete-record-title">Excluir este registro?</h2>
              <p>
                <strong>{pendingDelete.title}</strong> será removido do módulo. A
                ação ficará registrada na auditoria do sistema.
              </p>
            </div>
            <footer>
              <button
                className="button secondary"
                type="button"
                disabled={deleting}
                onClick={() => setPendingDelete(null)}
              >
                Cancelar exclusão
              </button>
              <button
                className="button danger"
                type="button"
                disabled={deleting}
                onClick={confirmRemove}
              >
                <Icon name="trash" size={17} />
                {deleting ? "Excluindo…" : "Excluir registro"}
              </button>
            </footer>
          </section>
        </div>
      ) : null}

      {toast ? (
        <div className={`toast ${toast.kind}`}>
          <span>
            <Icon name={toast.kind === "success" ? "check" : "alert"} size={18} />
          </span>
          {toast.text}
        </div>
      ) : null}
      </div>
    </InternalCodeVisibilityContext.Provider>
  );
}
