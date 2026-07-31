# Inventário de acessos necessários

Este documento informa tudo o que outra IA ou profissional precisa para
trabalhar no projeto. Ele não contém valores secretos.

## Acessos do sistema atual

| Recurso | Como o acesso funciona | Necessário para publicar? | Deve entrar no ZIP? |
| --- | --- | --- | --- |
| ChatGPT Sites | Sessão autenticada de proprietário ou editor | Sim | Não |
| Projeto do Site | Identificado por `.openai/hosting.json` | Sim | Sim, já incluído |
| Repositório da plataforma | Token temporário gerado durante a operação | Quando a plataforma solicitar | Não |
| Cloudflare D1 | Binding gerenciado `DB` | Sim | O nome do binding, não a credencial |
| Administrador do portal | Identidade autenticada validada no servidor | Para gravar/testar ações administrativas | Não há senha no código |
| ERP Core opcional | Variáveis de ambiente e segredos em cofre | Apenas se ativado | Somente nomes e exemplos |
| PostgreSQL/Redis opcionais | Conexões privadas em cofre | Apenas se o ERP Core for ativado | Não |
| Certificado A1/A3 | Cofre ou HSM | Apenas em integração fiscal oficial futura | Nunca |

## Identificadores não secretos incluídos

- Projeto: `appgprj_6a67cdc58ee8819180fe477f9299edf7`
- Site: `beta-gestao-365`
- Endereço: `https://beta-gestao-365.scolarisamuel.chatgpt.site`
- Binding D1: `DB`
- Versão-base: 51

Esses identificadores orientam a plataforma, mas não concedem acesso sozinhos.

## Procedimento para habilitar outra IA

### Quando a IA estiver na conta proprietária

1. Samuel entra normalmente em sua conta.
2. Abre o Site Beta Gestão 365.
3. Inicia a conversa de desenvolvimento nessa sessão.
4. Anexa este pacote e o prompt pronto.
5. Autoriza a publicação quando a plataforma solicitar.

Nenhuma senha precisa ser entregue à IA em texto.

### Quando outra pessoa for responsável

1. Samuel adiciona a conta humana dessa pessoa como editora do Site.
2. A pessoa entra com a própria conta.
3. A IA atua dentro da sessão autenticada dessa pessoa.
4. Ao encerrar o trabalho, Samuel revisa se o acesso ainda é necessário.

Não compartilhar a conta ou a senha de Samuel.

## Modelo de configuração privada

Os campos abaixo devem ser preenchidos diretamente no ambiente protegido da
hospedagem, nunca neste arquivo:

```text
ERP_CORE_BASE_URL=<configurar no ambiente>
ERP_CORE_CLIENT_ID=<configurar no ambiente>
ERP_CORE_HMAC_SECRET=<segredo no cofre>
ERP_CORE_TENANT_ID=<configurar no ambiente>

DATABASE_URL=<segredo no cofre do ERP Core>
REDIS_URL=<segredo no cofre do ERP Core>
PAYLOAD_ENCRYPTION_KEY_BASE64=<segredo no cofre>
CERTIFICATE_PFX_BASE64=<somente no cofre, quando aplicável>
CERTIFICATE_PFX_PASSWORD=<somente no cofre, quando aplicável>
```

## Por que senhas reais não acompanham o código

O código-fonte pode ser enviado, copiado e arquivado. Uma senha dentro dele
também seria copiada e não poderia mais ser controlada. Tokens da plataforma
podem expirar e devem ser gerados somente durante a publicação. A forma correta
de autorizar outra IA é conceder uma sessão de editor, mantendo a credencial
fora dos arquivos.

