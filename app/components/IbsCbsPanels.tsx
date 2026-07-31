"use client";

import { useEffect, useMemo, useState } from "react";

type FiscalIssue = {
  code: string;
  severity: "critical" | "warning";
  message: string;
  field: string;
  lineNumber?: number;
};

type IbsCbsConfig = {
  id?: number;
  regime: string;
  incidenceEnabled: boolean;
  effectiveFrom: string;
  effectiveTo: string;
  ibsStateRate: number;
  ibsMunicipalRate: number;
  ibsRate: number;
  cbsRate: number;
  reductionPercent: number;
  defermentPercent: number;
  creditEnabled: boolean;
  specialRegime: string;
  notes: string;
  rulesVersion?: string;
  updatedBy?: string;
  updatedAt?: string;
};

type FiscalItem = {
  itemDescription: string;
  itemCode: string;
  cst: string;
  cClassTrib: string;
  quantity: number;
  unitValue: number;
  operationValue?: number;
  reductionPercent: number;
  defermentPercent: number;
  ibsStateRate: number;
  ibsMunicipalRate: number;
  cbsRate: number;
  creditEligible: boolean;
  presumedCredit: number;
  blockedCreditReason: string;
  creditBasis: string;
  ibsAmount?: number;
  cbsAmount?: number;
  taxableBase?: number;
  validation?: FiscalIssue[];
};

type FiscalDocument = {
  id: number;
  direction: "incoming" | "outgoing";
  fiscalKey: string;
  documentNumber: string;
  series: string;
  issueDate: string;
  dueDate: string;
  competence: string;
  partnerName: string;
  partnerTaxId: string;
  supplierTaxRegime: string;
  operationValue: number;
  taxableBase: number;
  ibsAmount: number;
  cbsAmount: number;
  creditAmount: number;
  presumedCredit: number;
  blockedCredit: number;
  blockedCreditReason: string;
  work: string;
  costCenter: string;
  documentUrl: string;
  complianceStatus: string;
  criticalCount: number;
  warningCount: number;
  validation: FiscalIssue[];
  items: FiscalItem[];
  sourceModule?: string;
};

type Assessment = {
  id?: number;
  competence: string;
  status: string;
  documentCount: number;
  ibsDebits: number;
  ibsCredits: number;
  ibsBalance: number;
  cbsDebits: number;
  cbsCredits: number;
  cbsBalance: number;
  blockedCredits: number;
  pendingDocuments: number;
  criticalIssues: number;
  debitAdjustments?: number;
  creditAdjustments?: number;
  pisCofinsCompensation?: number;
  technicalBalance?: number;
  closedBy?: string;
  closedAt?: string;
  reopenReason?: string;
  live?: Assessment;
};

type Overview = {
  publicMode?: boolean;
  config: IbsCbsConfig;
  configHistory?: IbsCbsConfig[];
  documents: FiscalDocument[];
  assessment: Assessment;
  summary: {
    documentsAnalyzed: number;
    pendingDocuments: number;
    possibleCredits: number;
    blockedCredits: number;
    periodDebits: number;
    criticalIssues: number;
  };
};

type Notice = { kind: "success" | "error" | "info"; text: string } | null;

const brl = new Intl.NumberFormat("pt-BR", {
  style: "currency",
  currency: "BRL",
});
const rate = (value: number) => `${Number(value || 0).toLocaleString("pt-BR", { maximumFractionDigits: 4 })}%`;
const today = () => new Date().toISOString().slice(0, 10);
const currentCompetence = () => new Date().toISOString().slice(0, 7);
const formatDate = (value?: string) => {
  if (!value) return "Não informado";
  const [year, month, day] = value.slice(0, 10).split("-");
  return year && month && day ? `${day}/${month}/${year}` : value;
};
const formatCompetence = (value: string) => {
  const [year, month] = value.split("-");
  return year && month ? `${month}/${year}` : value;
};

const defaultConfig: IbsCbsConfig = {
  regime: "Regime regular",
  incidenceEnabled: true,
  effectiveFrom: "2026-01-01",
  effectiveTo: "2026-12-31",
  ibsStateRate: 0.1,
  ibsMunicipalRate: 0,
  ibsRate: 0.1,
  cbsRate: 0.9,
  reductionPercent: 0,
  defermentPercent: 0,
  creditEnabled: true,
  specialRegime: "",
  notes:
    "Período de testes de 2026. IBS UF 0,1%, IBS municipal 0% e CBS 0,9%, conforme a NT 2025.002 v1.40. Parâmetros sujeitos à validação contábil.",
};

