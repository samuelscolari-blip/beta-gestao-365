# Checklist de publicação no Site existente

## Antes de alterar

- [ ] Confirmar que o Site é Beta Gestão 365.
- [ ] Confirmar o projeto `appgprj_6a67cdc58ee8819180fe477f9299edf7`.
- [ ] Confirmar o endereço público atual.
- [ ] Confirmar `.openai/hosting.json` com o binding D1 `DB`.
- [ ] Abrir o projeto existente; não criar outro Site.
- [ ] Ler o pedido completo e os arquivos afetados.
- [ ] Confirmar que a sessão pertence ao proprietário ou a um editor autorizado.

## Durante a implementação

- [ ] Preservar dados e compatibilidade com registros históricos.
- [ ] Não alterar o administrador operacional sem solicitação.
- [ ] Não inserir senhas, tokens, certificados ou dados reais no código.
- [ ] Não editar migrations já aplicadas.
- [ ] Criar migration nova e aditiva quando o esquema realmente precisar mudar.
- [ ] Manter o módulo de Terceiros operacional oculto.
- [ ] Manter códigos internos ocultos por padrão.
- [ ] Manter o Passo a passo da obra.
- [ ] Manter os três estados oficiais de Compras.
- [ ] Separar exemplos fictícios de registros reais.

## Validação obrigatória

- [ ] Executar `npm run lint`.
- [ ] Executar `npm test`.
- [ ] Confirmar build e validação do artefato.
- [ ] Conferir que todos os testes passaram.
- [ ] Verificar visualmente desktop e celular nas telas alteradas.
- [ ] Testar visitante sem gravação.
- [ ] Testar administrador nas ações modificadas.
- [ ] Conferir que o banco e os registros existentes continuam acessíveis.
- [ ] Revisar a alteração para impedir vazamento de credenciais e dados.

## Publicação

- [ ] Registrar resumidamente o que foi alterado.
- [ ] Salvar uma nova versão imutável do mesmo projeto.
- [ ] Publicar somente a versão validada.
- [ ] Acompanhar a publicação até `succeeded`.
- [ ] Confirmar a URL retornada pela plataforma.

## Depois da publicação

- [ ] Abrir `https://beta-gestao-365.scolarisamuel.chatgpt.site`.
- [ ] Conferir as funções alteradas.
- [ ] Confirmar que não surgiu novamente nenhum código interno.
- [ ] Confirmar que Terceiros permanece oculto.
- [ ] Confirmar que Compras mantém apenas os três estados definidos.
- [ ] Registrar o número da nova versão e o resultado dos testes.
- [ ] Se houver erro, não apagar dados; corrigir ou voltar para versão anterior.

