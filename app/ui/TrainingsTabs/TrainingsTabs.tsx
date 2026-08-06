import { avaliarTreinamento, TREINAMENTOS } from "../../lib/trainings.mjs";

import styles from "./TrainingsTabs.module.css";

/*
 * Abas por treinamento.
 *
 * É a planilha que o RH já usa, virada em tela: uma aba para cada
 * treinamento — Integração Elecnor, Integração Engie, Sinaleiro, Trabalho em
 * altura, Direção Defensiva, NR-11/NR-12 — e dentro de cada uma os
 * colaboradores com aquela exigência.
 *
 * A aba escolhida filtra a lista abaixo. Não é uma segunda lista: é a mesma
 * tabela, recortada. Duas listas para o mesmo dado seria a origem clássica de
 * "na aba diz uma coisa e na lista diz outra".
 *
 * O número vermelho na aba é quantas pessoas estão irregulares naquele
 * treinamento. É o que responde, sem abrir aba por aba, onde está o atraso.
 */

type Registro = { payload?: Record<string, unknown> };

function contarPorTreinamento(records: Registro[]) {
  const contagem = new Map<string, { total: number; pendentes: number }>();

  for (const registro of records) {
    const payload = (registro.payload ?? registro) as Record<string, unknown>;
    const tipo = String(payload.trainingType ?? "").trim();
    if (!tipo) continue;

    const atual = contagem.get(tipo) ?? { total: 0, pendentes: 0 };
    atual.total += 1;
    if (avaliarTreinamento(payload).precisaAtencao) atual.pendentes += 1;
    contagem.set(tipo, atual);
  }

  return contagem;
}

export default function TrainingsTabs({
  records,
  active,
  onSelect,
}: {
  records: Registro[];
  active: string;
  onSelect: (treinamento: string) => void;
}) {
  const contagem = contarPorTreinamento(records);

  /*
   * A ordem é a da lista oficial, para a tela não reordenar sozinha a cada
   * registro novo. Tipos que aparecem nos registros sem estar na lista entram
   * no fim, em vez de sumirem — dado importado errado precisa ficar visível.
   */
  const forasDaLista = [...contagem.keys()].filter(
    (tipo) => !TREINAMENTOS.includes(tipo),
  );
  const abas = [...TREINAMENTOS, ...forasDaLista].filter(
    (tipo) => (contagem.get(tipo)?.total ?? 0) > 0,
  );

  if (abas.length === 0) return null;

  const totalPendentes = [...contagem.values()].reduce(
    (soma, item) => soma + item.pendentes,
    0,
  );

  return (
    <nav
      className={styles.root}
      data-ui="trainings-tabs"
      aria-label="Treinamentos"
    >
      <div className={styles.abas} role="tablist">
        <button
          type="button"
          role="tab"
          aria-selected={active === ""}
          className={active === "" ? styles.ativa : undefined}
          onClick={() => onSelect("")}
        >
          <span>Todos</span>
          <strong>{records.length}</strong>
          {totalPendentes > 0 ? (
            <em className={styles.alerta}>{totalPendentes}</em>
          ) : null}
        </button>

        {abas.map((tipo) => {
          const item = contagem.get(tipo) ?? { total: 0, pendentes: 0 };
          return (
            <button
              key={tipo}
              type="button"
              role="tab"
              aria-selected={active === tipo}
              className={active === tipo ? styles.ativa : undefined}
              onClick={() => onSelect(active === tipo ? "" : tipo)}
            >
              <span>{tipo}</span>
              <strong>{item.total}</strong>
              {item.pendentes > 0 ? (
                <em className={styles.alerta}>{item.pendentes}</em>
              ) : null}
            </button>
          );
        })}
      </div>

      <p className={styles.legenda}>
        Cada aba é um treinamento, com os colaboradores que precisam dele na
        lista abaixo. O número escuro é quantas pessoas estão registradas; o
        número vermelho é quantas estão irregulares — vencidas, sem
        agendamento ou com a data agendada já passada.
      </p>
    </nav>
  );
}