function useIbsCbsOverview(competence?: string) {
  const [data, setData] = useState<Overview | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  async function reload() {
    setLoading(true);
    setError("");
    try {
      const query = competence ? `?competence=${encodeURIComponent(competence)}` : "";
      const response = await fetch(`/api/ibs-cbs${query}`, { cache: "no-store" });
      const body = (await response.json()) as Overview & { error?: string };
      if (!response.ok) throw new Error(body.error || "Não foi possível carregar IBS/CBS.");
      setData(body);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Falha ao carregar IBS/CBS.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    // A consulta é assíncrona e sincroniza a interface com o recurso remoto.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void reload();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [competence]);

  return { data, loading, error, reload };
}

function NoticeBox({ notice }: { notice: Notice }) {
  if (!notice) return null;
  return <div className={`ibs-notice ${notice.kind}`}>{notice.text}</div>;
}

export function IbsCbsDashboardSummary({ onOpenTaxes }: { onOpenTaxes?: () => void }) {
  const [competence, setCompetence] = useState(currentCompetence());
  const { data, loading, error } = useIbsCbsOverview(competence);
  if (loading) return <section className="content-card ibs-summary-card ibs-manager-card"><p>Carregando o painel gerencial de IBS/CBS…</p></section>;
  if (error || !data) return <section className="content-card ibs-summary-card ibs-manager-card"><p>{error || "Indicadores indisponíveis."}</p></section>;

  const { assessment, config } = data;
  const live = assessment.live || assessment;
  const protectedMode = Boolean(data.publicMode);
  const ibsDue = Math.max(0, Number(live.ibsBalance || 0));
  const cbsDue = Math.max(0, Number(live.cbsBalance || 0));
  const totalDue = ibsDue + cbsDue;
  const debitDocuments = (data.documents || [])
    .filter((document) => document.direction === "outgoing" && Number(document.ibsAmount || 0) + Number(document.cbsAmount || 0) > 0)
    .sort((a, b) => {
      if (!a.dueDate && !b.dueDate) return b.issueDate.localeCompare(a.issueDate);
      if (!a.dueDate) return 1;
      if (!b.dueDate) return -1;
      return a.dueDate.localeCompare(b.dueDate);
    });
  const nextDueDocument = debitDocuments.find((document) => document.dueDate);
  const missingDueDates = debitDocuments.filter((document) => !document.dueDate).length;
  const value = (amount: number) => protectedMode ? "Protegido" : brl.format(amount);
  const paymentMessage = protectedMode
    ? "Entre como administrador para consultar valores e notas."
    : totalDue > 0
      ? "Há saldo técnico estimado para recolhimento."
      : "Sem saldo técnico a recolher nesta competência.";

  return (
    <section className="content-card ibs-summary-card ibs-manager-card">
      <header className="ibs-manager-heading">
        <div>
          <span className="eyebrow">PAINEL GERENCIAL • IBS E CBS</span>
          <h2>Quanto pagar, quando vence e quais notas formam o valor</h2>
          <p>Visão rápida da competência para orientar a conferência e a próxima ação dos gestores.</p>
        </div>
        <div className="ibs-manager-controls">
          <label className="ibs-competence">
            <span>Competência</span>
            <input type="month" value={competence} onChange={(event) => setCompetence(event.target.value)} />
          </label>
          {onOpenTaxes ? <button className="button primary" type="button" onClick={onOpenTaxes}>Abrir central de Impostos</button> : null}
        </div>
      </header>

      <div className="ibs-manager-overview">
        <article className="ibs-manager-total">
          <span>Total estimado a pagar</span>
          <strong>{value(totalDue)}</strong>
          <small>IBS + CBS líquidos • competência {formatCompetence(competence)}</small>
          <p className={totalDue > 0 && !protectedMode ? "attention" : "ok"}>{paymentMessage}</p>
        </article>
        <article className="ibs-manager-tax ibs">
          <span>Total de IBS</span>
          <strong>{value(ibsDue)}</strong>
          <small>Débitos {value(Number(live.ibsDebits || 0))} • créditos {value(Number(live.ibsCredits || 0))}</small>
        </article>
        <article className="ibs-manager-tax cbs">
          <span>Total de CBS</span>
          <strong>{value(cbsDue)}</strong>
          <small>Débitos {value(Number(live.cbsDebits || 0))} • créditos {value(Number(live.cbsCredits || 0))}</small>
        </article>
      </div>

      <div className="ibs-manager-status">
        <article>
          <span>Próximo vencimento informado</span>
          <strong>{protectedMode ? "Acesso protegido" : nextDueDocument ? formatDate(nextDueDocument.dueDate) : "Nenhum vencimento"}</strong>
          <small>{protectedMode ? "Datas fiscais restritas" : nextDueDocument ? `Nota ${nextDueDocument.documentNumber || nextDueDocument.fiscalKey.slice(-8) || nextDueDocument.id}` : "Cadastre o vencimento na central de Impostos"}</small>
        </article>
        <article>
          <span>Notas que formam o débito</span>
          <strong>{protectedMode ? "—" : debitDocuments.length}</strong>
          <small>{protectedMode ? "Relação interna protegida" : `${missingDueDates} sem vencimento informado`}</small>
        </article>
        <article>
          <span>Situação da competência</span>
          <strong>{assessment.status || live.status || "Aberta"}</strong>
          <small>{protectedMode ? "Consulta pública" : `${live.criticalIssues || 0} erro(s) crítico(s) • ${live.pendingDocuments || 0} pendência(s)`}</small>
        </article>
        <article>
          <span>Alíquotas demonstrativas de 2026</span>
          <strong>IBS {rate(config.ibsRate)} • CBS {rate(config.cbsRate)}</strong>
          <small>Parâmetros sujeitos à validação contábil</small>
        </article>
      </div>

      <div className="ibs-manager-documents">
        <div className="ibs-manager-documents-heading">
          <div>
            <strong>Notas fiscais que compõem o valor</strong>
            <small>Valores brutos de IBS e CBS por documento de saída; o total a pagar considera os créditos da competência.</small>
          </div>
          <span>{protectedMode ? "Dados protegidos" : `${debitDocuments.length} nota(s)`}</span>
        </div>
        <div className="ibs-document-table-wrap">
          <table className="ibs-document-table ibs-manager-table">
            <thead><tr><th>Nota fiscal</th><th>Cliente</th><th>Emissão</th><th>Vencimento</th><th>IBS</th><th>CBS</th><th>Total da nota</th><th>Ação</th></tr></thead>
            <tbody>
              {!protectedMode ? debitDocuments.slice(0, 8).map((document) => {
                const documentTotal = Number(document.ibsAmount || 0) + Number(document.cbsAmount || 0);
                const needsAction = !document.dueDate || document.criticalCount > 0 || document.warningCount > 0;
                return (
                  <tr key={document.id}>
                    <td><strong>{document.documentNumber || "Sem número"}</strong><small>{document.fiscalKey ? `Chave …${document.fiscalKey.slice(-8)}` : `${document.items?.length || 1} item(ns)`}</small></td>
                    <td>{document.partnerName || "Não informado"}</td>
                    <td>{formatDate(document.issueDate)}</td>
                    <td><strong>{formatDate(document.dueDate)}</strong>{!document.dueDate ? <small className="ibs-needs-action">Informar vencimento</small> : null}</td>
                    <td>{brl.format(Number(document.ibsAmount || 0))}</td>
                    <td>{brl.format(Number(document.cbsAmount || 0))}</td>
                    <td><strong>{brl.format(documentTotal)}</strong></td>
                    <td><span className={`ibs-status ${needsAction ? "warning" : "ok"}`}>{needsAction ? "Conferir" : "Programado"}</span></td>
                  </tr>
                );
              }) : null}
              {protectedMode ? <tr><td colSpan={8} className="ibs-manager-empty">Entre como administrador para visualizar valores, vencimentos e notas fiscais.</td></tr> : null}
              {!protectedMode && !debitDocuments.length ? <tr><td colSpan={8} className="ibs-manager-empty">Nenhuma nota de saída com IBS/CBS foi registrada nesta competência. Use a central de Impostos para lançar o primeiro documento.</td></tr> : null}
            </tbody>
          </table>
        </div>
      </div>
    </section>
  );
}

export function IbsCbsRegimePanel({ isAdmin }: { isAdmin: boolean }) {
  const { data, loading, error, reload } = useIbsCbsOverview();
  const [draft, setDraft] = useState<IbsCbsConfig>(defaultConfig);
  const [notice, setNotice] = useState<Notice>(null);
  const [saving, setSaving] = useState(false);
  const [simulation, setSimulation] = useState<Record<string, number | string | boolean> | null>(null);
  const [customValue, setCustomValue] = useState(10000);
  const [customDirection, setCustomDirection] = useState<"incoming" | "outgoing">("incoming");

  useEffect(() => {
    // Sincroniza o rascunho somente quando chega uma configuração do servidor.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    if (data?.config) setDraft({ ...defaultConfig, ...data.config });
  }, [data]);

  function update<K extends keyof IbsCbsConfig>(key: K, value: IbsCbsConfig[K]) {
    setDraft((current) => {
      const next = {
        ...current,
        [key]: value,
        ibsRate:
          key === "ibsStateRate" || key === "ibsMunicipalRate"
            ? Number(key === "ibsStateRate" ? value : current.ibsStateRate) +
              Number(key === "ibsMunicipalRate" ? value : current.ibsMunicipalRate)
            : current.ibsRate,
      };
      if (key === "regime") {
        const simplified = /simples|mei/i.test(String(value));
        return simplified
            ? { ...next, incidenceEnabled: false, creditEnabled: false, ibsStateRate: 0, ibsMunicipalRate: 0, ibsRate: 0, cbsRate: 0 }
            : Number(next.ibsRate) + Number(next.cbsRate) === 0
            ? { ...next, incidenceEnabled: true, creditEnabled: true, ibsStateRate: 0.1, ibsMunicipalRate: 0, ibsRate: 0.1, cbsRate: 0.9 }
            : next;
      }
      return next;
    });
  }

  async function saveConfig() {
    setSaving(true);
    setNotice(null);
    try {
      const response = await fetch("/api/ibs-cbs", {
        method: "PUT",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(draft),
      });
      const body = (await response.json()) as { config?: IbsCbsConfig; error?: string };
      if (!response.ok || !body.config) throw new Error(body.error || "Não foi possível salvar a configuração.");
      setDraft(body.config);
      setNotice({ kind: "success", text: "Nova vigência IBS/CBS salva com histórico imutável." });
      await reload();
    } catch (caught) {
      setNotice({ kind: "error", text: caught instanceof Error ? caught.message : "Falha ao salvar." });
    } finally {
      setSaving(false);
    }
  }

  async function simulate(operationValue: number, direction: "incoming" | "outgoing") {
    setNotice(null);
    try {
      const response = await fetch("/api/ibs-cbs", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          action: "simulate",
          operationValue,
          direction,
          competence: "2026-01",
          creditEligible: direction === "incoming",
          reductionPercent: draft.reductionPercent,
          defermentPercent: draft.defermentPercent,
          ibsStateRate: draft.ibsStateRate,
          ibsMunicipalRate: draft.ibsMunicipalRate,
          cbsRate: draft.cbsRate,
          regime: draft.regime,
          incidenceEnabled: draft.incidenceEnabled,
          creditEnabled: draft.creditEnabled,
        }),
      });
      const body = (await response.json()) as { calculation?: Record<string, number | string | boolean>; error?: string };
      if (!response.ok || !body.calculation) throw new Error(body.error || "Não foi possível simular.");
      setSimulation(body.calculation);
      setNotice({ kind: "info", text: "Simulação executada sem gravar dados no banco." });
    } catch (caught) {
      setNotice({ kind: "error", text: caught instanceof Error ? caught.message : "Falha na simulação." });
    }
  }

  if (loading) return <section className="content-card ibs-panel"><p>Carregando configuração IBS/CBS…</p></section>;
  if (error) return <section className="content-card ibs-panel"><p>{error}</p></section>;

  return (
    <section className="content-card ibs-panel">
      <header className="ibs-section-heading">
        <div>
          <span className="eyebrow">REGIME TRIBUTÁRIO • IBS/CBS</span>
          <h2>Configuração por vigência</h2>
          <p>Alíquotas parametrizáveis, histórico de alterações e simulações públicas sem persistência.</p>
        </div>
        <span className="ibs-test-badge">2026 • ano de testes</span>
      </header>

      <div className="ibs-notice info">
        Parâmetros oficiais de teste para 2026: IBS da UF 0,1%, IBS municipal
        0% e CBS 0,9%. Para NF-e/NFC-e do regime regular, as validações da NT
        2025.002 v1.40 entram em produção em 03/08/2026.{" "}
        <a
          href="https://www.gov.br/receitafederal/pt-br/acesso-a-informacao/acoes-e-programas/programas-e-atividades/reforma-tributaria-do-consumo/orientacoes-2026"
          target="_blank"
          rel="noreferrer"
        >
          Orientação da Receita Federal
        </a>
        {" · "}
        <a
          href="https://www.cgibs.gov.br/upload/arquivos/202606/17141803-nt-2025-002-v1-40-rtc-nf-e-ibs-cbs-is-final.pdf"
          target="_blank"
          rel="noreferrer"
        >
          Nota Técnica oficial
        </a>
      </div>

      <NoticeBox notice={notice} />

      <div className="ibs-form-grid">
        <label><span>Regime de incidência</span><select value={draft.regime} disabled={!isAdmin} onChange={(e) => update("regime", e.target.value)}><option>Regime regular</option><option>Simples Nacional</option><option>MEI</option><option>Configuração específica</option></select></label>
        <label><span>Início da vigência</span><input type="date" value={draft.effectiveFrom} disabled={!isAdmin} onChange={(e) => update("effectiveFrom", e.target.value)} /></label>
        <label><span>Fim da vigência</span><input type="date" value={draft.effectiveTo} disabled={!isAdmin} onChange={(e) => update("effectiveTo", e.target.value)} /></label>
        <label><span>IBS da UF (%)</span><input type="number" step="0.0001" value={draft.ibsStateRate} disabled={!isAdmin} onChange={(e) => update("ibsStateRate", Number(e.target.value))} /><small>Parâmetro de teste de 2026: 0,1%.</small></label>
        <label><span>IBS municipal (%)</span><input type="number" step="0.0001" value={draft.ibsMunicipalRate} disabled={!isAdmin} onChange={(e) => update("ibsMunicipalRate", Number(e.target.value))} /><small>Parâmetro de teste de 2026: 0%.</small></label>
        <label><span>CBS (%)</span><input type="number" step="0.0001" value={draft.cbsRate} disabled={!isAdmin} onChange={(e) => update("cbsRate", Number(e.target.value))} /></label>
        <label><span>Redução padrão (%)</span><input type="number" min="0" max="100" step="0.01" value={draft.reductionPercent} disabled={!isAdmin} onChange={(e) => update("reductionPercent", Number(e.target.value))} /></label>
        <label><span>Diferimento padrão (%)</span><input type="number" min="0" max="100" step="0.01" value={draft.defermentPercent} disabled={!isAdmin} onChange={(e) => update("defermentPercent", Number(e.target.value))} /></label>
        <label className="ibs-check"><input type="checkbox" checked={draft.incidenceEnabled} disabled={!isAdmin} onChange={(e) => update("incidenceEnabled", e.target.checked)} /><span>Incidência IBS/CBS habilitada</span></label>
        <label className="ibs-check"><input type="checkbox" checked={draft.creditEnabled} disabled={!isAdmin} onChange={(e) => update("creditEnabled", e.target.checked)} /><span>Direito a crédito habilitado para análise</span></label>
        <label className="wide"><span>Regime específico / benefício</span><input value={draft.specialRegime} disabled={!isAdmin} onChange={(e) => update("specialRegime", e.target.value)} placeholder="Informe somente quando aplicável" /></label>
        <label className="wide"><span>Observações fiscais</span><textarea value={draft.notes} disabled={!isAdmin} onChange={(e) => update("notes", e.target.value)} /></label>
      </div>

      <div className="ibs-config-total">
        <span>Alíquota demonstrativa total</span>
        <strong>{rate(Number(draft.ibsStateRate) + Number(draft.ibsMunicipalRate) + Number(draft.cbsRate))}</strong>
        <small>IBS {rate(Number(draft.ibsStateRate) + Number(draft.ibsMunicipalRate))} + CBS {rate(draft.cbsRate)}</small>
      </div>

      <div className="ibs-actions-row">
        <button className="button primary" type="button" disabled={!isAdmin || saving} onClick={saveConfig}>{saving ? "Salvando…" : "Salvar nova vigência"}</button>
        {!isAdmin ? <small>Visitante: consulta e simulação liberadas; gravação bloqueada.</small> : <small>Alterações geram nova versão e registro de auditoria.</small>}
      </div>

      <div className="ibs-config-history">
        <div className="ibs-items-heading"><div><strong>Histórico de vigências</strong><small>Registros append-only: alterações anteriores permanecem preservadas.</small></div><span>{data?.configHistory?.length || 0} versão(ões)</span></div>
        <div className="ibs-history-list">
          {(data?.configHistory || []).slice(0, 6).map((version) => (
            <article key={version.id || `${version.effectiveFrom}-${version.updatedAt}`}>
              <strong>{version.effectiveFrom} a {version.effectiveTo || "sem término"}</strong>
              <span>IBS {rate(Number(version.ibsStateRate) + Number(version.ibsMunicipalRate))} • CBS {rate(version.cbsRate)}</span>
              <small>{version.regime} • {version.updatedBy || "Sistema"}</small>
            </article>
          ))}
        </div>
      </div>

      <div className="ibs-simulator">
        <header><div><span className="eyebrow">TESTES NO PRÓPRIO SITE</span><h3>Simulador sem persistência</h3></div></header>
        <div className="ibs-test-buttons">
          <button type="button" onClick={() => simulate(10000, "incoming")}><strong>Teste 1 — Aquisição</strong><span>R$ 10.000,00 • possível crédito</span></button>
          <button type="button" onClick={() => simulate(25000, "outgoing")}><strong>Teste 2 — Receita de serviço</strong><span>R$ 25.000,00 • débito técnico</span></button>
        </div>
        <div className="ibs-custom-simulation">
          <label><span>Valor personalizado</span><input type="number" min="0" step="0.01" value={customValue} onChange={(e) => setCustomValue(Number(e.target.value))} /></label>
          <label><span>Operação</span><select value={customDirection} onChange={(e) => setCustomDirection(e.target.value as "incoming" | "outgoing")}><option value="incoming">Aquisição / entrada</option><option value="outgoing">Receita / saída</option></select></label>
          <button className="button secondary" type="button" onClick={() => simulate(customValue, customDirection)}>Calcular</button>
        </div>
        {simulation ? (
          <div className="ibs-memory">
            <article><span>Base tributável</span><strong>{brl.format(Number(simulation.taxableBase || 0))}</strong></article>
            <article><span>IBS • {rate(Number(simulation.ibsRate || 0))}</span><strong>{brl.format(Number(simulation.ibsAmount || 0))}</strong></article>
            <article><span>CBS • {rate(Number(simulation.cbsRate || 0))}</span><strong>{brl.format(Number(simulation.cbsAmount || 0))}</strong></article>
            <article><span>Total demonstrativo</span><strong>{brl.format(Number(simulation.totalAmount || 0))}</strong></article>
            <p>Simulação administrativa. Não substitui validação do contador e não transmite obrigação fiscal.</p>
          </div>
        ) : null}
      </div>
    </section>
  );
}

