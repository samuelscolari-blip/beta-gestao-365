import { calculateFieldLeave } from "../../lib/field-leave.mjs";

import styles from "./FieldLeaveSummary.module.css";

/*
 * Resumo da Folga de Campo, acima da lista de registros.
 *
 * A tela sozinha guarda os dados; este painel é quem responde as perguntas
 * que levam alguém a abrir a tela: quanto já custou, quem está prestes a
 * ganhar o direito, e se alguma data foi digitada errado.
 *
 * O cálculo vem do motor em `app/lib/field-leave.mjs`, o mesmo que os
 * testes exercitam. Recalcular aqui, com outra conta, criaria dois números
 * verdadeiros para a mesma pergunta.
 */

type Registro = {
  payload?: Record<string, unknown>;
};

const dinheiro = (valor: number) =>
  valor.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

const dataBR = (iso: string) =>
  iso ? iso.split("-").reverse().join("/") : "—";

/** Dias entre hoje e uma data ISO. Negativo quando já passou. */
function diasAte(iso: string): number | null {
  if (!iso) return null;
  const alvo = new Date(`${iso}T00:00:00Z`).getTime();
  if (Number.isNaN(alvo)) return null;
  const hoje = new Date();
  const hojeUTC = Date.UTC(
    hoje.getFullYear(),
    hoje.getMonth(),
    hoje.getDate(),
  );
  return Math.round((alvo - hojeUTC) / 86_400_000);
}

export default function FieldLeaveSummary({
  records,
}: {
  records: Registro[];
}) {
  const calculados = records.map((registro) => {
    const p = registro.payload ?? {};
    const numero = (chave: string) => Number(p[chave]) || 0;
    return {
      colaborador: String(p.employeeName ?? "").trim() || "Sem nome",
      resultado: calculateFieldLeave({
        contagemDesde: String(p.countFrom ?? ""),
        inicioDaFolga: String(p.leaveStart ?? ""),
        resolucao: p.resolution as "Folga concedida" | "Comprada pela empresa",
        valorDaCompra: numero("purchaseAmount"),
        passagemIda: numero("ticketOut"),
        passagemVolta: numero("ticketReturn"),
        alimentacaoIda: numero("mealsOut"),
        alimentacaoVolta: numero("mealsReturn"),
        hotel: numero("hotel"),
      }),
    };
  });

  const custoTotal = calculados.reduce(
    (soma, item) => soma + item.resultado.custoTotal,
    0,
  );
  const compradas = records.filter(
    (r) => r.payload?.resolution === "Comprada pela empresa",
  ).length;

  /* Quem ganha o direito nos próximos 30 dias, ou já ganhou e não tirou. */
  const proximas = calculados
    .map((item) => ({ ...item, dias: diasAte(item.resultado.direitoEm) }))
    .filter((item) => item.dias !== null && item.dias <= 30)
    .sort((a, b) => (a.dias ?? 0) - (b.dias ?? 0))
    .slice(0, 4);

  /* Avisos do motor: data antes do direito, valor faltando, viagem ignorada. */
  const avisos = calculados.flatMap((item) =>
    item.resultado.avisos.map((texto) => ({
      colaborador: item.colaborador,
      texto,
    })),
  );

  if (records.length === 0) {
    return (
      <section className={styles.root} data-ui="field-leave-summary">
        <p className={styles.vazio}>
          Nenhuma Folga de Campo registrada. Ela vale para quem está marcado
          com <strong>residência fora da cidade da obra</strong> no Cadastro de
          Funcionários: são 9 dias corridos em casa a cada 90 trabalhados.
        </p>
      </section>
    );
  }

  return (
    <section className={styles.root} data-ui="field-leave-summary">
      <div className={styles.numeros}>
        <article>
          <span>Registros</span>
          <strong>{records.length}</strong>
        </article>
        <article>
          <span>Custo acumulado</span>
          <strong>{dinheiro(custoTotal)}</strong>
        </article>
        <article>
          <span>Compradas pela empresa</span>
          <strong>{compradas}</strong>
        </article>
      </div>

      {proximas.length > 0 ? (
        <div className={styles.bloco}>
          <h3>Direito a vencer</h3>
          <ul>
            {proximas.map((item, indice) => (
              <li key={`${item.colaborador}-${indice}`}>
                <strong>{item.colaborador}</strong>
                <span>
                  {(item.dias ?? 0) < 0
                    ? `venceu em ${dataBR(item.resultado.direitoEm)}`
                    : (item.dias ?? 0) === 0
                      ? "vence hoje"
                      : `em ${item.dias} dia${item.dias === 1 ? "" : "s"}, ${dataBR(item.resultado.direitoEm)}`}
                </span>
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      {avisos.length > 0 ? (
        <div className={`${styles.bloco} ${styles.avisos}`}>
          <h3>Conferir</h3>
          <ul>
            {avisos.slice(0, 5).map((aviso, indice) => (
              <li key={`${aviso.colaborador}-${indice}`}>
                <strong>{aviso.colaborador}</strong>
                <span>{aviso.texto}</span>
              </li>
            ))}
          </ul>
        </div>
      ) : null}
    </section>
  );
}
