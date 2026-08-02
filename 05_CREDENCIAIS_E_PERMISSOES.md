# Credenciais e permissões

## Publicação

O GitHub Actions publica no Cloudflare usando dois segredos criptografados do
repositório:

- `CLOUDFLARE_API_TOKEN`
- `CLOUDFLARE_ACCOUNT_ID`

O token deve ter, no mínimo, acesso de edição aos Workers Scripts e ao D1 da
conta correta, além de leitura das configurações da conta. O valor nunca deve
ser exibido em conversa, commit, arquivo ou log.

## Banco

O Worker recebe o D1 pelo binding `DB` definido em `wrangler.jsonc`. O ID do
banco não é uma senha, mas não substitui o token de implantação.

## Administração do portal

Publicar o Worker e administrar registros dentro do sistema são permissões
diferentes. As gravações do portal exigem uma identidade validada no servidor.
Quando Cloudflare Access estiver habilitado, `TEAM_DOMAIN` e `POLICY_AUD` devem
ser configurados como segredos do Worker, nunca no Git.

## Itens proibidos no repositório

- tokens e chaves de API;
- senhas e cookies;
- certificados A1/A3 e respectivas senhas;
- conexões reais do PostgreSQL ou Redis;
- backups e exportações de dados reais;
- arquivos `.env` de produção.

Um token exposto deve ser revogado imediatamente, substituído no cofre e nunca
reutilizado.