const emptyItem = (config: IbsCbsConfig): FiscalItem => ({
  itemDescription: "",
  itemCode: "",
  cst: "",
  cClassTrib: "",
  quantity: 1,
  unitValue: 0,
  reductionPercent: config.reductionPercent ?? 0,
  defermentPercent: config.defermentPercent ?? 0,
  ibsStateRate: config.ibsStateRate ?? 0.1,
  ibsMunicipalRate: config.ibsMunicipalRate ?? 0,
  cbsRate: config.cbsRate ?? 0.9,
  creditEligible: true,
  presumedCredit: 0,
  blockedCreditReason: "",
  creditBasis: "",
});

export function IbsCbsFiscalPanel({ isAdmin }: { isAdmin: boolean }) {
  const { data, loading, error, reload } = useIbsCbsOverview();
  const config = data?.config || defaultConfig;
  const [notice, setNotice] = useState<Notice>(null);
  const [saving, setSaving] = useState(false);
  const [expanded, setExpanded] = useState(false);
  const [replacingId, setReplacingId] = useState<number | null>(null);
  const [form, setForm] = useState({
    direction: "incoming" as "incoming" | "outgoing",
    fiscalKey: "",
    documentNumber: "",
    series: "",
    issueDate: today(),
    dueDate: "",
    competence: currentCompetence(),
    partnerName: "",
    partnerTaxId: "",
    supplierTaxRegime: "",
    work: "",
    costCenter: "",
    documentUrl: "",
    creditBasis: "",
  });
  const [items, setItems] = useState<FiscalItem[]>([emptyItem(defaultConfig)]);

  useEffect(() => {
    if (data?.config && items.length === 1 && !items[0].itemDescription && !items[0].unitValue) {
      // Inicializa o primeiro item com as alíquotas da vigência carregada.
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setItems([emptyItem(data.config)]);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [data?.config]);

  function updateForm(key: keyof typeof form, value: string) {
    setForm((current) => ({ ...current, [key]: value }) as typeof current);
  }
  function updateItem(index: number, key: keyof FiscalItem, value: string | number | boolean) {
    setItems((current) =>
      current.map((item, itemIndex) => {
        if (itemIndex !== index) return item;
        if (key === "cClassTrib") {
          const cClassTrib = String(value).replace(/\D/g, "").slice(0, 6);
          return {
            ...item,
            cClassTrib,
            cst: cClassTrib.length >= 3 ? cClassTrib.slice(0, 3) : item.cst,
          };
        }
        if (key === "cst") {
          return {
            ...item,
            cst: String(value).replace(/\D/g, "").slice(0, 3),
          };
        }
        return { ...item, [key]: value } as FiscalItem;
      }),
    );
  }

  function startCorrection(document: FiscalDocument) {
    setReplacingId(document.id);
    setExpanded(true);
    setForm({
      direction: document.direction,
      fiscalKey: document.fiscalKey,
      documentNumber: document.documentNumber,
      series: document.series,
      issueDate: document.issueDate || today(),
      dueDate: document.dueDate || "",
      competence: document.competence || currentCompetence(),
      partnerName: document.partnerName,
      partnerTaxId: document.partnerTaxId,
      supplierTaxRegime: document.supplierTaxRegime,
      work: document.work,
      costCenter: document.costCenter,
      documentUrl: document.documentUrl,
      creditBasis: "Correção de documento com pendência fiscal.",
    });
    setItems(
      document.items?.length
        ? document.items.map((item) => ({
            ...emptyItem(config),
            ...item,
            quantity: Number(item.quantity || 1),
            unitValue: Number(item.unitValue || 0),
          }))
        : [emptyItem(config)],
    );
    setNotice({ kind: "info", text: `Corrigindo o documento ${document.documentNumber || document.id}. A versão anterior será preservada na auditoria.` });
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  async function saveDocument() {
    setSaving(true);
    setNotice(null);
    try {
      const response = await fetch("/api/ibs-cbs", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ action: "document", ...form, items, sourceModule: "taxes", replaceDocumentId: replacingId || undefined }),
      });
      const body = (await response.json()) as { document?: FiscalDocument; error?: string };
      if (!response.ok || !body.document) throw new Error(body.error || "Não foi possível registrar o documento.");
      setNotice({
        kind: body.document.criticalCount ? "error" : body.document.warningCount ? "info" : "success",
        text: `Documento salvo: ${body.document.complianceStatus}. IBS ${brl.format(body.document.ibsAmount)} e CBS ${brl.format(body.document.cbsAmount)}.`,
      });
      setForm((current) => ({ ...current, fiscalKey: "", documentNumber: "", dueDate: "", partnerName: "", partnerTaxId: "", documentUrl: "" }));
      setItems([emptyItem(config)]);
      setReplacingId(null);
      await reload();
    } catch (caught) {
      setNotice({ kind: "error", text: caught instanceof Error ? caught.message : "Falha ao registrar." });
    } finally {
      setSaving(false);
    }
  }

  if (loading) return <section className="content-card ibs-panel"><p>Carregando documentos IBS/CBS…</p></section>;
  if (error) return <section className="content-card ibs-panel"><p>{error}</p></section>;

  const documents = data?.documents || [];
  return (
    <section className="content-card ibs-panel fiscal-panel">
      <header className="ibs-section-heading">
        <div><span className="eyebrow">IMPOSTOS • NOTAS FISCAIS IBS/CBS</span><h2>Documentos que formam débitos e créditos</h2><p>Cadastre a nota, o vencimento e os itens tributários em um único lugar.</p></div>
        <button className="button secondary" type="button" onClick={() => setExpanded((value) => !value)}>{expanded ? "Ocultar lançamento" : "Lançar documento fiscal"}</button>
      </header>
      <NoticeBox notice={notice} />
      {expanded ? (
        <div className="ibs-document-form">
          {replacingId ? <div className="ibs-correction-banner"><strong>Modo de correção</strong><span>A versão anterior será marcada como substituída e mantida na auditoria.</span><button type="button" onClick={() => setReplacingId(null)}>Cancelar correção</button></div> : null}
          <div className="ibs-form-grid">
            <label><span>Tipo de operação</span><select value={form.direction} disabled={!isAdmin} onChange={(e) => updateForm("direction", e.target.value)}><option value="incoming">Aquisição / entrada</option><option value="outgoing">Receita / saída</option></select></label>
            <label><span>Chave fiscal (44 dígitos)</span><input value={form.fiscalKey} disabled={!isAdmin} maxLength={60} onChange={(e) => updateForm("fiscalKey", e.target.value)} /></label>
            <label><span>Número</span><input value={form.documentNumber} disabled={!isAdmin} onChange={(e) => updateForm("documentNumber", e.target.value)} /></label>
            <label><span>Série</span><input value={form.series} disabled={!isAdmin} onChange={(e) => updateForm("series", e.target.value)} /></label>
            <label><span>Emissão</span><input type="date" value={form.issueDate} disabled={!isAdmin} onChange={(e) => { updateForm("issueDate", e.target.value); updateForm("competence", e.target.value.slice(0, 7)); }} /></label>
            <label><span>Vencimento fiscal</span><input type="date" value={form.dueDate} disabled={!isAdmin} onChange={(e) => updateForm("dueDate", e.target.value)} /><small>Data que aparecerá no painel dos gestores.</small></label>
            <label><span>Competência</span><input type="month" value={form.competence} disabled={!isAdmin} onChange={(e) => updateForm("competence", e.target.value)} /></label>
            <label><span>Fornecedor / cliente</span><input value={form.partnerName} disabled={!isAdmin} onChange={(e) => updateForm("partnerName", e.target.value)} /></label>
            <label><span>CNPJ / CPF</span><input value={form.partnerTaxId} disabled={!isAdmin} onChange={(e) => updateForm("partnerTaxId", e.target.value)} /></label>
            <label><span>Regime tributário do fornecedor</span><select value={form.supplierTaxRegime} disabled={!isAdmin} onChange={(e) => updateForm("supplierTaxRegime", e.target.value)}><option value="">Não informado</option><option>Regime regular</option><option>Simples Nacional</option><option>MEI</option><option>Não contribuinte</option></select></label>
            <label><span>Obra</span><input value={form.work} disabled={!isAdmin} onChange={(e) => updateForm("work", e.target.value)} /></label>
            <label><span>Centro de custo</span><input value={form.costCenter} disabled={!isAdmin} onChange={(e) => updateForm("costCenter", e.target.value)} /></label>
            <label className="wide"><span>Link da nota / evidência</span><input type="url" value={form.documentUrl} disabled={!isAdmin} onChange={(e) => updateForm("documentUrl", e.target.value)} placeholder="SharePoint, OneDrive ou repositório autorizado" /></label>
          </div>

          <div className="ibs-items-heading"><div><strong>Itens do documento</strong><small>O cálculo e as validações são executados individualmente.</small></div><button type="button" disabled={!isAdmin} onClick={() => setItems((current) => [...current, emptyItem(config)])}>+ Adicionar item</button></div>
          <div className="ibs-items-list">
            {items.map((item, index) => (
              <article className="ibs-item-card" key={index}>
                <header><strong>Item {index + 1}</strong>{items.length > 1 ? <button type="button" disabled={!isAdmin} onClick={() => setItems((current) => current.filter((_, itemIndex) => itemIndex !== index))}>Remover</button> : null}</header>
                <div className="ibs-form-grid compact">
                  <label className="wide"><span>Descrição</span><input value={item.itemDescription} disabled={!isAdmin} onChange={(e) => updateItem(index, "itemDescription", e.target.value)} /></label>
                  <label><span>NCM / NBS / código do serviço</span><input value={item.itemCode} disabled={!isAdmin} onChange={(e) => updateItem(index, "itemCode", e.target.value)} /></label>
                  <label><span>CST IBS/CBS</span><input inputMode="numeric" maxLength={3} value={item.cst} disabled={!isAdmin} onChange={(e) => updateItem(index, "cst", e.target.value)} /><small>3 dígitos.</small></label>
                  <label><span>cClassTrib</span><input inputMode="numeric" maxLength={6} value={item.cClassTrib} disabled={!isAdmin} onChange={(e) => updateItem(index, "cClassTrib", e.target.value)} /><small>6 dígitos; os 3 primeiros definem o CST.</small></label>
                  <label><span>Quantidade</span><input type="number" min="0" step="0.0001" value={item.quantity} disabled={!isAdmin} onChange={(e) => updateItem(index, "quantity", Number(e.target.value))} /></label>
                  <label><span>Valor unitário</span><input type="number" min="0" step="0.01" value={item.unitValue} disabled={!isAdmin} onChange={(e) => updateItem(index, "unitValue", Number(e.target.value))} /></label>
                  <label><span>Redução (%)</span><input type="number" min="0" max="100" step="0.01" value={item.reductionPercent} disabled={!isAdmin} onChange={(e) => updateItem(index, "reductionPercent", Number(e.target.value))} /></label>
                  <label><span>Diferimento (%)</span><input type="number" min="0" max="100" step="0.01" value={item.defermentPercent} disabled={!isAdmin} onChange={(e) => updateItem(index, "defermentPercent", Number(e.target.value))} /></label>
                  <label><span>IBS da UF (%)</span><input type="number" step="0.0001" value={item.ibsStateRate} disabled={!isAdmin} onChange={(e) => updateItem(index, "ibsStateRate", Number(e.target.value))} /></label>
                  <label><span>IBS municipal (%)</span><input type="number" step="0.0001" value={item.ibsMunicipalRate} disabled={!isAdmin} onChange={(e) => updateItem(index, "ibsMunicipalRate", Number(e.target.value))} /></label>
                  <label><span>CBS (%)</span><input type="number" step="0.0001" value={item.cbsRate} disabled={!isAdmin} onChange={(e) => updateItem(index, "cbsRate", Number(e.target.value))} /></label>
                  <label className="ibs-check"><input type="checkbox" checked={item.creditEligible} disabled={!isAdmin || form.direction === "outgoing"} onChange={(e) => updateItem(index, "creditEligible", e.target.checked)} /><span>Possível direito a crédito</span></label>
                  <label><span>Crédito presumido (R$)</span><input type="number" min="0" step="0.01" value={item.presumedCredit} disabled={!isAdmin || form.direction === "outgoing"} onChange={(e) => updateItem(index, "presumedCredit", Number(e.target.value))} /></label>
                  <label className="wide"><span>Motivo de bloqueio do crédito</span><input value={item.blockedCreditReason} disabled={!isAdmin || item.creditEligible} onChange={(e) => updateItem(index, "blockedCreditReason", e.target.value)} placeholder={item.creditEligible ? "Crédito habilitado para análise" : "Ex.: uso pessoal, documento inidôneo ou classificação pendente"} /></label>
                  <label className="wide"><span>Fundamento / observação do crédito</span><input value={item.creditBasis} disabled={!isAdmin} onChange={(e) => updateItem(index, "creditBasis", e.target.value)} /></label>
                </div>
              </article>
            ))}
          </div>
          <div className="ibs-actions-row"><button className="button primary" type="button" disabled={!isAdmin || saving} onClick={saveDocument}>{saving ? "Calculando e validando…" : "Salvar documento e memória de cálculo"}</button>{!isAdmin ? <small>Visitantes não podem persistir lançamentos.</small> : <small>Erros críticos bloqueiam o fechamento, mas o documento permanece registrado para correção.</small>}</div>
        </div>
      ) : null}

      <div className="ibs-document-table-wrap">
        <table className="ibs-document-table"><thead><tr><th>Documento</th><th>Parceiro</th><th>Competência</th><th>Vencimento</th><th>Base</th><th>IBS</th><th>CBS</th><th>Status fiscal</th><th>Ação</th></tr></thead><tbody>
          {documents.slice(0, 20).map((document) => <tr key={document.id}><td><strong>{document.documentNumber || "Sem número"}</strong><small>{document.items?.length || 1} item(ns)</small></td><td>{document.partnerName || "—"}</td><td>{formatCompetence(document.competence)}</td><td><strong>{formatDate(document.dueDate)}</strong>{!document.dueDate && document.direction === "outgoing" ? <small className="ibs-needs-action">Informar</small> : null}</td><td>{brl.format(document.taxableBase)}</td><td>{brl.format(document.ibsAmount)}</td><td>{brl.format(document.cbsAmount)}</td><td><span className={`ibs-status ${document.criticalCount ? "critical" : document.warningCount || (document.direction === "outgoing" && !document.dueDate) ? "warning" : "ok"}`}>{document.complianceStatus}</span></td><td>{isAdmin && (document.criticalCount || document.warningCount || (document.direction === "outgoing" && !document.dueDate)) ? <button className="ibs-correct-button" type="button" onClick={() => startCorrection(document)}>Corrigir</button> : <span>—</span>}</td></tr>)}
          {!documents.length ? <tr><td colSpan={9}>Nenhum documento fiscal IBS/CBS registrado. Use “Lançar documento fiscal” para iniciar.</td></tr> : null}
        </tbody></table>
      </div>
    </section>
  );
}

