# Instruções para agentes de desenvolvimento

Leia `00_LEIA-ME_PRIMEIRO.md` e `01_GUIA_PARA_OUTRA_IA_PUBLICAR.md` antes de
alterar ou publicar o projeto.

## Produção oficial

- Repositório: `samuelscolari-blip/beta-gestao-365`
- Branch de produção: `main`
- Worker: `beta-gestao-365`
- URL única: `https://beta-gestao-365.scolarisamuel.workers.dev/`
- Banco: Cloudflare D1 `beta-gestao-365-db`
- Binding: `DB`

O domínio `chatgpt.site` e o ChatGPT Sites foram aposentados por decisão
expressa de Samuel Scolari. Não recrie `.openai/hosting.json`, não use o antigo
projeto Sites e não publique versões naquele domínio.

## Fluxo obrigatório

1. Trabalhe em branch separada e preserve alterações não relacionadas.
2. Implemente autorização no servidor para toda mutação.
3. Mantenha segredos fora do código e dos commits.
4. Evolua o D1 somente com migrations aditivas; nunca apague ou recrie o banco.
5. Execute `npm run lint` e `npm test`.
6. Revise visualmente as telas alteradas.
7. Abra PR para `main`; a publicação ocorre pelo GitHub Actions.
8. O workflow aplica migrations e publica somente no Worker oficial.
9. Confirme HTTP 200 no endereço `workers.dev` antes de informar sucesso.

## Camadas de CSS (`app/vNN-*.css`)

O visual do app é construído por ~30 arquivos `vNN-*.css`, importados em
ordem estrita em `app/layout.tsx`, quase todos usando `!important`. Cada
arquivo novo pode empatar em especificidade com um arquivo antigo que já
estiliza o mesmo elemento — quem vence então é decidido por detalhes (ordem
de carga, um seletor com uma classe a mais, um `:has()` que não casa no DOM
real) fáceis de errar sem verificar antes. Nesta mesma sessão isso já causou
pelo menos 4 bugs visuais reais (`.module-heading` disputado por `app/v52.css`,
`app/v93-financial-header-approved.css`, `app/v94-global-header-standard.css`
e `app/v105-force-executive-module-format.css` ao mesmo tempo).

**Antes de escrever ou editar uma regra CSS para um seletor/classe que já
existe no app** (ex.: `.module-heading`, `.v52-module-strip`, `.page-area`,
`.management-center`, `.module-heading h1`):

1. Rode `grep -rn "<seletor>" app/*.css` para ver quais arquivos `vNN-*.css`
   já tocam esse seletor, e leia cada um — não assuma que o seu arquivo é o
   único.
2. Se mais de um arquivo define a mesma propriedade (`color`, `background`,
   `font-weight` etc.) para o mesmo elemento, calcule a especificidade e a
   ordem de carga em `app/layout.tsx` antes de decidir onde a mudança entra;
   quando possível, faça a condição ficar mutuamente exclusiva (ex.:
   `:not([data-attr="true"])` de um lado e `[data-attr="true"]` do outro) em
   vez de torcer para que a sua regra vença por especificidade.
3. Desconfie de `:has()` para decidir estado (ex.: "esta tela está em modo
   X"): se o elemento observado pelo `:has()` é renderizado por um componente
   React diferente do elemento que recebe a classe, pode não existir relação
   de descendência real no DOM mesmo que apareça visualmente no lugar certo.
   Prefira expor o estado como um `data-*` atributo vindo do React (o
   componente já sabe a resposta) a adivinhar pela presença de outro
   elemento na árvore.
4. Depois da mudança, verifique visualmente a tela alterada E pelo menos uma
   tela "vizinha" que compartilha a mesma classe/seletor (para não repetir o
   caso do V105 que vazou para Admin/Manual/Regime Tributário).

## Regras do produto

- Códigos internos permanecem ocultos por padrão.
- Terceiros (contractors) foi removido do sistema por decisão de Samuel Scolari; não recrie esse módulo.
- Passo a passo da obra permanece presente.
- Índice geral da obra permanece distinto do avanço físico.
- Compras usa somente `Aguardando análise`, `Aprovado` e `Reprovado`.
- Exemplos fictícios nunca entram em filas, totais ou decisões reais.
- Visitantes são somente leitura; gravações exigem autorização no servidor.
- IBS/CBS não é desconto de folha.
- Rescisões são prévias e não transmitem eventos oficiais ao eSocial.

Não enfraqueça essas regras sem solicitação expressa de Samuel Scolari.
