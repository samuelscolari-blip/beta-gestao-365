# Inventário de acessos necessários

| Recurso | Finalidade | Configuração segura |
| --- | --- | --- |
| GitHub | Código, PR e Actions | Aplicativo GitHub / permissão administrativa |
| Cloudflare API token | Deploy do Worker e migrations D1 | Segredo `CLOUDFLARE_API_TOKEN` |
| Cloudflare Account ID | Seleção da conta no CI | Segredo `CLOUDFLARE_ACCOUNT_ID` |
| D1 `beta-gestao-365-db` | Dados operacionais | Binding `DB` |
| Cloudflare Access | Identidade administrativa do portal | Segredos do Worker e política da conta |
| ERP Core opcional | PostgreSQL, Redis e filas | Cofre do ambiente, quando ativado |
| Certificados A1/A3 | Integração fiscal futura | Cofre/HSM; nunca no Git |

## Identificadores não secretos

- Worker: `beta-gestao-365`
- Produção: `https://beta-gestao-365.scolarisamuel.workers.dev/`
- Banco: `beta-gestao-365-db`
- Binding: `DB`
- Repositório: `samuelscolari-blip/beta-gestao-365`

## Segredos opcionais do ERP Core

Os nomes podem ser documentados, mas os valores ficam somente no cofre:

```text
ERP_CORE_BASE_URL
ERP_CORE_CLIENT_ID
ERP_CORE_HMAC_SECRET
ERP_CORE_TENANT_ID
DATABASE_URL
REDIS_URL
PAYLOAD_ENCRYPTION_KEY_BASE64
CERTIFICATE_PFX_BASE64
CERTIFICATE_PFX_PASSWORD
```

O código-fonte pode ser copiado e arquivado; credenciais não. Qualquer segredo
exposto deve ser revogado e substituído.
