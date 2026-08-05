/*
 * Tipos da Folga de Campo.
 *
 * A regra mora em `field-leave.mjs`, em JavaScript puro, seguindo o mesmo
 * padrão de `ibs-cbs.js`: assim os testes a carregam direto com
 * `node --test`, sem passo de compilação, e o que roda no teste é
 * exatamente o que roda em produção.
 */

/** Dias trabalhados que geram uma folga. */
export const DIAS_PARA_NOVA_FOLGA: 90;

/** Duração da folga, em dias corridos — inclui o primeiro e o último. */
export const DIAS_DE_FOLGA: 9;

/**
 * Se o valor pago pela compra compõe base de INSS e IRRF.
 *
 * Definição de Samuel Scolari, tomada em 2026-08: NÃO compõe. Não é uma
 * conclusão fiscal do sistema, e por isso mora numa constante só, fácil de
 * revisar quando a contabilidade se pronunciar.
 */
export const COMPRA_COMPOE_BASE_DE_IMPOSTOS: boolean;

export type FieldLeaveResolution = "Folga concedida" | "Comprada pela empresa";

export type FieldLeaveInput = {
  /** Marco inicial da contagem: admissão, ou o fim da folga anterior. */
  contagemDesde: string;
  /** Primeiro dia da folga. Vazio enquanto a folga só está prevista. */
  inicioDaFolga?: string;
  resolucao?: FieldLeaveResolution;
  /** Valor pago quando a empresa compra a folga em vez de concedê-la. */
  valorDaCompra?: number;
  passagemIda?: number;
  passagemVolta?: number;
  alimentacaoIda?: number;
  alimentacaoVolta?: number;
  hotel?: number;
};

export type FieldLeaveResult = {
  /** Se o valor da compra deve ser lançado na folha como verba tributável. */
  compraIncideNaFolha: boolean;
  /** Data em que o direito nasce: 90 dias após o marco inicial. */
  direitoEm: string;
  /** Último dia da folga, quando há data de início. */
  fimDaFolga: string;
  /** Marco inicial da PRÓXIMA contagem. */
  proximaContagemDesde: string;
  custoDeDeslocamento: number;
  custoTotal: number;
  /** Verbas que compõem o custo, para a memória de cálculo da tela. */
  linhas: { rotulo: string; valor: number }[];
  avisos: string[];
};

export function calculateFieldLeave(input: FieldLeaveInput): FieldLeaveResult;

/**
 * Diz se o colaborador tem direito à Folga de Campo, a partir da marcação
 * explícita do cadastro — nunca comparando o texto da cidade.
 */
export function temDireitoAFolgaDeCampo(
  cadastro: Record<string, unknown>,
): boolean;