export function IbsCbsAssessmentPanel({ isAdmin }: { isAdmin: boolean }) {
  const [competence, setCompetence] = useState(currentCompetence());
  const { data, loading, error, reload } = useIbsCbsOverview(competence);
  const [notice, setNotice] = useState<Notice>(null);
  const [reason, setReason] = useState("");
  const [debitAdjustments, setDebitAdjustments] = useState(0);
  const [creditAdjustments, setCreditAdjustments] = useState(0);
  const [pisCofinsCompensation, setPisCofinsCompensation] = useState(0);
  const [working, setWorking] = useState(false);

  const assessment = data?.assessment;
  const issues = useMemo(
    () =>
      (data?.documents || []).flatMap((document) =>
        (document.validation || []).map((issue) => ({ ...issue, document })),
      ),
    [data?.documents],
  );

  async function act(action: "close" | "reopen") {
    setWorking(true);
    setNotice(null);
    try {
      const response = await fetch("/api/ibs-cbs", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ action, competence, reason, debitAdjustments, creditAdjustments, pisCofinsCompensation }),
      });
      const body = (await response.json()) as { assessment?: Assessment; error?: string };
      if (!response.ok || !body.assessment) throw new Error(body.error || "Não foi possível atualizar a apuração.");
      setNotice({ kind: "success", text: action === "close" ? "Competência fechada com trilha de auditoria." : "Competência reaberta com motivo registrado." });
      setReason("");
      await reload();
    } catch (caught) {
      setNotice({ kind: "error", text: caught instanceof Error ? caught.message : "Falha na apuração." });
    } finally {
      setWorking(false);
    }
  }

  if (loading) return <section className="content-card ibs-panel"><p>Carregando apuração IBS/CBS…</p></section>;
  if (error || !assessment) return <section className="content-card ibs-panel"><p>{error || "Apuração indisponível."}</p></section>;

  const live = assessment.live || assessment;
  return (
    <section className="content-card ibs-panel assessment-panel">
      <header className="ibs-section-heading">
        <div><span className="eyebrow">IMPOSTOS • APURAÇÃO E COMPLIANCE</span><h2>Apuração mensal IBS/CBS</h2><p>Débitos, créditos, bloqueios e fechamento técnico do período.</p></div>
        <label className="ibs-competence"><span>Competência</span><input type="month" value={competence} onChange={(e) => setCompetence(e.target.value)} /></label>
      </header>
      <NoticeBox notice={notice} />
      {data?.publicMode ? <div className="ibs-notice info">Apuração, documentos e valores internos são visíveis somente para o administrador.</div> : null}
      <div className="ibs-assessment-grid">
        <article><span>Débitos IBS</span><strong>{brl.format(Number(live.ibsDebits || 0))}</strong><small>Créditos {brl.format(Number(live.ibsCredits || 0))}</small></article>
        <article><span>Saldo IBS</span><strong>{brl.format(Number(live.ibsBalance || 0))}</strong><small>Saldo técnico</small></article>
        <article><span>Débitos CBS</span><strong>{brl.format(Number(live.cbsDebits || 0))}</strong><small>Créditos {brl.format(Number(live.cbsCredits || 0))}</small></article>
        <article><span>Saldo CBS</span><strong>{brl.format(Number(live.cbsBalance || 0))}</strong><small>Saldo técnico</small></article>
        <article><span>Créditos bloqueados</span><strong>{brl.format(Number(live.blockedCredits || 0))}</strong><small>{live.pendingDocuments || 0} documentos pendentes</small></article>
        <article><span>Status</span><strong>{assessment.status || live.status}</strong><small>{live.criticalIssues || 0} erros críticos</small></article>
      </div>

      <div className="ibs-compliance-layout">
        <div>
          <div className="ibs-items-heading"><div><strong>Pendências de conformidade</strong><small>CST, cClassTrib, chave, base, alíquotas, crédito, obra e evidência.</small></div><span>{issues.length} ocorrência(s)</span></div>
          <div className="ibs-issues-list">
            {issues.slice(0, 30).map((entry, index) => <article key={`${entry.document.id}-${index}`} className={entry.severity}><span>{entry.severity === "critical" ? "Crítico" : "Atenção"}</span><div><strong>{entry.message}</strong><small>Documento {entry.document.documentNumber || entry.document.fiscalKey || entry.document.id}{entry.lineNumber ? ` • item ${entry.lineNumber}` : ""}</small></div></article>)}
            {!issues.length ? <p className="ibs-empty-ok">Nenhuma pendência encontrada para a competência.</p> : null}
          </div>
        </div>
        <aside className="ibs-close-box">
          <strong>Fechamento da competência</strong>
          <p>O sistema impede o fechamento quando existirem erros críticos. Em 2026, a compensação com PIS/Cofins é apenas registrada tecnicamente.</p>
          <label><span>Ajustes de débito</span><input type="number" min="0" step="0.01" value={debitAdjustments} disabled={!isAdmin} onChange={(e) => setDebitAdjustments(Math.max(0, Number(e.target.value)))} /></label>
          <label><span>Ajustes de crédito</span><input type="number" min="0" step="0.01" value={creditAdjustments} disabled={!isAdmin} onChange={(e) => setCreditAdjustments(Math.max(0, Number(e.target.value)))} /></label>
          <label><span>Compensação PIS/Cofins (2026)</span><input type="number" min="0" step="0.01" value={pisCofinsCompensation} disabled={!isAdmin || !competence.startsWith("2026-")} onChange={(e) => setPisCofinsCompensation(Math.max(0, Number(e.target.value)))} /></label>
          <label><span>Motivo / observação</span><textarea value={reason} disabled={!isAdmin} onChange={(e) => setReason(e.target.value)} placeholder="Obrigatório para reabertura" /></label>
          <div className="ibs-close-actions"><button className="button primary" type="button" disabled={!isAdmin || working || assessment.status === "Fechada" || Number(live.criticalIssues || 0) > 0} onClick={() => act("close")}>Fechar competência</button><button className="button secondary" type="button" disabled={!isAdmin || working || assessment.status !== "Fechada" || !reason.trim()} onClick={() => act("reopen")}>Reabrir</button></div>
          {isAdmin ? <a className="button secondary ibs-export-button" href={`/api/ibs-cbs?view=export&competence=${encodeURIComponent(competence)}`}>Exportar memória de cálculo (CSV)</a> : null}
          {!isAdmin ? <small>Somente administrador pode fechar ou reabrir.</small> : Number(live.criticalIssues || 0) > 0 ? <small>Corrija os erros críticos antes do fechamento.</small> : <small>Fechamento técnico; nenhuma transmissão é realizada.</small>}
        </aside>
      </div>
    </section>
  );
}

