# Credenciais e permissões

## O que já existe

- O Site está publicado para consulta pública.
- A propriedade e a edição do projeto são controladas separadamente.
- Samuel Scolari é o proprietário do projeto.
- O banco D1 é injetado pela plataforma através do binding `DB`.
- O administrador operacional do sistema é validado no servidor pelo arquivo
  `app/lib/server-access.ts`.

Publicar o Site e administrar registros dentro do sistema são permissões
diferentes.

## O que outra IA precisa para publicar

1. O código-fonte deste pacote.
2. Uma sessão autenticada de proprietário ou editor do Site.
3. Acesso às ferramentas de edição e publicação do ChatGPT Sites.
4. O projeto e o binding preservados em `.openai/hosting.json`.
5. Autorização do proprietário para a publicação em produção.

A solicitação que originou este pacote registra a autorização de continuidade,
mas a plataforma pode pedir uma confirmação adicional em uma nova sessão.

## Como conceder acesso a outra pessoa

O proprietário deve adicionar a conta humana do responsável como editora do
Site. Essa conta precisa pertencer ao mesmo workspace compatível. A IA trabalhará
dentro da sessão autenticada desse editor.

Não é possível adicionar uma "IA genérica" como editora sem uma conta humana
autenticada. Também não é seguro fornecer a senha de Samuel para outra pessoa
ou ferramenta.

## Itens que nunca devem ser colocados no ZIP

- senha do ChatGPT;
- cookies de sessão;
- token temporário do repositório;
- tokens de implantação;
- chaves de API;
- segredo HMAC;
- chave de criptografia;
- conexão real do PostgreSQL;
- conexão real do Redis;
- certificado A1, senha do certificado ou material de A3/HSM;
- backup ou exportação de dados reais.

## Variáveis opcionais

O portal pode trabalhar apenas com D1. A integração opcional com o ERP Core usa:

- `ERP_CORE_BASE_URL`
- `ERP_CORE_CLIENT_ID`
- `ERP_CORE_HMAC_SECRET`
- `ERP_CORE_TENANT_ID`

O ERP Core usa as variáveis documentadas em
`services/erp-core/.env.example`. Valores reais devem ser cadastrados
diretamente no ambiente de hospedagem ou cofre, nunca gravados neste pacote.

## Permissões mínimas recomendadas

Para outra pessoa ajudar, conceda somente o papel de editor do Site. Não
transfira a propriedade e não amplie o acesso administrativo do sistema. A
remoção do editor deve ser feita ao final do trabalho, se o acesso deixar de ser
necessário.

