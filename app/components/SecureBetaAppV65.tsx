"use client";

import { createPortal } from "react-dom";
import {
  useCallback,
  useEffect,
  useMemo,
  useState,
  type ChangeEvent as ReactChangeEvent,
} from "react";
import SecureBetaAppV52 from "./SecureBetaAppV52";
import {
  inspectImportFileV65,
  type ImportPreflightResult,
} from "../lib/import-preflight-v65";
import "../lib/v65-module-enhancements";

type Props = {
  userName?: string | null;
  userEmail?: string | null;
  isAdmin: boolean;
};

type RecordView = {
  id: number;
  module: string;
  title: string;
  reference: string;
  status: string;
  recordDate: string;
  amount: number;
  payload: Record<string, unknown>;
  source: string;
  updatedAt?: string;
};

type PortalTargets = {
  center: HTMLElement | null;
  overview: HTMLElement | null;
  tabs: HTMLElement | null;
};

type PendingImport = {
  input: HTMLInputElement;
  file: File;
  result: ImportPreflightResult;
};

const decisionModules = new Set(["purchases", "expenses", "cards"]);

const moduleLabels: Record<string, string> = {
  purchases: "Compras",
  expenses: "Contas a pagar",
  cards: "Cartão corporativo",
};

function normalized(value: unknown) {
  return String(value ?? "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim()
    .toLowerCase();
}

function isRealRecord(record: RecordView) {
  const source = normalized(record.source);
  const reference = normalized(record.reference);
  return (
    !source.includes("demonstracao") &&
    !source.includes("ficticio") &&
    !reference.startsWith("tst-") &&
    record.payload.isDemo !== true
  );
}

function isApproved(record: RecordView) {
  return [
    record.payload.managementDecision,
    record.payload.approval,
    record.status,
  ].some((value) => {
    const text = normalized(value);
    return text.includes("aprov") || text === "pago" || text === "paga";
  });
}

function recordAmount(record: RecordView) {
  const payload = record.payload;
  const value =
    record.module === "purchases"
      ? payload.totalAmount
      : record.module === "expenses"
        ? payload.expectedAmount
        : record.module === "cards"
          ? payload.amount
          : record.amount;
  const amount = Number(value ?? record.amount ?? 0);
  return Number.isFinite(amount) ? amount : 0;
}

function evidenceUrl(record: RecordView) {
  return String(
    record.payload.receiptUrl ||
      record.payload.invoiceUrl ||
      record.payload.documentUrl ||
      record.payload.documentsUrl ||
      "",
  ).trim();
}

function decisionOwner(record: RecordView) {
  return String(
    record.payload.managementDecisionBy ||
      record.payload.approvedBy ||
      record.payload.responsible ||
      record.payload.requester ||
      "Não informado",
  ).trim();
}

function decisionDate(record: RecordView) {
  const raw = String(
    record.payload.managementDecisionAt ||
      record.payload.approvalDate ||
      record.updatedAt ||
      record.recordDate ||
      "",
  );
  const date = new Date(raw);
  return Number.isNaN(date.getTime())
    ? "Data não informada"
    : new Intl.DateTimeFormat("pt-BR").format(date);
}

function ApprovedDecisionExtension() {
  const [targets, setTargets] = useState<PortalTargets>({
    center: null,
    overview: null,
    tabs: null,
  });
  const [records, setRecords] = useState<RecordView[]>([]);
  const [showApproved, setShowApproved] = useState(false);

  const refresh = useCallback(async () => {
    try {
      const response = await fetch("/api/records", { cache: "no-store" });
      if (!response.ok) return;
      const body = (await response.json()) as { records?: RecordView[] };
      setRecords(Array.isArray(body.records) ? body.records : []);
    } catch {
      // A central principal continua funcionando mesmo sem a atualização auxiliar.
    }
  }, []);

  useEffect(() => {
    const locate = () => {
      const center = document.querySelector<HTMLElement>(".management-center");
      setTargets({
        center,
        overview:
          center?.querySelector<HTMLElement>(".management-overview") || null,
        tabs: center?.querySelector<HTMLElement>(".management-tabs") || null,
      });
    };
    locate();
    const observer = new MutationObserver(locate);
    observer.observe(document.body, { childList: true, subtree: true });
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    void refresh();
    const interval = window.setInterval(refresh, 30_000);
    return () => window.clearInterval(interval);
  }, [refresh]);

  useEffect(() => {
    const center = targets.center;
    if (!center) return;
    center.classList.toggle("v65-show-approved", showApproved);
    const closeApproved = (event: Event) => {
      const element = event.target as Element | null;
      if (
        element?.closest(
          ".management-tabs button:not(.v65-approved-tab)",
        )
      ) {
        setShowApproved(false);
      }
    };
    center.addEventListener("click", closeApproved);
    return () => {
      center.classList.remove("v65-show-approved");
      center.removeEventListener("click", closeApproved);
    };
  }, [showApproved, targets.center]);

  const approved = useMemo(
    () =>
      records
        .filter(
          (record) =>
            decisionModules.has(record.module) &&
            isRealRecord(record) &&
            isApproved(record),
        )
        .sort((a, b) =>
          String(b.updatedAt || b.recordDate).localeCompare(
            String(a.updatedAt || a.recordDate),
          ),
        ),
    [records],
  );

  const overviewPortal = targets.overview
    ? createPortal(
        <article className="approved v65-approved-overview">
          <span aria-hidden="true">✓</span>
          <div>
            <small>Aprovados</small>
            <strong>{approved.length}</strong>
            <em>com decisão registrada</em>
          </div>
        </article>,
        targets.overview,
      )
    : null;

  const tabPortal = targets.tabs
    ? createPortal(
        <button
          type="button"
          className={`v65-approved-tab ${showApproved ? "active" : ""}`}
          onClick={() => setShowApproved(true)}
        >
          Aprovados <span>{approved.length}</span>
        </button>,
        targets.tabs,
      )
    : null;

  const listPortal = targets.center && showApproved
    ? createPortal(
        <div className="v65-approved-list" aria-live="polite">
          {approved.length ? (
            approved.slice(0, 12).map((record) => {
              const proof = evidenceUrl(record);
              return (
                <article className="v65-approved-row" key={record.id}>
                  <span className="v65-approved-mark" aria-hidden="true">✓</span>
                  <div className="v65-approved-main">
                    <strong>{record.title}</strong>
                    <small>
                      {moduleLabels[record.module] || record.module} • Responsável: {decisionOwner(record)}
                    </small>
                    <em>Decisão registrada em {decisionDate(record)}</em>
                  </div>
                  <div className="v65-approved-value">
                    <strong>
                      {new Intl.NumberFormat("pt-BR", {
                        style: "currency",
                        currency: "BRL",
                      }).format(recordAmount(record))}
                    </strong>
                    <small>Aprovado</small>
                  </div>
                  {proof ? (
                    <a href={proof} target="_blank" rel="noreferrer">
                      Ver documento ↗
                    </a>
                  ) : (
                    <span className="v65-no-proof">Sem documento vinculado</span>
                  )}
                </article>
              );
            })
          ) : (
            <div className="v65-approved-empty">
              <span aria-hidden="true">✓</span>
              <strong>Nenhuma decisão aprovada registrada</strong>
              <p>Quando a gerência aprovar um pedido real, ele aparecerá aqui com responsável, data e documento.</p>
            </div>
          )}
        </div>,
        targets.center,
      )
    : null;

  return <>{overviewPortal}{tabPortal}{listPortal}</>;
}

function ImportPreflightModal({
  pending,
  onContinue,
  onCancel,
}: {
  pending: PendingImport;
  onContinue: () => void;
  onCancel: () => void;
}) {
  return createPortal(
    <div className="v65-preflight-backdrop" role="presentation">
      <section
        className={`v65-preflight-modal ${pending.result.kind}`}
        role="dialog"
        aria-modal="true"
        aria-labelledby="v65-preflight-title"
      >
        <header>
          <span aria-hidden="true">
            {pending.result.kind === "error" ? "!" : "✓"}
          </span>
          <div>
            <small>VERIFICAÇÃO DO IMPORTADOR</small>
            <h2 id="v65-preflight-title">{pending.result.title}</h2>
            <p>{pending.result.message}</p>
          </div>
        </header>
        {pending.result.details.length ? (
          <div className="v65-preflight-details">
            {pending.result.details.slice(0, 12).map((detail) => (
              <p key={detail}>{detail}</p>
            ))}
          </div>
        ) : null}
        <footer>
          <button type="button" className="button secondary" onClick={onCancel}>
            {pending.result.kind === "error" ? "Fechar" : "Cancelar"}
          </button>
          {pending.result.kind !== "error" ? (
            <button type="button" className="button primary" onClick={onContinue}>
              Continuar para a prévia
            </button>
          ) : null}
        </footer>
      </section>
    </div>,
    document.body,
  );
}

export default function SecureBetaAppV65(props: Props) {
  const [pendingImport, setPendingImport] = useState<PendingImport | null>(null);

  const dispatchValidatedFile = useCallback((input: HTMLInputElement) => {
    input.dataset.v65Validated = "true";
    input.dispatchEvent(new Event("change", { bubbles: true }));
    window.setTimeout(() => delete input.dataset.v65Validated, 0);
  }, []);

  useEffect(() => {
    if (!props.isAdmin) return;

    const interceptFile = (event: Event) => {
      const input = event.target as HTMLInputElement | null;
      if (
        !input?.matches('input.hidden-file-input[type="file"]') ||
        input.dataset.v65Validated === "true"
      ) {
        return;
      }
      const file = input.files?.[0];
      if (!file) return;

      event.preventDefault();
      event.stopPropagation();
      event.stopImmediatePropagation();

      void inspectImportFileV65(file)
        .then((result) => {
          if (result.kind === "clear") {
            dispatchValidatedFile(input);
            return;
          }
          setPendingImport({ input, file, result });
        })
        .catch((error) => {
          setPendingImport({
            input,
            file,
            result: {
              kind: "error",
              title: "Não foi possível conferir a planilha",
              message:
                error instanceof Error
                  ? error.message
                  : "O arquivo não pôde ser analisado antes da importação.",
              details: [],
            },
          });
        });
    };

    window.addEventListener("change", interceptFile, true);
    return () => window.removeEventListener("change", interceptFile, true);
  }, [dispatchValidatedFile, props.isAdmin]);

  const cancelPreflight = useCallback(() => {
    if (pendingImport) pendingImport.input.value = "";
    setPendingImport(null);
  }, [pendingImport]);

  const continuePreflight = useCallback(() => {
    if (!pendingImport) return;
    const input = pendingImport.input;
    setPendingImport(null);
    dispatchValidatedFile(input);
  }, [dispatchValidatedFile, pendingImport]);

  return (
    <>
      <SecureBetaAppV52 {...props} />
      {props.isAdmin ? <ApprovedDecisionExtension /> : null}
      {pendingImport ? (
        <ImportPreflightModal
          pending={pendingImport}
          onContinue={continuePreflight}
          onCancel={cancelPreflight}
        />
      ) : null}
    </>
  );
}
