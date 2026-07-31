# Beta Gestão 365 — código-fonte atualizado

Este pacote contém o código-fonte completo correspondente à versão 51 publicada
do sistema Beta Gestão 365, preparado para continuidade por outro profissional
ou por outra IA autorizada por Samuel Scolari.

## Identificação da versão

- Sistema: Beta Gestão 365 / Beta Construtora
- Site atual: https://beta-gestao-365.scolarisamuel.chatgpt.site
- Site de destino: `beta-gestao-365`
- Versão publicada: 51
- Commit da versão: `e304021c25cdf5be679daa441c085cad5aa4269d`
- Projeto existente: `appgprj_6a67cdc58ee8819180fe477f9299edf7`
- Banco operacional: Cloudflare D1, binding lógico `DB`
- Administrador operacional do sistema: permanece o usuário definido em
  `app/lib/server-access.ts`

## Regra mais importante

Este pacote deve ser usado para editar o projeto existente. Não crie outro
Site, não substitua o identificador do projeto, não remova o binding `DB` e não
troque o banco. Essas ações separariam o código dos dados atuais da empresa.

O arquivo `.openai/hosting.json` já contém a identidade correta do projeto e
deve ser preservado.

## O que está incluído

- Aplicação web em Next.js/Vinext;
- APIs do portal;
- integração com Cloudflare D1;
- todas as migrations existentes;
- motores de folha, rescisão, IBS/CBS e métricas de obra;
- testes automatizados;
- infraestrutura opcional do ERP Core;
- arquivos de configuração e dependências travadas;
- documentação para outra IA implementar e publicar com segurança.

## O que não está incluído

- senhas, tokens, cookies ou chaves privadas;
- conteúdo do banco de produção;
- certificados A1/A3;
- arquivos `.env` reais;
- `node_modules`, builds e caches;
- histórico interno do Git.

Esses itens foram excluídos de propósito. As credenciais devem permanecer nos
controles de acesso e cofres da plataforma.

## Ordem recomendada de leitura

1. `01_GUIA_PARA_OUTRA_IA_PUBLICAR.md`
2. `02_AUTORIZACAO_DE_CONTINUIDADE_E_PUBLICACAO.md`
3. `03_MAPA_TECNICO_DO_PROJETO.md`
4. `04_CHECKLIST_DE_PUBLICACAO.md`
5. `05_CREDENCIAIS_E_PERMISSOES.md`
6. `06_RESUMO_DA_VERSAO_51.md`
7. `07_INVENTARIO_DE_ACESSOS_NECESSARIOS.md`
8. `PROMPT_PRONTO_PARA_OUTRA_IA.txt`

## Validação desta entrega

Antes da geração deste pacote foram executados:

- lint sem erros;
- build de produção concluído;
- validação do artefato de hospedagem;
- 39 testes automatizados aprovados.
