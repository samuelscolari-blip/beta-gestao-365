/*
 * O interruptor que separa demonstração de operação.
 *
 * Enquanto o sistema é apresentado, ele precisa parecer cheio: dez
 * colaboradores, obras em andamento, máquinas paradas. Enquanto ele OPERA,
 * precisa do contrário — nada fictício em lista, em total ou em decisão.
 *
 * São dois comportamentos incompatíveis, e a escolha entre eles não é
 * técnica: é do administrador, que sabe o dia em que a base deixou de ser
 * ensaio. Por isso mora na configuração do sistema, e não numa variável de
 * ambiente: virar a chave é uma decisão de negócio, tomada dentro da tela,
 * sem publicação e sem entrar no painel da Cloudflare.
 *
 * O que a chave faz, quando ligada:
 *
 *   - a semeadura de exemplos para de repor o que for apagado;
 *   - os registros fictícios somem das listas e dos totais;
 *   - nome e salário de funcionário deixam de aparecer para quem não entrou
 *     com conta autorizada.
 *
 * O que ela NÃO faz: apagar nada. Os exemplos continuam no banco, apenas
 * fora do caminho. Desligar a chave devolve tudo — o que importa no dia em
 * que for preciso demonstrar o sistema de novo, para um cliente novo, sem
 * expor a operação real.
 */

/** Campo, dentro do registro `settings`, que guarda a escolha. */
export const CAMPO_BASE_OFICIAL = "officialBase";

/**
 * Lê a escolha a partir do payload do registro `settings`.
 *
 * Ausente ou qualquer coisa diferente de "Sim" significa demonstração. O
 * padrão é o modo permissivo de propósito: um sistema que se fecha sozinho
 * por causa de configuração faltando é pior de diagnosticar do que um que
 * continua abrindo.
 */
export function baseEhOficial(payload: Record<string, unknown> | null | undefined) {
  return String(payload?.[CAMPO_BASE_OFICIAL] ?? "").trim() === "Sim";
}
