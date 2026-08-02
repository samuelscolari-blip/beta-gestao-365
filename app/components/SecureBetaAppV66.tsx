"use client";

import { createPortal } from "react-dom";
import {
  useCallback,
  useEffect,
  useMemo,
  useState,
} from "react";
import SecureBetaAppV65 from "./SecureBetaAppV65";

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

const decisionModules = new Set([
  "purchases",
  "expenses",
  "cards",
  "rentals",
]);

const moduleLabels: Record<string, string> = {
  purchases: "Compras",
  expenses: "Contas a pagar",
  cards: "Cartão corporativo",
  rentals: "Aluguéis",
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
          : record.module === "rentals"
            ? payload.totalMonthly
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

function ApprovedDecisionFallback() {
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
      // A tela principal permanece utilizável se a consulta auxiliar falhar.
    }
  }, []);

  useEffect(() => {
    const locate = () => {
      const center = document.querySelector<HTMLElement>(".management-center");
      const overview =
        center?.querySelector<HTMLElement>(".management-overview") || null;
      const tabs =
        center?.querySelector<HTMLElement>(".management-tabs") || null;

      setTargets((current) =>
        current.center === center &&
        current.overview === overview &&
        current.tabs === tabs
          ? current
          : { center, overview, tabs },
      );
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
          ".management-tabs button:not(.v66-approved-tab)",
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
        <article
          className="approved v65-approved-overview v66-approved-overview"
          data-v66-approved="overview"
        >
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
          className={`v65-approved-tab v66-approved-tab ${
            showApproved ? "active" : ""
          }`}
          data-v66-approved="tab"
          onClick={() => setShowApproved(true)}
        >
          Aprovados <span>{approved.length}</span>
        </button>,
        targets.tabs,
      )
    : null;

  const listPortal = targets.center && showApproved
    ? createPortal(
        <div
          className="v65-approved-list"
          data-v66-approved="list"
          aria-live="polite"
        >
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
              <p>
                Quando um pedido real for aprovado, ele aparecerá aqui com
                responsável, data, valor e documento.
              </p>
            </div>
          )}
        </div>,
        targets.center,
      )
    : null;

  return <>{overviewPortal}{tabPortal}{listPortal}</>;
}

export default function SecureBetaAppV66(props: Props) {
  return (
    <>
      <SecureBetaAppV65 {...props} />
      {!props.isAdmin ? <ApprovedDecisionFallback /> : null}
    </>
  );
}