export function IbsCbsTaxCenter({ isAdmin }: { isAdmin: boolean }) {
  const [section, setSection] = useState<"assessment" | "documents" | "settings">("assessment");
  return (
    <div className="ibs-tax-center">
      <section className="content-card ibs-tax-center-header">
        <div>
          <span className="eyebrow">CENTRAL ÚNICA • IMPOSTOS</span>
          <h1>IBS e CBS</h1>
          <p>Apuração, valores a recolher, notas fiscais, vencimentos, configurações e testes reunidos nesta área.</p>
        </div>
        <nav aria-label="Áreas da central IBS e CBS">
          <button type="button" className={section === "assessment" ? "active" : ""} onClick={() => setSection("assessment")}>
            <strong>Resumo e pagamento</strong>
            <small>Quanto pagar e pendências</small>
          </button>
          <button type="button" className={section === "documents" ? "active" : ""} onClick={() => setSection("documents")}>
            <strong>Notas fiscais</strong>
            <small>Débitos, créditos e vencimentos</small>
          </button>
          <button type="button" className={section === "settings" ? "active" : ""} onClick={() => setSection("settings")}>
            <strong>Parâmetros e testes</strong>
            <small>Regime, alíquotas e simulador</small>
          </button>
        </nav>
      </section>
      {section === "assessment" ? (
        <>
          <IbsCbsDashboardSummary />
          <IbsCbsAssessmentPanel isAdmin={isAdmin} />
        </>
      ) : null}
      {section === "documents" ? <IbsCbsFiscalPanel isAdmin={isAdmin} /> : null}
      {section === "settings" ? <IbsCbsRegimePanel isAdmin={isAdmin} /> : null}
    </div>
  );
}

