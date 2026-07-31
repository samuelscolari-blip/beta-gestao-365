# Beta ERP Core

Backend corporativo separado do portal Cloudflare. Ele não substitui o portal:
recebe operações assinadas pelo Worker, persiste dados multiempresa no
PostgreSQL e envia trabalhos pesados para workers BullMQ.

## Processos

- `main.ts`: API NestJS, validação, HMAC, idempotência e endpoints de saúde.
- `worker.ts`: consumidores independentes para folha e assinatura fiscal.
- `migrate.ts`: executor de migrações SQL com checksum imutável.
- `packages/payroll-core`: motor compartilhado com a Prévia de Folha do portal.

## Proteções implementadas

- PostgreSQL com `ENABLE/FORCE ROW LEVEL SECURITY` em todas as tabelas de
  negócio.
- `tenant_id` definido dentro de cada transação e validado como UUID.
- HMAC-SHA256 cobrindo método, rota, corpo, empresa, ator, horário e chave de
  idempotência.
- Toda escrita exige chave idempotente.
- Auditoria append-only com sequência, hash anterior, hash do evento e
  bloqueio de `UPDATE`/`DELETE`.
- Dados sensíveis e XMLs cifrados com AES-256-GCM.
- XMLDSig RSA-SHA256 com certificado A1; o próprio serviço verifica a
  assinatura antes de persistir o resultado.
- A API apenas publica trabalhos. Os processors existem somente no processo
  worker.
- Cada execução congela as entradas usadas no cálculo, impedindo que uma
  alteração cadastral durante o processamento mude o resultado do mesmo lote.
- Folha dividida em jobs filhos de até 250 colaboradores e consolidada por um
  job pai somente depois que todos os lotes terminam.
- Gravação em massa com `ON CONFLICT`, identificadores determinísticos e hashes
  por lote, permitindo retomada segura sem duplicar resultados.
- Retentativas exponenciais e limites de retenção para jobs concluídos ou
  falhos.

## Rotas

| Método | Rota | Função |
| --- | --- | --- |
| `GET` | `/health/live` | Processo API ativo; rota pública |
| `GET` | `/health/ready` | PostgreSQL, Redis e heartbeat dos workers |
| `GET` | `/v1/capabilities` | Capacidades ativas sem expor segredos |
| `GET` | `/v1/audit/integrity` | Recalcula e valida a cadeia de auditoria |
| `POST` | `/v1/payroll/runs` | Congela entradas e cria execução idempotente |
| `GET` | `/v1/payroll/runs/:id` | Status, lotes e progresso por funcionário |
| `POST` | `/v1/fiscal/events` | Armazena XML cifrado |
| `POST` | `/v1/fiscal/events/:id/sign` | Enfileira assinatura |
| `GET` | `/v1/fiscal/events/:id` | Status e hashes, sem devolver XML |
| `POST` | `/v1/migrations/d1-records` | Importa lote cifrado do D1 |

Exceto as rotas de saúde, todas exigem os cabeçalhos de serviço `x-erp-*`.

## Execução para desenvolvimento/homologação

1. Copie `.env.example` para `.env` e substitua todos os placeholders.
2. Na raiz do projeto, execute:

   ```bash
   docker compose --env-file services/erp-core/.env \
     -f infra/compose.core.yml up --build
   ```

3. Valide `GET http://localhost:8080/health/live` e
   `GET http://localhost:8080/health/ready`.

O Compose é útil para homologação. Produção deve usar PostgreSQL e Redis
gerenciados, cofre de segredos, backup, TLS, observabilidade e instâncias
independentes.

## Certificado

- `DISABLED`: assinatura indisponível, sem armazenar certificado.
- `A1_PFX`: PFX em Base64 e senha lidos do cofre do provedor. Nunca salvar o
  arquivo ou a senha no Git.
- `EXTERNAL_HSM`: reservado ao conector de HSM/agente A3. A implementação de
  comunicação com o dispositivo depende do fabricante, PKCS#11 e local onde o
  token está conectado.

Assinatura válida não equivale a transmissão oficial. A validação pelos XSDs
vigentes, ambiente restrito, procuração, envio, consulta de lote, protocolo,
recibo e tratamento de retorno compõem a etapa de homologação fiscal.

## Testes

```bash
npm test --prefix services/erp-core
```

Os testes verificam HMAC, criptografia autenticada, motor compartilhado,
controles SQL e geração/verificação de uma assinatura XML com PFX de teste.
