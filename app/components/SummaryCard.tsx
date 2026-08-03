import type { ReactNode } from "react";

type SummaryCardTone =
  | "neutral"
  | "warning"
  | "danger"
  | "info"
  | "success";

type SummaryCardProps = {
  title: string;
  value: ReactNode;
  description: string;
  stripText?: string;
  tone?: SummaryCardTone;
  icon?: ReactNode;
  className?: string;
};

/**
 * Cartão-resumo compartilhado do Design System V86.
 *
 * A faixa de status faz parte do fluxo interno do cartão. O overflow do
 * contêiner garante que ela respeite o mesmo raio, sem criar linhas soltas ou
 * vazamentos abaixo da superfície branca.
 */
export default function SummaryCard({
  title,
  value,
  description,
  stripText,
  tone = "neutral",
  icon,
  className = "",
}: SummaryCardProps) {
  const classes = ["v86-summary-card", tone, className]
    .filter(Boolean)
    .join(" ");

  return (
    <article className={classes}>
      <div className="v86-summary-card__body">
        <header className="v86-summary-card__heading">
          <span className="v86-summary-card__title">{title}</span>
          {icon ? (
            <span className="v86-summary-card__icon" aria-hidden="true">
              {icon}
            </span>
          ) : null}
        </header>

        <strong className="v86-summary-card__value">{value}</strong>
        <span className="v86-summary-card__description">{description}</span>
      </div>

      {stripText ? (
        <footer className="v86-summary-card__strip">{stripText}</footer>
      ) : null}
    </article>
  );
}

export type { SummaryCardProps, SummaryCardTone };
