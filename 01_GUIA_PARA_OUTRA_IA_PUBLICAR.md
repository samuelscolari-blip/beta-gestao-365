# Guia para outra IA implementar e publicar

## Objetivo

Permitir que outra IA continue o desenvolvimento do Beta Gestão 365 e publique
novas versões no mesmo Site, mantendo o endereço e os dados atuais.

## Contrato obrigatório de continuidade

A IA responsável deve:

1. trabalhar somente no projeto existente
   `appgprj_6a67cdc58ee8819180fe477f9299edf7`;
2. preservar `.openai/hosting.json`;
3. preservar o binding D1 `DB`;
4. preservar o endereço
   `https://beta-gestao-365.scolarisamuel.chatgpt.site`;
5. manter as migrations existentes e usar somente migrations aditivas e
   revisadas para evoluções futuras;
6. nunca apagar ou recriar o banco como forma de corrigir código;
7. não incluir credenciais no código, em arquivos, conversas, commits ou ZIPs;
8. validar lint, build e testes antes de publicar;
9. criar uma nova versão imutável e publicar essa versão no mesmo Site;
10. verificar o resultado final da publicação antes de informar sucesso.

## Como outra IA obtém capacidade real de publicação

Uma IA não recebe uma identidade própria no Site. Ela publica usando uma sessão
autenticada de um usuário humano que seja proprietário ou editor do projeto.

### Cenário A — outra conversa ou outra IA na conta de Samuel

Esse é o caminho mais simples. Abra o projeto pela conta proprietária, anexe
este pacote e use o prompt fornecido em `PROMPT_PRONTO_PARA_OUTRA_IA.txt`.
A sessão autenticada da conta proprietária fornece a autorização técnica.

### Cenário B — outro usuário do mesmo workspace

O proprietário deve adicionar a conta humana desse responsável como editora do
Site. Depois disso, a IA pode atuar dentro da sessão autenticada desse editor.
O acesso público ao endereço do sistema não concede permissão de edição.

### Cenário C — IA ou desenvolvedor fora do ChatGPT Sites

Pode alterar e testar o código localmente, mas não conseguirá publicar
diretamente no ChatGPT Sites sem uma sessão autorizada e as ferramentas de
hospedagem compatíveis. Nesse caso, deverá devolver um ZIP ou uma alteração
revisável para que Samuel, ou um editor autorizado, realize a publicação.

Nunca compartilhe a senha da conta proprietária. Nunca coloque um token de
publicação dentro deste pacote. Credenciais temporárias de repositório devem ser
geradas pela plataforma apenas no momento da operação e descartadas depois.

## Preparação local

Requisitos:

- Node.js 22.13 ou superior;
- npm;
- ambiente Linux para executar os scripts de build exatamente como fornecidos.

Comandos de validação:

```bash
npm ci
npm run lint
npm test
```

`npm test` executa o build, valida o artefato da plataforma e roda os testes do
portal. O serviço opcional em `services/erp-core` possui dependências e testes
próprios.

## Fluxo de edição no ChatGPT Sites

1. Abrir o Site existente Beta Gestão 365.
2. Confirmar que o projeto carregado possui o identificador registrado em
   `.openai/hosting.json`.
3. Usar o modo de edição do projeto existente. Não usar o fluxo de criação.
4. Instalar as dependências pelo lockfile.
5. Ler os arquivos relacionados ao pedido antes de alterar.
6. Implementar a menor mudança coerente que atenda ao pedido.
7. Verificar se nenhuma alteração não relacionada foi incluída.
8. Executar lint e todos os testes.
9. Verificar visualmente as telas afetadas e as permissões de visitante e
   administrador.
10. Salvar uma nova versão imutável.
11. Publicar essa versão no mesmo Site.
12. Acompanhar a publicação até o estado final de sucesso.
13. Abrir o endereço público e confirmar as funções modificadas.

## Publicação com dados existentes

O banco D1 não faz parte do ZIP. Ele é conectado automaticamente quando o
projeto e o binding `DB` são preservados. Portanto:

- não criar um novo projeto para "testar";
- não mudar `DB` para outro nome;
- não substituir migrations antigas;
- não usar comandos destrutivos no banco;
- fazer novas mudanças de esquema por migrations aditivas;
- manter compatibilidade com registros históricos;
- antes de qualquer migração sensível, preparar backup e retorno.

## Variáveis de produção

As variáveis de produção são configuradas na hospedagem, não no código. O
portal funciona com D1 mesmo sem o ERP Core opcional. Para ativar o ERP Core,
consulte `infra/README.md`, `services/erp-core/.env.example` e
`portal.env.example`.

Os valores reais de segredos não devem ser solicitados em conversa. O
proprietário ou responsável de infraestrutura deve configurá-los diretamente
no cofre da plataforma.

## Reversão

Se a nova versão falhar:

1. interromper novas alterações;
2. registrar o erro;
3. não apagar dados;
4. corrigir o código e gerar outra versão; ou
5. republicar uma versão anterior já salva, quando a plataforma permitir.

Uma versão falha nunca deve ser "consertada" recriando o Site ou o banco.

