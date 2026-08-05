/*
 * Folga de Campo — o descanso em casa de quem mora fora da cidade da obra.
 *
 * A cada 90 dias trabalhados, o colaborador com residência fora da cidade
 * tem direito a 9 dias corridos em casa. A empresa custeia o deslocamento:
 * passagem de ida e de volta, alimentação durante os percursos e, quando o
 * trajeto exige parada, hotel.
 *
 * NÃO É FÉRIAS, e a distinção não é formalidade: férias têm período
 * aquisitivo de 12 meses, 30 dias, terço constitucional e efeito no eSocial.
 * A Folga de Campo tem contagem própria de 90 dias, 9 dias corridos e é um
 * benefício da empresa. Somar as duas em qualquer lugar produziria número
 * errado nos dois lados, por isso este arquivo não conversa com o módulo de
 * férias nem reaproveita nada dele.
 *
 * A empresa pode COMPRAR a folga: paga o valor combinado e o colaborador
 * segue na obra. Comprar e vender são o mesmo negócio visto dos dois lados,
 * então existe uma operação só. Nesse caso não há deslocamento, e portanto
 * não há passagem, alimentação de percurso nem hotel a custear.
 */

/** Dias trabalhados que geram uma folga. */
export const DIAS_PARA_NOVA_FOLGA = 90;

/** Duração da folga, em dias corridos — inclui o primeiro e o último. */
export const DIAS_DE_FOLGA = 9;

/** Soma dias corridos a uma data ISO, sem depender do fuso do navegador. */
function somarDias(iso, dias) {
  const data = new Date(`${iso}T00:00:00Z`);
  if (Number.isNaN(data.getTime())) return "";
  data.setUTCDate(data.getUTCDate() + dias);
  return data.toISOString().slice(0, 10);
}

function dinheiro(valor) {
  const numero = Number(valor);
  return Number.isFinite(numero) && numero > 0 ? numero : 0;
}

export function calculateFieldLeave(input) {
  const avisos = [];
  const comprada = input.resolucao === "Comprada pela empresa";

  const direitoEm = input.contagemDesde
    ? somarDias(input.contagemDesde, DIAS_PARA_NOVA_FOLGA)
    : "";
  if (!direitoEm) {
    avisos.push(
      "Informe desde quando contar os 90 dias — normalmente a admissão, ou o fim da folga anterior.",
    );
  }

  /*
   * 9 dias CORRIDOS contando o primeiro: quem sai no dia 1º volta no dia 9,
   * não no 10. Somar 9 daria dez dias de folga.
   */
  const fimDaFolga = input.inicioDaFolga
    ? somarDias(input.inicioDaFolga, DIAS_DE_FOLGA - 1)
    : "";

  if (input.inicioDaFolga && direitoEm && input.inicioDaFolga < direitoEm) {
    avisos.push(
      `A folga começa antes de o direito nascer, em ${direitoEm}. Confirme a data-base da contagem.`,
    );
  }

  const linhas = [];
  let custoDeDeslocamento = 0;

  if (comprada) {
    /*
     * Sem viagem, não há o que custear. Aceitar despesa de percurso numa
     * folga comprada só produziria custo que não aconteceu.
     */
    const deslocamentoInformado =
      dinheiro(input.passagemIda) +
      dinheiro(input.passagemVolta) +
      dinheiro(input.alimentacaoIda) +
      dinheiro(input.alimentacaoVolta) +
      dinheiro(input.hotel);
    if (deslocamentoInformado > 0) {
      avisos.push(
        "Folga comprada não tem viagem: passagem, alimentação de percurso e hotel foram desconsiderados.",
      );
    }
  } else {
    const despesas = [
      ["Passagem — ida", dinheiro(input.passagemIda)],
      ["Passagem — volta", dinheiro(input.passagemVolta)],
      ["Alimentação no percurso — ida", dinheiro(input.alimentacaoIda)],
      ["Alimentação no percurso — volta", dinheiro(input.alimentacaoVolta)],
      ["Hotel", dinheiro(input.hotel)],
    ];
    for (const [rotulo, valor] of despesas) {
      if (valor > 0) {
        linhas.push({ rotulo, valor });
        custoDeDeslocamento += valor;
      }
    }
  }

  const valorDaCompra = comprada ? dinheiro(input.valorDaCompra) : 0;
  if (comprada) {
    if (valorDaCompra > 0) {
      linhas.push({ rotulo: "Compra da folga", valor: valorDaCompra });
    } else {
      avisos.push("Informe o valor pago pela compra da folga.");
    }
    /*
     * A natureza tributária deste valor não é decidida aqui, e não é por
     * omissão: ela depende de enquadramento contábil que o sistema não tem
     * como inferir. O motor entrega o valor e o aviso; quem lança na folha
     * decide, com a contabilidade, se compõe base de INSS e IRRF.
     */
    avisos.push(
      "Confirme com a contabilidade se o valor da compra entra na base de INSS e IRRF antes de lançar na folha.",
    );
  }

  /*
   * A próxima contagem começa quando o colaborador volta. Na folga comprada
   * ele nunca sai, então a contagem recomeça na data em que o direito
   * nasceu — senão comprar a folga adiaria a folga seguinte, punindo quem
   * ficou.
   */
  const proximaContagemDesde = comprada
    ? direitoEm
    : fimDaFolga || direitoEm;

  return {
    direitoEm,
    fimDaFolga,
    proximaContagemDesde,
    custoDeDeslocamento,
    custoTotal: custoDeDeslocamento + valorDaCompra,
    linhas,
    avisos,
  };
}

/**
 * Diz se o colaborador tem direito à Folga de Campo.
 *
 * A resposta vem da marcação explícita no cadastro, e não de comparar a
 * cidade dele com a da obra: cidade é texto digitado à mão, e "Feira de
 * Santana" contra "feira de santana - BA" já bastaria para negar o direito
 * a quem tem.
 */
export function temDireitoAFolgaDeCampo(cadastro) {
  return String(cadastro.livesOutOfTown ?? "").trim() === "Sim";
}
