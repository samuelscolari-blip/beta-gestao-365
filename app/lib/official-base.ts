/*
 * O Beta Gestão 365 entrou em operação com dados oficiais da Beta
 * Construtora.
 *
 * A partir desta versão, a aplicação não pode voltar a misturar registros
 * fictícios com pessoas, valores, totais ou decisões reais. Os exemplos
 * continuam identificados pela origem de demonstração no banco, mas deixam de
 * ser semeados e são excluídos de todos os caminhos de leitura por
 * `db/records.ts`.
 *
 * A constante explícita evita que uma configuração antiga — por exemplo, o
 * valor "Não" gravado durante os testes — faça os dez "Colaborador Teste"
 * reaparecerem depois de uma publicação ou recarga.
 */

/** Campo legado da tela de configurações. Mantido para compatibilidade. */
export const CAMPO_BASE_OFICIAL = "officialBase";

/**
 * Decisão operacional vigente da Beta Construtora.
 *
 * Alterar isto exige uma mudança de código revisada. Uma demonstração futura
 * deve usar ambiente ou base separados, nunca reabrir dados fictícios dentro
 * da operação oficial.
 */
export const BASE_OFICIAL_FORCADA = true;

/**
 * Informa se a consulta deve operar como base oficial.
 *
 * O parâmetro permanece para compatibilidade com os pontos que leem o registro
 * `settings`, mas uma configuração antiga não pode mais reativar a
 * demonstração dentro da base operacional.
 */
export function baseEhOficial(
  _payload: Record<string, unknown> | null | undefined,
) {
  return BASE_OFICIAL_FORCADA;
}