export function IbsCbsPayrollImpactPanel() {
  const { data } = useIbsCbsOverview();
  const config = data?.config || defaultConfig;
  const regime = String(config.regime || "").toLowerCase();
  const applicable = Boolean(config.incidenceEnabled) && !regime.includes("simples") && !regime.includes("mei");
  const ibsDisplayRate = applicable ? config.ibsRate : 0;
  const cbsDisplayRate = applicable ? config.cbsRate : 0;
  return (
    <section className="content-card ibs-payroll-impact">
      <header><div><span className="eyebrow">FOLHA DE PAGAMENTO</span><h2>Impacto tributário da empresa</h2></div><span className="ibs-test-badge">Somente informativo</span></header>
      <div className="ibs-payroll-rule"><strong>IBS e CBS não são descontos do trabalhador.</strong><p>O motor da folha mantém salário líquido, verbas, INSS, IRRF e FGTS separados da reforma tributária do consumo. Nenhum valor de IBS ou CBS é incluído como retenção trabalhista.</p></div>
      <div className="ibs-payroll-rates"><article><span>IBS empresarial de teste</span><strong>{rate(ibsDisplayRate)}</strong></article><article><span>CBS empresarial de teste</span><strong>{rate(cbsDisplayRate)}</strong></article><article><span>Reflexo no líquido do empregado</span><strong>{brl.format(0)}</strong></article></div>
    </section>
  );
}
