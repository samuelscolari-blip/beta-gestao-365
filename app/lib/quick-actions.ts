/*
 * Contrato entre as "Ações rápidas" e a tela que abre o formulário.
 *
 * Os dois lados vivem em componentes irmãos (`BetaAppV52` e `BetaApp`), sem
 * contexto em comum. O atalho precisa, portanto, atravessar a janela.
 *
 * Antes ele atravessava clicando no botão "Novo registro" do cabeçalho, achado
 * por seletor de CSS. Era funcionalidade dependendo de aparência: bastou o
 * cabeçalho de Administrativo parar de exibir o botão — e o de Máquinas deixar
 * de existir — para "Cadastrar funcionário" e "Abrir máquinas" pararem de
 * abrir a ficha, sem erro visível.
 *
 * O evento nomeado diz o que se quer (abrir o cadastro do módulo X) em vez de
 * como conseguir (clicar naquele botão ali). Quem escuta decide como atender.
 */

export const NOVO_REGISTRO_EVENTO = "beta:novo-registro";

export type NovoRegistroDetalhe = { moduleId: string };

/** Pede à tela que abra o formulário de cadastro do módulo. */
export function pedirNovoRegistro(moduleId: string) {
  window.dispatchEvent(
    new CustomEvent<NovoRegistroDetalhe>(NOVO_REGISTRO_EVENTO, {
      detail: { moduleId },
    }),
  );
}
