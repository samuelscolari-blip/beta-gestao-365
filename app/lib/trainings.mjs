/*
 * Treinamentos e certificações obrigatórias.
 *
 * Quem entra numa obra da Elecnor ou da Engie precisa comprovar integração,
 * NR de altura, NR11/NR12 e afins. Sem o comprovante válido a pessoa não
 * entra — e descobrir isso no portão custa um dia de trabalho perdido.
 *
 * O que este arquivo resolve é a pergunta que o RH faz toda semana: quem
 * está com o quê vencendo, e quem já perdeu a data agendada.
 *
 * A situação NÃO é digitada. Ela sai das datas, porque situação digitada
 * envelhece sozinha: alguém marca "Concluído" e o certificado vence seis
 * meses depois sem ninguém tocar no registro. Aqui o vencimento é
 * calculado toda vez que a tela abre.
 */

/** Antecedência com que um vencimento passa a ser avisado. */
export const DIAS_DE_AVISO = 30;

/*
 * Os treinamentos que a operação exige hoje.
 *
 * Lista fechada de propósito: em campo livre, "NR 35", "NR-35" e "Trabalho
 * em Altura" viram três treinamentos diferentes, e aí ninguém consegue
 * responder quantas pessoas têm altura em dia.
 */
export const TREINAMENTOS = [
  "Integração Elecnor",
  "Integração Engie",
  "Treinamento Sinaleiro",
  "Trabalho em altura — NR-35",
  "Direção Defensiva",
  "NR-11 — Movimentação de cargas",
  "NR-12 — Máquinas e equipamentos",
  "NR-10 — Segurança em eletricidade",
  "NR-18 — Construção civil",
  "NR-33 — Espaço confinado",
  "NR-06 — Uso de EPI",
  "Primeiros socorros",
  "Brigada de incêndio",
];

/** Situações possíveis, todas derivadas das datas. */
export const SITUACOES = [
  "Pendente",
  "Agendado",
  "Agendamento vencido",
  "Concluído",
  "A vencer",
  "Vencido",
];

function paraData(iso) {
  if (!iso) return null;
  const data = new Date(`${iso}T00:00:00Z`);
  return Number.isNaN(data.getTime()) ? null : data;
}

function hojeUTC(referencia) {
  const base = referencia ? new Date(`${referencia}T00:00:00Z`) : new Date();
  return Date.UTC(
    base.getUTCFullYear(),
    base.getUTCMonth(),
    base.getUTCDate(),
  );
}

/** Dias entre hoje e a data. Negativo quando já passou. */
function diasAte(iso, referencia) {
  const alvo = paraData(iso);
  if (!alvo) return null;
  return Math.round((alvo.getTime() - hojeUTC(referencia)) / 86_400_000);
}

/**
 * Situação de um treinamento, a partir das datas.
 *
 * `referencia` existe para o teste poder fixar "hoje". Sem isso, um teste
 * de vencimento passaria hoje e falharia amanhã.
 */
export function avaliarTreinamento(registro, referencia) {
  const agendado = String(registro.scheduledDate ?? "").trim();
  const concluido = String(registro.completedDate ?? "").trim();
  const validade = String(registro.validityDate ?? "").trim();

  const avisos = [];

  if (concluido) {
    const diasParaVencer = diasAte(validade, referencia);

    if (!validade) {
      /*
       * Treinamento sem validade é o caso das integrações, que valem
       * enquanto durar o contrato. Não é erro, e por isso não gera aviso.
       */
      return {
        situacao: "Concluído",
        diasParaVencer: null,
        precisaAtencao: false,
        avisos,
      };
    }

    if (diasParaVencer < 0) {
      avisos.push(
        `Certificado venceu em ${validade}. A pessoa não pode entrar na obra até renovar.`,
      );
      return {
        situacao: "Vencido",
        diasParaVencer,
        precisaAtencao: true,
        avisos,
      };
    }

    if (diasParaVencer <= DIAS_DE_AVISO) {
      avisos.push(
        `Vence em ${diasParaVencer} dia${diasParaVencer === 1 ? "" : "s"}. Agende a reciclagem.`,
      );
      return {
        situacao: "A vencer",
        diasParaVencer,
        precisaAtencao: true,
        avisos,
      };
    }

    return {
      situacao: "Concluído",
      diasParaVencer,
      precisaAtencao: false,
      avisos,
    };
  }

  if (agendado) {
    const diasParaOCurso = diasAte(agendado, referencia);

    /*
     * Data agendada que já passou sem conclusão é o caso mais caro: todo
     * mundo acha que está resolvido, e a pessoa continua sem poder entrar.
     */
    if (diasParaOCurso < 0) {
      avisos.push(
        `Agendado para ${agendado} e ainda sem conclusão. Confirme se a pessoa compareceu.`,
      );
      return {
        situacao: "Agendamento vencido",
        diasParaVencer: null,
        precisaAtencao: true,
        avisos,
      };
    }

    return {
      situacao: "Agendado",
      diasParaVencer: null,
      precisaAtencao: false,
      avisos,
    };
  }

  return {
    situacao: "Pendente",
    diasParaVencer: null,
    precisaAtencao: true,
    avisos: ["Sem agendamento. A pessoa não pode entrar na obra."],
  };
}

/**
 * Resumo de um conjunto de registros, para o painel da tela.
 *
 * Conta por situação e separa o que exige ação — que é a única pergunta
 * que interessa de manhã: o que precisa ser resolvido hoje.
 */
export function resumirTreinamentos(registros, referencia) {
  const porSituacao = Object.fromEntries(SITUACOES.map((s) => [s, 0]));
  const pendencias = [];

  for (const registro of registros) {
    const payload = registro.payload ?? registro;
    const avaliacao = avaliarTreinamento(payload, referencia);
    porSituacao[avaliacao.situacao] += 1;

    if (avaliacao.precisaAtencao) {
      pendencias.push({
        colaborador: String(payload.employeeName ?? "").trim() || "Sem nome",
        treinamento: String(payload.trainingType ?? "").trim() || "Sem tipo",
        situacao: avaliacao.situacao,
        diasParaVencer: avaliacao.diasParaVencer,
        aviso: avaliacao.avisos[0] ?? "",
      });
    }
  }

  /*
   * Vencido antes de a vencer, e a vencer antes de pendente: a ordem é a
   * da urgência, porque quem abre a tela resolve de cima para baixo.
   */
  const peso = {
    Vencido: 0,
    "Agendamento vencido": 1,
    "A vencer": 2,
    Pendente: 3,
  };
  pendencias.sort(
    (a, b) =>
      (peso[a.situacao] ?? 9) - (peso[b.situacao] ?? 9) ||
      (a.diasParaVencer ?? 0) - (b.diasParaVencer ?? 0),
  );

  return {
    total: registros.length,
    porSituacao,
    pendencias,
    emDia: porSituacao["Concluído"] + porSituacao.Agendado,
  };
}
