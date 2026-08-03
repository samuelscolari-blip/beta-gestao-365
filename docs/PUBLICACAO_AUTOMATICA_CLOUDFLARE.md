# Publicação automática na Cloudflare

## Regra permanente

Toda alteração do Beta Gestão 365 deve ser desenvolvida em uma branch, validada por pull request e integrada à `main` somente após os testes.

A publicação de produção possui três gatilhos redundantes:

1. `push` na branch `main`;
2. fechamento de pull request efetivamente mesclada na `main`;
3. acionamento manual `workflow_dispatch` para recuperação autorizada.

## Proteções

O workflow de produção:

- aceita PR somente do próprio repositório;
- baixa exatamente o commit de destino;
- confirma que o checkout corresponde ao SHA esperado;
- executa lint, build e a suíte completa de testes;
- aplica apenas migrations aditivas no D1;
- publica por `wrangler deploy` com segredos protegidos;
- grava `deployment-version.txt` com o commit publicado;
- consulta o endereço público e falha se a Cloudflare não estiver servindo exatamente esse commit;
- executa diagnóstico em navegador real após a publicação.

## Como acompanhar

No GitHub, abra **Actions → Publicar no Cloudflare**. A execução somente é considerada concluída quando as etapas de publicação, confirmação do commit e diagnóstico real estiverem verdes.

Na Cloudflare, abra **Workers e Pages → beta-gestao-365 → Implantações**. O ID ativo deve ter 100% do tráfego. O histórico visual da integração Git pode atrasar, por isso o commit servido em `/deployment-version.txt` é a confirmação técnica definitiva.

## Regra para agentes e outras IAs

Não realizar implementações diretamente na `main`. Não encerrar uma tarefa somente porque o merge foi concluído. A entrega termina apenas depois da confirmação do commit publicado no Worker e do fechamento da PR.
