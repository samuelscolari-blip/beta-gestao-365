# Checklist de publicação no Cloudflare

## Preparação

- [ ] Confirmar repositório `samuelscolari-blip/beta-gestao-365`.
- [ ] Confirmar Worker `beta-gestao-365`.
- [ ] Confirmar D1 `beta-gestao-365-db` com binding `DB`.
- [ ] Confirmar que `.openai/hosting.json` não existe.
- [ ] Confirmar ausência de referências ao domínio `chatgpt.site`.
- [ ] Trabalhar em branch separada.

## Implementação

- [ ] Preservar dados e compatibilidade histórica.
- [ ] Não editar migrations aplicadas.
- [ ] Criar migration nova e aditiva quando necessário.
- [ ] Manter autorização de mutações no servidor.
- [ ] Não inserir senhas, tokens ou dados reais no Git.
- [ ] Preservar as regras funcionais documentadas em `AGENTS.md`.

## Validação

- [ ] Executar `npm run lint`.
- [ ] Executar `npm test`.
- [ ] Validar o artefato Cloudflare e o binding D1.
- [ ] Verificar visualmente desktop e celular.
- [ ] Testar visitante somente leitura.
- [ ] Testar ações administrativas em ambiente autorizado.
- [ ] Revisar a migration antes de aplicá-la.

## Publicação

- [ ] Abrir PR para `main`.
- [ ] Confirmar o CI da PR.
- [ ] Integrar somente a versão validada.
- [ ] Acompanhar `Publicar no Cloudflare` até sucesso.
- [ ] Confirmar a migration remota.
- [ ] Confirmar HTTP 200 em
  `https://beta-gestao-365.scolarisamuel.workers.dev/`.
- [ ] Confirmar que nenhuma publicação ocorreu no domínio aposentado.

## Falha e retorno

- [ ] Não apagar dados.
- [ ] Não recriar o D1.
- [ ] Registrar o erro e corrigir em novo commit.
- [ ] Reverter o Worker para commit validado quando necessário.
