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

## Regras do produto

- Códigos internos permanecem ocultos por padrão.
- Terceiros operacional permanece oculto sem apagar o histórico.
- Passo a passo da obra permanece presente.
- Índice geral da obra permanece distinto do avanço físico.
- Compras usa somente `Aguardando análise`, `Aprovado` e `Reprovado`.
- Exemplos fictícios nunca entram em filas, totais ou decisões reais.
- Visitantes são somente leitura; gravações exigem autorização no servidor.
- IBS/CBS não é desconto de folha.
- Rescisões são prévias e não transmitem eventos oficiais ao eSocial.

Não enfraqueça essas regras sem solicitação expressa de Samuel Scolari.
