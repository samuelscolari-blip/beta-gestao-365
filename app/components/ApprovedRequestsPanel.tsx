"use client";

import { useMemo } from "react";

export type ApprovedRequestItem = {
  id: string | number;
  category: string;
  title: string;
  description: string;
  amount: number;
  approvalDate: string;
  owner: string;
  evidenceUrl?: string;
};

type Props = {
  items: ApprovedRequestItem[];
  emptyDescription?: string;
};

const currency = new Intl.NumberFormat("pt-BR", {
  style: "currency",
  currency: "BRL",
});

export default function ApprovedRequestsPanel({
  items,
  emptyDescription =
    "Quando uma solicitação for aprovada, ela aparecerá aqui com responsável, data, valor e documento.",
}: Props) {
  const totalAmount = useMemo(
    () => items.reduce((sum, item) => sum + Math.max(0, item.amount || 0), 0),
    [items],
  );

  return (
    <section
      className="v65-approved-list v77-approved-panel"
      aria-live="polite"
    >
      <header className="v77-approved-heading">
        <div>
          <small>AÇÃO IMEDIATA</small>
          <h3>Solicitações aprovadas</h3>
          <p>Decisões liberadas para execução, pagamento ou acompanhamento.</p>
        </div>
        <div className="v77-approved-summary">
          <span>
            <small>Total liberado</small>
            <strong>{currency.format(totalAmount)}</strong>
          </span>
          <b aria-label={`${items.length} solicitações aprovadas`}>{items.length}</b>
        </div>
      </header>

      {items.length ? (
        <div className="v77-approved-grid">
          {items.map((item) => (
            <article className="v77-approved-card" key={item.id}>
              <span className="v77-approved-category">{item.category}</span>
              <h4>{item.title}</h4>
              <p>{item.description}</p>
              <footer>
                <div>
                  <small>Aprovação</small>
                  <strong>{item.approvalDate}</strong>
                  <em>{item.owner}</em>
                </div>
                <div className="v77-approved-value">
                  <strong>{currency.format(item.amount)}</strong>
                  {item.evidenceUrl ? (
                    <a href={item.evidenceUrl} target="_blank" rel="noreferrer">
                      Ver documento ↗
                    </a>
                  ) : (
                    <span>Sem documento</span>
                  )}
                </div>
              </footer>
            </article>
          ))}
        </div>
      ) : (
        <div className="v77-approved-empty">
          <span aria-hidden="true">✓</span>
          <strong>Nenhuma decisão aprovada registrada</strong>
          <p>{emptyDescription}</p>
        </div>
      )}
    </section>
  );
}
