import { resumirTreinamentos } from "../../lib/trainings.mjs";

import styles from "./TrainingsSummary.module.css";

/*
 * Resumo dos treinamentos, acima da lista.
 *
 * Responde a pergunta que o RH faz toda segunda-feira: quem não pode
 * entrar na obra esta semana. A lista de registros sozinha não responde
 * isso — obriga a ler linha por linha comparando datas de cabeça.
 *
 * O cálculo vem do motor em `app/lib/trainings.mjs`, o mesmo que os testes
 * exercitam. Refazer a conta aqui criaria dois números verdadeiros para a
 * mesma pergunta, e só um deles testado.
 */

type Registro = { payload?: Record<string, unknown> };

const dataBR = (iso: string) => (iso ? iso.split("-").reverse().join("/") : "—");

export default function TrainingsSummary({
  records,
}: {
  records: Registro[];
}) {
  const resumo = resumirTreinamentos(records);

  if (records.length === 0) {
    return (
      <section className={styles.root} data-ui="trainings-summary">
        <p className={styles.vazio}>
          Nenhum treinamento registrado. Lance um registro por colaborador e
          treinamento — <strong>integração, NR de altura, NR11/NR12</strong> —
          com a data agendada. O sistema avisa o que vence antes de a pessoa
          ser barrada no portão da obra.
        </p>
      </section>
    );
  }

  const contagens: Array<[string, number, string]> = [
    ["Vencidos", resumo.porSituacao.Vencido, styles.grave],
    ["Vencem em 30 dias", resumo.porSituacao["A vencer"], styles.atencao],
    [
      "Agendamento perdido",
      resumo.porSituacao["Agendamento vencido"],
      styles.atencao,
    ],
    ["Sem agendamento", resumo.porSituacao.Pendente, styles.atencao],
    ["Em dia", resumo.emDia, styles.ok],
  ];

  return (
    <section className={styles.root} data-ui="trainings-summary">
      <div className={styles.numeros}>
        {contagens.map(([rotulo, valor, classe]) => (
          <article key={rotulo} className={valor > 0 ? classe : undefined}>
            <span>{rotulo}</span>
            <strong>{valor}</strong>
          </article>
        ))}
      </div>

      {resumo.pendencias.length > 0 ? (
        <div className={styles.bloco}>
          <h3>Resolver primeiro</h3>
          <ul>
            {/*
              * Já vem ordenado por urgência do motor: vencido, agendamento
              * perdido, a vencer, pendente. Quem abre a tela resolve de cima
              * para baixo.
              */}
            {resumo.pendencias.slice(0, 8).map((item, indice) => (
              <li key={`${item.colaborador}-${item.treinamento}-${indice}`}>
                <div>
                  <strong>{item.colaborador}</strong>
                  <em>{item.treinamento}</em>
                </div>
                <span className={styles[item.situacao === "Vencido" ? "grave" : "atencao"]}>
                  {item.situacao}
                </span>
              </li>
            ))}
          </ul>
          {resumo.pendencias.length > 8 ? (
            <p className={styles.resto}>
              e mais {resumo.pendencias.length - 8} pendência
              {resumo.pendencias.length - 8 === 1 ? "" : "s"} na lista abaixo.
            </p>
          ) : null}
        </div>
      ) : (
        <p className={styles.vazio}>
          Nenhuma pendência: todos os treinamentos registrados estão em dia ou
          com curso agendado.
        </p>
      )}
    </section>
  );
}

export { dataBR };
