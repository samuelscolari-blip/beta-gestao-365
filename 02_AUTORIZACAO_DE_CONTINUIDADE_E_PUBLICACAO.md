# Autorização de continuidade e publicação

Por solicitação expressa de Samuel Scolari, o desenvolvimento do Beta Gestão
365 está autorizado no repositório abaixo e pode ser publicado após validação:

- Repositório: `samuelscolari-blip/beta-gestao-365`
- Produção: `https://beta-gestao-365.scolarisamuel.workers.dev/`
- Worker: `beta-gestao-365`
- Banco: Cloudflare D1 `beta-gestao-365-db`, binding `DB`

O domínio `chatgpt.site` foi aposentado e não está autorizado para novas
publicações.

## Limites

Esta autorização não permite compartilhar credenciais, apagar ou recriar o
banco, aplicar migrations destrutivas, expor dados pessoais ou financeiros,
trocar o administrador operacional ou ampliar permissões sem nova solicitação.

As credenciais de publicação devem permanecer em segredos criptografados do
GitHub Actions ou no cofre do Cloudflare. Este documento não funciona como
senha ou token.

Toda versão deve passar por lint, build, testes, revisão das migrations e
verificação do endereço oficial antes de ser considerada publicada.
