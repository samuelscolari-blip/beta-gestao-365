from pathlib import Path

component_path = Path("app/components/BetaApp.tsx")
layout_path = Path("app/layout.tsx")
legacy_style_path = Path("app/construction-v55.css")

source = component_path.read_text(encoding="utf-8")
start_marker = '      <section className={`construction-project-command ${riskTone}`}>'
end_marker = '      <div className="construction-decision-grid">'

start_count = source.count(start_marker)
end_count = source.count(end_marker)
if start_count != 1:
    raise RuntimeError(f"Marcador inicial esperado uma vez; encontrado {start_count}.")
if end_count != 1:
    raise RuntimeError(f"Marcador final esperado uma vez; encontrado {end_count}.")

start = source.index(start_marker)
end = source.index(end_marker, start)

replacement = '''      <section
        className="construction-dashboard-v56"
        aria-label="Resumo executivo da obra"
      >
        <header className="construction-dashboard-heading-v56">
          <div>
            <span className="eyebrow">PAINEL EXECUTIVO DA OBRA</span>
            <h3>Avanço, capacidade e custo para decisão</h3>
          </div>
          <details className="construction-index-chip-v56">
            <summary>
              Índice geral <strong>{decimalNumber(overallIndex)}%</strong>
            </summary>
            <div>
              O índice combina avanço físico, prazo, equipe, máquinas,
              produtividade e orçamento. Ele não representa isoladamente a
              porcentagem concluída da obra.
            </div>
          </details>
        </header>

        <div className="construction-kpi-row-v56">
          <article
            className={`construction-kpi-v56 ${
              scheduleDelta < 0 ? "danger" : "success"
            }`}
          >
            <small>AVANÇO DA OBRA</small>
            <strong>{decimalNumber(physicalProgress)}%</strong>
            <p>
              {hasPlannedProgress
                ? `Meta: ${decimalNumber(plannedProgress)}% até hoje`
                : "Meta do período ainda não informada"}
            </p>
            <span>
              {scheduleDelta < 0
                ? `-${decimalNumber(progressGapPoints)} p.p. • ${executiveQuantity(
                    scheduleDelayDays,
                    "dia de atraso",
                    "dias de atraso",
                  )}`
                : scheduleDelta > 0
                  ? `+${decimalNumber(scheduleDelta)} p.p. acima da meta`
                  : "Avanço alinhado ao planejamento"}
            </span>
          </article>

          <article
            className={`construction-kpi-v56 ${
              operationCapacity < 60
                ? "danger"
                : operationCapacity < 90
                  ? "warning"
                  : "success"
            }`}
          >
            <small>CAPACIDADE OPERACIONAL</small>
            <strong>{decimalNumber(operationCapacity)}%</strong>
            <p>
              Limitada por {capacityConstraint.label} em{" "}
              {decimalNumber(capacityConstraint.value)}%
            </p>
            <span>{operationStatus}</span>
          </article>

          <article
            className={`construction-kpi-v56 ${
              ownWorkforceCapacity >= 90 ? "success" : "warning"
            }`}
          >
            <small>EQUIPE MOBILIZADA</small>
            <strong>{decimalNumber(ownWorkforceCapacity)}%</strong>
            <p>
              {ownTeamCount} de {requiredOwnTeamCount || "—"} pessoas necessárias
            </p>
            <span>
              {ownWorkforceCapacity >= 100
                ? "Equipe completa"
                : "Mobilização abaixo da necessidade"}
            </span>
          </article>

          <article
            className={`construction-kpi-v56 ${
              projectedBudgetVariance > 0 ? "danger" : "success"
            }`}
          >
            <small>CUSTO FINAL PROJETADO</small>
            <strong>{currency.format(projectedFinalCost)}</strong>
            <p>Orçamento aprovado: {currency.format(projectBudget)}</p>
            <span>
              {projectedBudgetVariance > 0
                ? `+${currency.format(projectedBudgetVariance)} acima do limite`
                : `${currency.format(Math.abs(projectedBudgetVariance))} de margem prevista`}
            </span>
          </article>
        </div>

        <div className="construction-main-grid-v56">
          <article className="construction-stage-card-v56">
            <header>
              <small>ETAPA E PROCESSO ATUAL</small>
              <span>
                {currentStagePosition
                  ? `Etapa ${currentStagePosition} de ${constructionStages.length}`
                  : "Etapa fora do fluxo padrão"}
              </span>
            </header>
            <h3>{currentStage}</h3>
            <p>{currentProcess}</p>

            <div className="construction-stage-progress-v56">
              <span>
                Avanço dentro da etapa
                <strong>{decimalNumber(currentStageProgress)}%</strong>
              </span>
              <b>
                <i style={{ width: `${currentStageProgress}%` }} />
              </b>
            </div>

            <div className="construction-stage-meta-v56">
              <div>
                <small>PRÓXIMO MARCO</small>
                <strong>{nextMilestone}</strong>
                <span>
                  {formatExecutiveDate(selectedWork.payload.nextMilestoneDate)}
                </span>
              </div>
              <div>
                <small>RESPONSÁVEIS</small>
                <strong>
                  {String(
                    selectedWork.payload.manager || "Gestor não informado",
                  )}
                </strong>
                <span>
                  {String(
                    selectedWork.payload.foreman ||
                      "Encarregado não informado",
                  )}
                </span>
              </div>
            </div>
          </article>

          <article
            className={`construction-budget-card-v56 ${
              projectedBudgetVariance > 0 ? "over" : "within"
            }`}
          >
            <header>
              <small>ORÇAMENTO E CUSTOS</small>
              <span>
                {projectedBudgetVariance > 0
                  ? "Acima do orçamento"
                  : "Dentro do orçamento"}
              </span>
            </header>
            <h3>{currency.format(estimatedCostToComplete)}</h3>
            <p>Necessário para concluir a obra</p>

            <div className="construction-budget-lines-v56">
              <div>
                <span>Orçamento aprovado</span>
                <strong>{currency.format(projectBudget)}</strong>
              </div>
              <div>
                <span>Custo realizado</span>
                <strong>{currency.format(projectRealizedCost)}</strong>
              </div>
              <div>
                <span>Compromissos em aberto</span>
                <strong>{currency.format(projectOpenCommitments)}</strong>
              </div>
              <div>
                <span>A contratar ou executar</span>
                <strong>{currency.format(uncommittedCostToComplete)}</strong>
              </div>
            </div>

            <div className="construction-budget-alert-v56">
              {projectedBudgetVariance > 0
                ? `${currency.format(projectedBudgetVariance)} acima do orçamento aprovado.`
                : `${currency.format(Math.abs(projectedBudgetVariance))} de margem prevista no encerramento.`}
            </div>
          </article>
        </div>
      </section>

'''

updated = source[:start] + replacement + source[end:]
if updated.count("construction-dashboard-v56") != 2:
    raise RuntimeError("O novo dashboard não foi inserido com a estrutura esperada.")
if "construction-project-command" in updated[start:end + len(replacement)]:
    raise RuntimeError("O bloco visual antigo ainda permaneceu no intervalo substituído.")

component_path.write_text(updated, encoding="utf-8")

layout = layout_path.read_text(encoding="utf-8")
old_import = 'import "./construction-v55.css";\n'
new_import = 'import "./construction-v56.css";\n'
if old_import not in layout:
    raise RuntimeError("Importação V55 não encontrada no layout.")
layout = layout.replace(old_import, new_import, 1)
layout_path.write_text(layout, encoding="utf-8")

if legacy_style_path.exists():
    legacy_style_path.unlink()

print("Dashboard V56 aplicado com dados dinâmicos.")
