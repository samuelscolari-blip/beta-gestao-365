# Auditoria da sequência de códigos pós-produção — V76

Este documento registra a revisão da sequência de códigos sugerida após a auditoria do site publicado. O objetivo é preservar o raciocínio, evitar reaplicar correções já existentes e impedir que exemplos com dados fixos substituam componentes funcionais do sistema.

## 1. Substituição completa da função `Dashboard`

**Problema que pretendia resolver:** área branca excessiva, blocos escuros fragmentados, timeline apertada e valores quebrados.

**Revisão:** não foi aplicada literalmente.

**Motivos:**

- o exemplo possuía valores fixos, como 18%, 25%, 90% e cinco dias;
- utilizava componentes assumidos (`TimelineStepCompleted`, `TimelineStepPending`, `CostChartMap` e `FleetTable`) que não correspondem necessariamente à árvore atual;
- misturava classes utilitárias com os estilos próprios do projeto;
- substituiria ações, dados, permissões e cálculos que já funcionam no componente real.

**Solução adotada:** preservar o Dashboard real e corrigir sua composição por uma camada CSS carregada por último (`app/v74-production-audit.css`).

## 2. Painel executivo em uma superfície escura contínua

**Problema:** o painel da obra continuava herdando um contêiner externo branco, embora seus cartões internos fossem escuros.

**Trecho aproveitado:** a intenção de usar uma área única, escura e com largura total.

**Solução aplicada:** `.construction-executive.construction-executive-v2` recebeu gradiente escuro contínuo, borda, espaçamento, largura editorial e sombra próprios na V74.

## 3. Linha do tempo preenchendo a largura útil

**Problema:** etapas futuras ficavam comprimidas ou cortadas.

**Trecho aproveitado:** organização modular das etapas.

**Adaptação:** em vez de criar novos componentes com dados fixos, a timeline real passou a usar `display: grid` com dez colunas, cinco em largura intermediária e duas no celular.

## 4. Indicadores e valores financeiros sem quebra

**Problema:** valores como `R$ 1.910.000,00` apareciam em duas linhas ou eram cortados.

**Trecho aproveitado:** cards separados e leitura numérica de destaque.

**Solução aplicada:** `white-space: nowrap`, `font-variant-numeric: tabular-nums`, tamanhos responsivos por container query e tratamento específico do quarto KPI.

## 5. Contraste do estado vazio da frota

**Problema:** o fundo escuro da frota mantinha textos herdados em tons escuros, derrubando o contraste.

**Trecho aproveitado:** integralmente quanto à intenção de cores claras.

**Solução final:** título branco, descrição `#b9d8e3`, selo ciano, botão legível e foco visível. A correção foi ampliada para cobrir `strong`, `h3`, `h4`, `p`, `span` e botão.

## 6. Falso positivo do contraste quando não existe linha de frota

**Problema:** `fleetContrast` retornava zero no estado vazio e o diagnóstico derrubava a esteira.

**Trecho aproveitado:** integralmente.

**Solução aplicada:** o contraste só é comparado quando `state.layout?.fleetRow` existe.

## 7. Cache transitório de CSS após deploy

**Problema:** o HTML antigo podia apontar por alguns segundos para um CSS já removido do conjunto de assets.

**Situação na `main`:** já resolvido pela implementação da antiga PR #33.

**Proteções preservadas:**

- inventário das folhas de estilo e verificação de `link.sheet`;
- apenas uma nova navegação com `__beta_diagnostic`;
- falha explícita quando o CSS permanece ausente.

Nenhum código duplicado foi acrescentado.

## 8. Limpeza do perfil do Chrome com retry

**Problema:** `EBUSY`, `ENOTEMPTY` ou `EPERM` podiam falhar no encerramento do diagnóstico.

**Situação na `main`:** já resolvido por `removeDirectoryWithRetry` com tentativas graduais.

Nenhum segundo mecanismo de retry foi criado.

## 9. Fontes Geist retornando 404 na Cloudflare

**Problema encontrado pela auditoria, não pelo exemplo inicial:** o build solicitava arquivos internos `.vinext/fonts` inexistentes.

**Solução aplicada:** remoção do `next/font/google` do layout e adoção de pilha tipográfica local (`Inter`, fontes do sistema e `Segoe UI`).

## 10. Dados fictícios desaparecendo da Central e dos Aprovados

**Problema:** as abas normais já exibiam dados fictícios, mas três filtros removiam esses registros da Central e das listas de Aprovados.

**Solução aplicada na V75:**

- remoção do filtro `isRealManagementRequest`;
- remoção de `isRealRecord` no administrador e no modo público;
- manutenção do banner de ambiente de testes;
- rodapé com Registros na fila, Dados de teste, Integridade e Valor total.

## 11. Regra para futuras sequências de código

Antes de aplicar qualquer bloco semelhante:

1. localizar o componente e o estilo reais na `main`;
2. verificar se a correção já existe em versão posterior;
3. rejeitar dados fixos e imports assumidos;
4. adaptar a intenção ao fluxo real, sem substituir permissões ou cálculos;
5. adicionar regressão automatizada;
6. validar build, testes e prévia publicada;
7. manter a PR com apenas arquivos definitivos.

## Resultado

A sequência forneceu boas intenções visuais e duas correções cirúrgicas corretas. O Dashboard completo não foi copiado, porque criaria regressão funcional. As partes úteis foram adaptadas ao sistema real nas V74 e V75; os itens já presentes na `main` foram apenas protegidos por novos testes na V76.
