"use client";

import { useMemo, useState } from "react";
import {
  calculateTermination,
  terminationNoticeLabels,
  terminationRules2026,
  terminationTypeLabels,
  type TerminationInput,
  type TerminationNoticeType,
  type TerminationType,
} from "../lib/termination";
import { runTerminationValidationSuite } from "../lib/termination-validation";
import ModuleHeader from "../ui/ModuleHeader/ModuleHeader";

type StoredRecord = {
  id: number;
  module: string;
  title: string;
  reference: string;
  status: string;
  recordDate: string;
  amount: number;
  payload: Record<string, unknown>;
  source: string;
  createdBy: string;
  createdAt: string;
  updatedAt: string;
};

type CompanyParameters = {
  employerInssPercent?: string;
  rat?: string;
  fap?: string;
  thirdPartiesPercent?: string;
};

const currency = new Intl.NumberFormat("pt-BR", {
  style: "currency",
  currency: "BRL",
});

const today = () => new Date().toISOString().slice(0, 10);

const defaultInput: TerminationInput = {
  employeeRecordId: 0,
  employeeName: "",
  employeeCode: "",
  role: "",
  admissionDate: "",
  terminationDate: today(),
  deathDate: "",
  deathKnowledgeDate: "",
  deathRelatedToWork: false,
  catNumber: "",
  deathPaymentRecipient: "DECEASED_CPF",
  contractType: "",
  reciprocalEarlyTerminationClause: false,
  union: "",
  collectiveAgreement: "",
  terminationType: "DISMISSAL_WITHOUT_CAUSE",
  noticeType: "INDEMNIFIED_EMPLOYER",
  noticeDays: 30,
  expectedContractEnd: "",
  baseSalary: 0,
  variableAverage: 0,
  usePayrollAverage: true,
  useCompetencePayrollBase: false,
  historySourceCount: 0,
  dependents: 0,
  unpaidAbsenceDays: 0,
  thirteenthMonthsOverride: null,
  thirteenthNoticeMonthsOverride: null,
  vacationMonthsOverride: null,
  accruedVacationPeriods: 0,
  fgtsBalance: 0,
  otherTaxableEarnings: 0,
  otherNonTaxableEarnings: 0,
  additionalFgtsBase: 0,
  salaryAdvance: 0,
  consignments: 0,
  otherDeductions: 0,
  fixedTermEmployeeDamage: 0,
  priorMonthlyTaxableBase: 0,
  priorMonthlyInss: 0,
  priorMonthlyIrrf: 0,
  priorThirteenthTaxableBase: 0,
  priorThirteenthInss: 0,
  priorThirteenthIrrf: 0,
  fgtsCategory: "STANDARD",
  employerInssPercent: 20,
  ratPercent: 2,
  fapFactor: 1,
  thirdPartiesPercent: 5.8,
  employerParameterSource: "ESTIMATE",
  notes: "",
};

function asObject(value: unknown) {
  return value && typeof value === "object"
    ? (value as Record<string, unknown>)
    : {};
}

function numberValue(value: unknown) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

function employeeCode(record: StoredRecord) {
  return String(record.payload.employeeCode || record.reference);
}

function payrollEmployeeCode(record: StoredRecord) {
  const input = asObject(record.payload.input);
  return String(record.payload.employeeCode || input.employeeCode || "");
}

function payrollCompetence(record: StoredRecord) {
  const input = asObject(record.payload.input);
  return String(
    record.payload.competence || input.competence || record.recordDate,
  ).slice(0, 7);
}

function payrollVariableAmount(record: StoredRecord) {
  const input = asObject(record.payload.input);
  const summary = asObject(record.payload.calculationSummary);
  return (
    numberValue(summary.overtimeAmount) +
    numberValue(summary.additionalAmount) +
    numberValue(input.taxableAdditions)
  );
}

function displayDate(value: string) {
  if (!value) return "—";
  const date = new Date(`${value.slice(0, 10)}T12:00:00`);
  return Number.isNaN(date.getTime())
    ? value
    : date.toLocaleDateString("pt-BR");
}

function noticeDaysFor(admissionDate: string, terminationDate: string) {
  if (!admissionDate || !terminationDate) return 30;
  const admission = new Date(`${admissionDate}T00:00:00Z`);
  const termination = new Date(`${terminationDate}T00:00:00Z`);
  let years = termination.getUTCFullYear() - admission.getUTCFullYear();
  const anniversary = new Date(
    Date.UTC(
      termination.getUTCFullYear(),
      admission.getUTCMonth(),
      admission.getUTCDate(),
    ),
  );
  if (termination < anniversary) years -= 1;
  return Math.min(90, 30 + Math.max(0, years) * 3);
}

function statusClass(status: string) {
  const normalized = status.toLowerCase();
  if (normalized.includes("validada")) return "success";
  if (normalized.includes("cancel")) return "danger";
  return "pending";
}

function recommendedNotice(type: TerminationType): TerminationNoticeType {
  if (
    [
      "DISMISSAL_WITHOUT_CAUSE",
      "INDIRECT_TERMINATION",
      "MUTUAL_AGREEMENT",
    ].includes(type)
  ) {
    return "INDEMNIFIED_EMPLOYER";
  }
  if (["RESIGNATION", "EARLY_EMPLOYEE_FIXED_TERM"].includes(type)) {
    return "WORKED";
  }
  return "NOT_APPLICABLE";
}

export default function TerminationStudio({
  people,
  payrollRecords,
  terminations,
  saving,
  onSave,
  companyProfile,
  canEdit,
  showInternalCodes,
}: {
  people: StoredRecord[];
  payrollRecords: StoredRecord[];
  terminations: StoredRecord[];
  saving: boolean;
  onSave: (input: TerminationInput) => Promise<void>;
  companyProfile: CompanyParameters;
  canEdit: boolean;
  showInternalCodes: boolean;
}) {
  const [input, setInput] = useState<TerminationInput>(() => ({
    ...defaultInput,
  }));
  const [validationSuite, setValidationSuite] = useState(() =>
    runTerminationValidationSuite(),
  );
  const selectedPerson = people.find(
    (person) => person.id === input.employeeRecordId,
  );
  const matchingPayroll = useMemo(
    () =>
      payrollRecords
        .filter(
          (record) =>
            record.payload.recordType !== "BATCH" &&
            payrollEmployeeCode(record) === input.employeeCode,
        )
        .sort((a, b) => b.recordDate.localeCompare(a.recordDate))
        .slice(0, 12),
    [payrollRecords, input.employeeCode],
  );
  const variableHistory = matchingPayroll.map(payrollVariableAmount);
  const payrollAverage = variableHistory.length
    ? variableHistory.reduce((total, value) => total + value, 0) /
      variableHistory.length
    : 0;
  const competenceRecord = matchingPayroll.find(
    (record) =>
      payrollCompetence(record) === input.terminationDate.slice(0, 7),
  );
  const competenceSummary = asObject(
    competenceRecord?.payload.calculationSummary,
  );
  const parseProfile = (value: string | undefined, fallback: number) => {
    const parsed = Number(String(value || "").replace(",", "."));
    return Number.isFinite(parsed) ? parsed : fallback;
  };
  const profileComplete = [
    companyProfile.employerInssPercent,
    companyProfile.rat,
    companyProfile.fap,
    companyProfile.thirdPartiesPercent,
  ].every((value) => String(value || "").trim());
  const calculationInput = useMemo<TerminationInput>(
    () => ({
      ...input,
      variableAverage:
        input.usePayrollAverage && variableHistory.length
          ? payrollAverage
          : input.variableAverage,
      historySourceCount: matchingPayroll.length,
      priorMonthlyTaxableBase:
        input.useCompetencePayrollBase && competenceRecord
          ? numberValue(competenceSummary.taxableGross)
          : input.priorMonthlyTaxableBase,
      priorMonthlyInss:
        input.useCompetencePayrollBase && competenceRecord
          ? numberValue(competenceSummary.inss)
          : input.priorMonthlyInss,
      priorMonthlyIrrf:
        input.useCompetencePayrollBase && competenceRecord
          ? numberValue(competenceSummary.irrf)
          : input.priorMonthlyIrrf,
      employerInssPercent: parseProfile(
        companyProfile.employerInssPercent,
        input.employerInssPercent,
      ),
      ratPercent: parseProfile(companyProfile.rat, input.ratPercent),
      fapFactor: parseProfile(companyProfile.fap, input.fapFactor),
      thirdPartiesPercent: parseProfile(
        companyProfile.thirdPartiesPercent,
        input.thirdPartiesPercent,
      ),
      employerParameterSource: profileComplete
        ? "COMPANY_PROFILE"
        : "ESTIMATE",
    }),
    [
      input,
      variableHistory.length,
      payrollAverage,
      matchingPayroll.length,
      competenceRecord,
      competenceSummary,
      companyProfile,
      profileComplete,
    ],
  );
  const result = useMemo(
    () => calculateTermination(calculationInput),
    [calculationInput],
  );
  const hasCalculationBase = Boolean(
    selectedPerson && input.admissionDate && input.baseSalary,
  );
  const completenessChecks = [
    hasCalculationBase,
    matchingPayroll.length > 0 || !input.usePayrollAverage,
    result.fgtsFinePercent === 0 || input.fgtsBalance > 0,
    profileComplete,
  ];
  const completeness = Math.round(
    (completenessChecks.filter(Boolean).length / completenessChecks.length) *
      100,
  );

  const setNumber = (
    key: keyof TerminationInput,
    value: string,
  ) => {
    setInput((current) => ({
      ...current,
      [key]: value === "" ? 0 : Number(value),
    }));
  };

  const chooseEmployee = (recordId: string) => {
    const person = people.find((record) => String(record.id) === recordId);
    if (!person) {
      setInput((current) => ({
        ...current,
        employeeRecordId: 0,
        employeeName: "",
        employeeCode: "",
        role: "",
        admissionDate: "",
        baseSalary: 0,
      }));
      return;
    }
    const admissionDate = String(person.payload.admissionDate || "");
    const code = employeeCode(person);
    setInput((current) => ({
      ...current,
      employeeRecordId: person.id,
      employeeName: String(person.payload.name || person.title),
      employeeCode: code,
      role: String(person.payload.role || ""),
      admissionDate,
      contractType: String(person.payload.contractType || ""),
      union: String(person.payload.union || ""),
      collectiveAgreement: String(
        person.payload.collectiveAgreement || "",
      ),
      baseSalary: numberValue(person.payload.salary),
      dependents: numberValue(person.payload.dependents),
      fgtsCategory: /aprendiz/i.test(
        String(person.payload.contractType || ""),
      )
        ? "APPRENTICE"
        : "STANDARD",
      noticeDays: noticeDaysFor(
        admissionDate,
        current.terminationDate,
      ),
    }));
  };

  const changeTerminationType = (value: string) => {
    const terminationType = value as TerminationType;
    setInput((current) => ({
      ...current,
      terminationType,
      reciprocalEarlyTerminationClause: false,
      noticeType: recommendedNotice(terminationType),
      noticeDays: [
        "FIXED_TERM_END",
        "EARLY_EMPLOYER_FIXED_TERM",
        "EARLY_EMPLOYEE_FIXED_TERM",
        "DISMISSAL_FOR_CAUSE",
        "EMPLOYEE_DEATH",
      ].includes(terminationType)
        ? 0
        : noticeDaysFor(
            current.admissionDate,
            current.terminationDate,
          ),
      deathDate:
        terminationType === "EMPLOYEE_DEATH"
          ? current.terminationDate
          : "",
      deathKnowledgeDate:
        terminationType === "EMPLOYEE_DEATH"
          ? current.terminationDate
          : "",
      deathRelatedToWork:
        terminationType === "EMPLOYEE_DEATH"
          ? current.deathRelatedToWork
          : false,
      catNumber:
        terminationType === "EMPLOYEE_DEATH"
          ? current.catNumber
          : "",
      deathPaymentRecipient:
        terminationType === "EMPLOYEE_DEATH"
          ? current.deathPaymentRecipient
          : "DECEASED_CPF",
    }));
  };

  const changeEarlyTerminationClause = (checked: boolean) => {
    setInput((current) => {
      const employerInitiated =
        current.terminationType === "EARLY_EMPLOYER_FIXED_TERM";
      return {
        ...current,
        reciprocalEarlyTerminationClause: checked,
        noticeType: checked
          ? employerInitiated
            ? "INDEMNIFIED_EMPLOYER"
            : "WORKED"
          : "NOT_APPLICABLE",
        noticeDays: checked
          ? noticeDaysFor(
              current.admissionDate,
              current.terminationDate,
            )
          : 0,
        fixedTermEmployeeDamage: checked
          ? 0
          : current.fixedTermEmployeeDamage,
      };
    });
  };

  return (
    <div className="page-stack payroll-page termination-page">
      <ModuleHeader
        variant="executive"
        accent="payroll"
        variantClass="payroll-heading termination-heading"
        iconClass="termination-icon"
        iconKind="letter"
        icon="R"
        eyebrow="RH • PRÉVIA RESCISÓRIA"
        title="Rescisão"
        description={
          <>
            Prévia completa por verba, integrada ao cadastro, histórico da
            folha e parâmetros tributários da empresa.
          </>
        }
        actions={
          <div className="payroll-heading-actions">
            <span className="rules-chip">
              Regras {terminationRules2026.version}
            </span>
            <span className="no-transmission-chip">
              Não transmitida
            </span>
          </div>
        }
      />

      <aside className="payroll-legal-note termination-legal-note">
        <span className="termination-alert-symbol">!</span>
        <div>
          <strong>Prévia rígida para conferência — sem envio oficial</strong>
          <p>
            O cálculo não altera o vínculo do funcionário e não envia S-2299,
            guia, CPF ou valores ao governo. O fechamento depende da
            conferência do RH, da contabilidade e dos retornos oficiais.
          </p>
        </div>
      </aside>

      <section
        className="termination-mos-strip"
        aria-label="Conferência operacional do eSocial"
      >
        <article>
          <small>EVENTO DE REFERÊNCIA</small>
          <strong>S-2299 • Desligamento</strong>
          <span>Somente estrutura de prévia</span>
        </article>
        <article>
          <small>MANUAL VIGENTE</small>
          <strong>MOS S-1.3 • NO 11/2026</strong>
          <span>Retificado em 28/05/2026</span>
        </article>
        <article>
          <small>TABELA 19</small>
          <strong>Motivo {result.esocialReasonCode}</strong>
          <span>{terminationTypeLabels[input.terminationType]}</span>
        </article>
        <article>
          <small>PRAZO-BASE OPERACIONAL</small>
          <strong>
            {hasCalculationBase
              ? displayDate(result.esocialDeadlineBaseDate)
              : "Selecione o funcionário"}
          </strong>
          <span>Antecipar se não for dia útil fiscal</span>
        </article>
      </section>

      <section className="termination-sync-grid" aria-label="Integrações da prévia">
        <article className={selectedPerson ? "ready" : "pending"}>
          <small>BASE 1</small>
          <strong>Cadastro de Funcionários</strong>
          <span>
            {selectedPerson
              ? showInternalCodes
                ? `${input.employeeCode} vinculado`
                : "Cadastro vinculado"
              : "Selecione um funcionário"}
          </span>
        </article>
        <article className={matchingPayroll.length ? "ready" : "pending"}>
          <small>BASE 2</small>
          <strong>Cálculo de Folha</strong>
          <span>
            {matchingPayroll.length
              ? `${matchingPayroll.length} cálculo(s) encontrado(s)`
              : "Sem histórico individual"}
          </span>
        </article>
        <article className="future">
          <small>BASE 3</small>
          <strong>Sistema de ponto</strong>
          <span>Conector reservado • nenhum ponto importado</span>
        </article>
        <article className="blocked">
          <small>SAÍDA OFICIAL</small>
          <strong>eSocial / FGTS Digital</strong>
          <span>Bloqueado para transmissão • somente prévia</span>
        </article>
      </section>

      <section className="content-card termination-quality">
        <div>
          <span className="eyebrow">QUALIDADE DA BASE</span>
          <strong>{completeness}% pronta para conferência</strong>
          <small>
            O percentual mede cadastro, histórico, saldo do FGTS e parâmetros
            patronais; não representa homologação legal.
          </small>
        </div>
        <div className="quality-meter" aria-label={`${completeness}% completo`}>
          <span style={{ width: `${completeness}%` }} />
        </div>
        <ul>
          <li className={completenessChecks[0] ? "ok" : ""}>
            Cadastro e salário
          </li>
          <li className={completenessChecks[1] ? "ok" : ""}>
            Histórico de folha
          </li>
          <li className={completenessChecks[2] ? "ok" : ""}>
            Saldo FGTS
          </li>
          <li className={completenessChecks[3] ? "ok" : ""}>
            Regime tributário
          </li>
        </ul>
      </section>

      <section className="content-card termination-validation-lab">
        <div className="card-heading">
          <div>
            <span className="eyebrow">LABORATÓRIO DO MOTOR</span>
            <h2>Dois testes para verificar se o cálculo está funcionando</h2>
            <p>
              O sistema compara resultados esperados com os valores produzidos
              agora pelo mesmo motor usado na prévia rescisória.
            </p>
          </div>
          <div className="termination-test-actions">
            <span
              className={`termination-suite-status ${
                validationSuite.allPassed ? "passed" : "failed"
              }`}
            >
              {validationSuite.passedCases}/{validationSuite.totalCases}{" "}
              cenários aprovados
            </span>
            <button
              type="button"
              className="button secondary termination-test-run"
              onClick={() =>
                setValidationSuite(runTerminationValidationSuite())
              }
            >
              ↻ Executar testes novamente
            </button>
          </div>
        </div>

        <div className="termination-validation-grid">
          {validationSuite.cases.map((testCase) => (
            <article
              className={`termination-test-card ${
                testCase.passed ? "passed" : "failed"
              }`}
              key={testCase.id}
            >
              <header>
                <div>
                  <span className="eyebrow">CENÁRIO FICTÍCIO</span>
                  <h3>{testCase.title}</h3>
                </div>
                <span
                  className={`termination-test-badge ${
                    testCase.passed ? "passed" : "failed"
                  }`}
                >
                  {testCase.passed ? "✓ Aprovado" : "! Divergência"}
                </span>
              </header>
              <p>{testCase.purpose}</p>

              <div className="termination-test-inputs">
                {testCase.inputs.map((item) => (
                  <span key={`${testCase.id}-${item.label}`}>
                    <small>{item.label}</small>
                    <strong>{item.value}</strong>
                  </span>
                ))}
              </div>

              <div className="table-wrap termination-test-table">
                <table>
                  <thead>
                    <tr>
                      <th>Verificação</th>
                      <th>Esperado</th>
                      <th>Calculado</th>
                      <th>Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {testCase.checks.map((check) => (
                      <tr key={check.id}>
                        <td><strong>{check.label}</strong></td>
                        <td>{check.expected}</td>
                        <td>{check.actual}</td>
                        <td>
                          <span
                            className={`termination-check-status ${
                              check.passed ? "passed" : "failed"
                            }`}
                          >
                            {check.passed ? "Confere" : "Revisar"}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </article>
          ))}
        </div>

        <footer className="termination-test-footer">
          <span>Regras {validationSuite.rulesVersion}</span>
          <p>
            Resultado aprovado significa que o motor reproduziu exatamente os
            valores de controle destes dois cenários. Convenções coletivas e
            situações individuais ainda exigem conferência do RH e da
            contabilidade.
          </p>
        </footer>
      </section>

      <div className="payroll-workspace termination-workspace">
        <section className="content-card payroll-form-card">
          <div className="card-heading">
            <div>
              <span className="eyebrow">DADOS INTEGRADOS</span>
              <h2>Funcionário e desligamento</h2>
            </div>
          </div>

          <div className="payroll-form-grid">
            <label className="wide">
              <span>Funcionário do cadastro *</span>
              <select
                value={input.employeeRecordId || ""}
                onChange={(event) => chooseEmployee(event.target.value)}
              >
                <option value="">Selecione para carregar a ficha</option>
                {people.map((person) => (
                  <option key={person.id} value={person.id}>
                    {String(person.payload.name || person.title)}
                    {showInternalCodes ? ` • ${employeeCode(person)}` : ""}
                    {" • "}{person.status}
                  </option>
                ))}
              </select>
              <small>
                Nome, admissão, salário, cargo, dependentes, sindicato e
                contrato são reaproveitados do cadastro.
              </small>
            </label>
            <label>
              <span>Data de admissão</span>
              <input type="date" value={input.admissionDate} readOnly />
            </label>
            <label>
              <span>Salário-base</span>
              <input
                type="number"
                value={input.baseSalary}
                readOnly
              />
            </label>
            <label>
              <span>Data do desligamento *</span>
              <input
                type="date"
                value={input.terminationDate}
                onChange={(event) =>
                  setInput((current) => ({
                    ...current,
                    terminationDate: event.target.value,
                    deathDate:
                      current.terminationType === "EMPLOYEE_DEATH"
                        ? event.target.value
                        : current.deathDate,
                    deathKnowledgeDate:
                      current.terminationType === "EMPLOYEE_DEATH"
                        ? event.target.value
                        : current.deathKnowledgeDate,
                    noticeDays: noticeDaysFor(
                      current.admissionDate,
                      event.target.value,
                    ),
                  }))
                }
              />
            </label>
            <label>
              <span>Motivo do desligamento *</span>
              <select
                value={input.terminationType}
                onChange={(event) =>
                  changeTerminationType(event.target.value)
                }
              >
                {Object.entries(terminationTypeLabels).map(
                  ([value, label]) => (
                    <option key={value} value={value}>
                      {label}
                    </option>
                  ),
                )}
              </select>
              <small>
                Código indicativo do S-2299: {result.esocialReasonCode}
              </small>
            </label>
            {input.terminationType === "EMPLOYEE_DEATH" ? (
              <>
                <label>
                  <span>Data do óbito *</span>
                  <input
                    type="date"
                    value={input.deathDate}
                    onChange={(event) =>
                      setInput((current) => ({
                        ...current,
                        deathDate: event.target.value,
                        terminationDate: event.target.value,
                        deathKnowledgeDate:
                          !current.deathKnowledgeDate ||
                          current.deathKnowledgeDate ===
                            current.deathDate
                            ? event.target.value
                            : current.deathKnowledgeDate,
                      }))
                    }
                  />
                  <small>
                    Deve coincidir com a data do desligamento na prévia.
                  </small>
                </label>
                <label>
                  <span>Ciência da empresa sobre o óbito *</span>
                  <input
                    type="date"
                    min={input.deathDate || undefined}
                    value={input.deathKnowledgeDate}
                    onChange={(event) =>
                      setInput((current) => ({
                        ...current,
                        deathKnowledgeDate: event.target.value,
                      }))
                    }
                  />
                  <small>
                    Se a ciência foi posterior, o MOS conta o prazo a
                    partir desta data.
                  </small>
                </label>
                <label>
                  <span>Destinação prevista do pagamento</span>
                  <select
                    value={input.deathPaymentRecipient}
                    onChange={(event) =>
                      setInput((current) => ({
                        ...current,
                        deathPaymentRecipient:
                          event.target.value === "SUCCESSORS"
                            ? "SUCCESSORS"
                            : "DECEASED_CPF",
                      }))
                    }
                  >
                    <option value="DECEASED_CPF">
                      CPF do empregado falecido
                    </option>
                    <option value="SUCCESSORS">
                      Sucessores / beneficiários habilitados
                    </option>
                  </select>
                  <small>
                    Define a prévia de indApurIR e o evento de pagamento;
                    nenhum dado será enviado.
                  </small>
                </label>
                <label className="termination-toggle compact-toggle">
                  <input
                    type="checkbox"
                    checked={input.deathRelatedToWork}
                    onChange={(event) =>
                      setInput((current) => ({
                        ...current,
                        deathRelatedToWork: event.target.checked,
                      }))
                    }
                  />
                  <span>
                    <strong>Relacionado a acidente de trabalho</strong>
                    <small>Identificação para conferência da CAT.</small>
                  </span>
                </label>
                {input.deathRelatedToWork ? (
                  <label>
                    <span>Número / referência da CAT</span>
                    <input
                      value={input.catNumber}
                      onChange={(event) =>
                        setInput((current) => ({
                          ...current,
                          catNumber: event.target.value,
                        }))
                      }
                    />
                  </label>
                ) : null}
              </>
            ) : null}
            <label>
              <span>Modalidade do aviso</span>
              <select
                value={input.noticeType}
                onChange={(event) =>
                  setInput((current) => ({
                    ...current,
                    noticeType: event.target
                      .value as TerminationNoticeType,
                  }))
                }
              >
                {Object.entries(terminationNoticeLabels).map(
                  ([value, label]) => (
                    <option key={value} value={value}>
                      {label}
                    </option>
                  ),
                )}
              </select>
            </label>
            <label>
              <span>Dias de aviso</span>
              <input
                type="number"
                min="0"
                max="90"
                value={input.noticeDays}
                onChange={(event) =>
                  setNumber("noticeDays", event.target.value)
                }
              />
              <small>30 dias + 3 por ano completo, limitado a 90.</small>
            </label>
            {[
              "EARLY_EMPLOYER_FIXED_TERM",
              "EARLY_EMPLOYEE_FIXED_TERM",
            ].includes(input.terminationType) ? (
              <>
                <label>
                  <span>Término previsto do contrato</span>
                  <input
                    type="date"
                    min={input.terminationDate || undefined}
                    value={input.expectedContractEnd}
                    onChange={(event) =>
                      setInput((current) => ({
                        ...current,
                        expectedContractEnd: event.target.value,
                      }))
                    }
                  />
                </label>
                <label className="termination-toggle compact-toggle">
                  <input
                    type="checkbox"
                    checked={input.reciprocalEarlyTerminationClause}
                    onChange={(event) =>
                      changeEarlyTerminationClause(
                        event.target.checked,
                      )
                    }
                  />
                  <span>
                    <strong>Cláusula assecuratória recíproca</strong>
                    <small>
                      Converte o motivo e aplica aviso conforme item 6.1
                      do S-2299 no MOS.
                    </small>
                  </span>
                </label>
              </>
            ) : null}
          </div>

          <div className="payroll-section-title">
            <strong>Remuneração e sincronização</strong>
            <small>Médias variáveis e bases já processadas</small>
          </div>
          <div className="termination-toggle-grid">
            <label className="termination-toggle">
              <input
                type="checkbox"
                checked={input.usePayrollAverage}
                onChange={(event) =>
                  setInput((current) => ({
                    ...current,
                    usePayrollAverage: event.target.checked,
                  }))
                }
              />
              <span>
                <strong>Usar média do Cálculo de Folha</strong>
                <small>
                  {variableHistory.length
                    ? `${variableHistory.length} competência(s) • ${currency.format(payrollAverage)}`
                    : "Nenhuma competência individual disponível"}
                </small>
              </span>
            </label>
            <label className="termination-toggle">
              <input
                type="checkbox"
                checked={input.useCompetencePayrollBase}
                disabled={!competenceRecord}
                onChange={(event) =>
                  setInput((current) => ({
                    ...current,
                    useCompetencePayrollBase: event.target.checked,
                  }))
                }
              />
              <span>
                <strong>Considerar folha já calculada no mês</strong>
                <small>
                  {competenceRecord
                    ? `Prévia ${payrollCompetence(competenceRecord)} encontrada`
                    : "Nenhuma prévia na competência do desligamento"}
                </small>
              </span>
            </label>
          </div>
          <div className="payroll-form-grid">
            <label>
              <span>Média variável aplicada</span>
              <input
                type="number"
                min="0"
                step="0.01"
                value={calculationInput.variableAverage}
                readOnly={
                  input.usePayrollAverage && variableHistory.length > 0
                }
                onChange={(event) =>
                  setNumber("variableAverage", event.target.value)
                }
              />
            </label>
            <label>
              <span>Faltas sem remuneração no mês</span>
              <input
                type="number"
                min="0"
                max="30"
                value={input.unpaidAbsenceDays}
                onChange={(event) =>
                  setNumber("unpaidAbsenceDays", event.target.value)
                }
              />
            </label>
            <label>
              <span>Outras verbas tributáveis</span>
              <input
                type="number"
                min="0"
                step="0.01"
                value={input.otherTaxableEarnings}
                onChange={(event) =>
                  setNumber("otherTaxableEarnings", event.target.value)
                }
              />
            </label>
            <label>
              <span>Outras verbas não tributáveis</span>
              <input
                type="number"
                min="0"
                step="0.01"
                value={input.otherNonTaxableEarnings}
                onChange={(event) =>
                  setNumber(
                    "otherNonTaxableEarnings",
                    event.target.value,
                  )
                }
              />
            </label>
          </div>

          <div className="payroll-section-title">
            <strong>Direitos proporcionais e FGTS</strong>
            <small>Avos automáticos com substituição auditável</small>
          </div>
          <div className="payroll-form-grid">
            <label>
              <span>Períodos de férias vencidas</span>
              <input
                type="number"
                min="0"
                max="10"
                value={input.accruedVacationPeriods}
                onChange={(event) =>
                  setNumber(
                    "accruedVacationPeriods",
                    event.target.value,
                  )
                }
              />
            </label>
            <label>
              <span>Avos de 13º sem projeção</span>
              <div className="override-field">
                <input
                  type="number"
                  min="0"
                  max="12"
                  placeholder={`${result.thirteenthBaseMonths} automático`}
                  value={input.thirteenthMonthsOverride ?? ""}
                  onChange={(event) =>
                    setInput((current) => ({
                      ...current,
                      thirteenthMonthsOverride:
                        event.target.value === ""
                          ? null
                          : Number(event.target.value),
                    }))
                  }
                />
                <button
                  type="button"
                  onClick={() =>
                    setInput((current) => ({
                      ...current,
                      thirteenthMonthsOverride: null,
                    }))
                  }
                >
                  Automático
                </button>
              </div>
            </label>
            <label>
              <span>Avos de 13º sobre aviso</span>
              <div className="override-field">
                <input
                  type="number"
                  min="0"
                  max="12"
                  placeholder={`${result.thirteenthNoticeMonths} automático`}
                  value={input.thirteenthNoticeMonthsOverride ?? ""}
                  disabled={result.noticeProjectionDays === 0}
                  onChange={(event) =>
                    setInput((current) => ({
                      ...current,
                      thirteenthNoticeMonthsOverride:
                        event.target.value === ""
                          ? null
                          : Number(event.target.value),
                    }))
                  }
                />
                <button
                  type="button"
                  disabled={result.noticeProjectionDays === 0}
                  onClick={() =>
                    setInput((current) => ({
                      ...current,
                      thirteenthNoticeMonthsOverride: null,
                    }))
                  }
                >
                  Automático
                </button>
              </div>
              <small>Separado na natureza eSocial 6001.</small>
            </label>
            <label>
              <span>Avos de férias</span>
              <div className="override-field">
                <input
                  type="number"
                  min="0"
                  max="12"
                  placeholder={`${result.vacationMonths} automático`}
                  value={input.vacationMonthsOverride ?? ""}
                  onChange={(event) =>
                    setInput((current) => ({
                      ...current,
                      vacationMonthsOverride:
                        event.target.value === ""
                          ? null
                          : Number(event.target.value),
                    }))
                  }
                />
                <button
                  type="button"
                  onClick={() =>
                    setInput((current) => ({
                      ...current,
                      vacationMonthsOverride: null,
                    }))
                  }
                >
                  Automático
                </button>
              </div>
            </label>
            <label>
              <span>Saldo oficial do FGTS para rescisão</span>
              <input
                type="number"
                min="0"
                step="0.01"
                value={input.fgtsBalance}
                onChange={(event) =>
                  setNumber("fgtsBalance", event.target.value)
                }
              />
              <small>
                Informe o saldo conferido no FGTS Digital/CAIXA.
              </small>
            </label>
            <label>
              <span>Base adicional de FGTS</span>
              <input
                type="number"
                min="0"
                step="0.01"
                value={input.additionalFgtsBase}
                onChange={(event) =>
                  setNumber("additionalFgtsBase", event.target.value)
                }
              />
            </label>
          </div>

          <div className="payroll-section-title">
            <strong>Descontos</strong>
            <small>Somente valores autorizados e comprovados</small>
          </div>
          <div className="payroll-form-grid">
            {[
              ["salaryAdvance", "Adiantamento salarial"],
              ["consignments", "Consignados e convênios"],
              ["otherDeductions", "Outros descontos"],
            ].map(([key, label]) => (
              <label key={key}>
                <span>{label}</span>
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  value={
                    input[key as keyof TerminationInput] as number
                  }
                  onChange={(event) =>
                    setNumber(
                      key as keyof TerminationInput,
                      event.target.value,
                    )
                  }
                />
              </label>
            ))}
            {input.terminationType ===
            "EARLY_EMPLOYEE_FIXED_TERM" ? (
              <label>
                <span>Dano comprovado — contrato a prazo</span>
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  value={input.fixedTermEmployeeDamage}
                  onChange={(event) =>
                    setNumber(
                      "fixedTermEmployeeDamage",
                      event.target.value,
                    )
                  }
                />
                <small>Não é presumido: exige prova e limite legal.</small>
              </label>
            ) : null}
          </div>

          <details className="advanced-payroll termination-advanced">
            <summary>Bases acumuladas, 13º adiantado e encargos patronais</summary>
            <div className="payroll-form-grid">
              {[
                [
                  "priorMonthlyTaxableBase",
                  "Base mensal já processada",
                ],
                ["priorMonthlyInss", "INSS mensal já retido"],
                ["priorMonthlyIrrf", "IRRF mensal já retido"],
                [
                  "priorThirteenthTaxableBase",
                  "Base de 13º já processada",
                ],
                ["priorThirteenthInss", "INSS do 13º já retido"],
                ["priorThirteenthIrrf", "IRRF do 13º já retido"],
                ["employerInssPercent", "Contribuição patronal (%)"],
                ["ratPercent", "RAT básico (%)"],
                ["fapFactor", "FAP"],
                ["thirdPartiesPercent", "Outras entidades e fundos (%)"],
              ].map(([key, label]) => {
                const synced =
                  input.useCompetencePayrollBase &&
                  Boolean(competenceRecord) &&
                  [
                    "priorMonthlyTaxableBase",
                    "priorMonthlyInss",
                    "priorMonthlyIrrf",
                  ].includes(key);
                const fromProfile = profileComplete &&
                  [
                    "employerInssPercent",
                    "ratPercent",
                    "fapFactor",
                    "thirdPartiesPercent",
                  ].includes(key);
                return (
                  <label key={key}>
                    <span>{label}</span>
                    <input
                      type="number"
                      min="0"
                      step="0.01"
                      value={
                        calculationInput[
                          key as keyof TerminationInput
                        ] as number
                      }
                      readOnly={synced || fromProfile}
                      onChange={(event) =>
                        setNumber(
                          key as keyof TerminationInput,
                          event.target.value,
                        )
                      }
                    />
                    {synced ? <small>Sincronizado da prévia mensal.</small> : null}
                    {fromProfile ? <small>Carregado do Regime Tributário.</small> : null}
                  </label>
                );
              })}
            </div>
          </details>

          <label className="termination-notes">
            <span>Justificativas e observações da prévia</span>
            <textarea
              rows={4}
              value={input.notes}
              onChange={(event) =>
                setInput((current) => ({
                  ...current,
                  notes: event.target.value,
                }))
              }
              placeholder="Registre decisões manuais, documentos faltantes, estabilidade, CCT e demais conferências."
            />
          </label>
        </section>

        <section className="content-card payroll-result-card termination-result-card">
          <div className="card-heading">
            <div>
              <span className="eyebrow">RESULTADO EM TEMPO REAL</span>
              <h2>Resumo da prévia</h2>
            </div>
          </div>
          <div className="termination-person-summary">
            <strong>{input.employeeName || "Funcionário não selecionado"}</strong>
            <span>{input.role || "Cargo não cadastrado"}</span>
            <small>
              Admissão {displayDate(input.admissionDate)} • projeção{" "}
              {hasCalculationBase
                ? displayDate(result.projectedTerminationDate)
                : "—"}
            </small>
          </div>
          <div className="payroll-summary-grid">
            <article>
              <span>Total bruto</span>
              <strong>{currency.format(result.gross)}</strong>
            </article>
            <article>
              <span>INSS</span>
              <strong>
                - {currency.format(result.inssSalary + result.inssThirteenth)}
              </strong>
            </article>
            <article>
              <span>IRRF</span>
              <strong>
                - {currency.format(result.irrfSalary + result.irrfThirteenth)}
              </strong>
            </article>
            <article>
              <span>Outros descontos</span>
              <strong>
                -{" "}
                {currency.format(
                  Math.max(
                    0,
                    result.totalDeductions -
                      result.inssSalary -
                      result.inssThirteenth -
                      result.irrfSalary -
                      result.irrfThirteenth,
                  ),
                )}
              </strong>
            </article>
            <article className="net-result">
              <span>Líquido rescisório estimado</span>
              <strong>{currency.format(result.net)}</strong>
            </article>
          </div>
          <div className="employer-cost">
            <div>
              <span>FGTS rescisório</span>
              <strong>{currency.format(result.fgtsSeveranceDeposit)}</strong>
            </div>
            <div>
              <span>Indenização do FGTS</span>
              <strong>{currency.format(result.fgtsFine)}</strong>
              <small>{result.fgtsFinePercent * 100}% nesta modalidade</small>
            </div>
            <div>
              <span>Encargos patronais</span>
              <strong>{currency.format(result.employerSocialCharges)}</strong>
            </div>
            <div className="total-cost">
              <span>Custo estimado da empresa</span>
              <strong>{currency.format(result.employerCost)}</strong>
            </div>
          </div>
          <div className="termination-facts">
            <span>
              <small>Saldo</small>
              <strong>
                {hasCalculationBase
                  ? `${result.salaryBalanceDays} dias`
                  : "—"}
              </strong>
            </span>
            <span>
              <small>13º</small>
              <strong>
                {hasCalculationBase
                  ? `${result.thirteenthBaseMonths}/12 + ${result.thirteenthNoticeMonths}/12 aviso`
                  : "—"}
              </strong>
            </span>
            <span>
              <small>Férias</small>
              <strong>
                {hasCalculationBase
                  ? `${result.vacationMonths}/12`
                  : "—"}
              </strong>
            </span>
            <span>
              <small>Aviso / projeção</small>
              <strong>
                {hasCalculationBase
                  ? `${result.noticeDays} / ${result.noticeProjectionDays} dias`
                  : "—"}
              </strong>
            </span>
          </div>
          <div className="termination-esocial-facts">
            <span>
              <small>Motivo S-2299</small>
              <strong>{result.esocialReasonCode}</strong>
            </span>
            <span>
              <small>indApurIR</small>
              <strong>{result.esocialIndApurIR}</strong>
            </span>
            <span>
              <small>Pagamento futuro</small>
              <strong>{result.esocialPaymentEvent}</strong>
            </span>
            <span>
              <small>Prazo-base de pagamento</small>
              <strong>
                {hasCalculationBase
                  ? displayDate(result.paymentDeadlineBaseDate)
                  : "—"}
              </strong>
            </span>
          </div>
          {canEdit ? (
            <button
              className="button primary payroll-save termination-save"
              disabled={
                saving ||
                !input.employeeRecordId ||
                !input.admissionDate ||
                !input.baseSalary ||
                input.terminationDate < input.admissionDate
              }
              onClick={() => onSave(calculationInput)}
            >
              {saving
                ? "Reprocessando no servidor…"
                : "Salvar prévia para conferência"}
            </button>
          ) : (
            <div className="read-only-inline">
              A prévia pode ser testada. Somente o administrador pode salvá-la.
            </div>
          )}
          <small className="termination-save-note">
            Salvar não desliga o funcionário e não transmite dados.
          </small>
        </section>
      </div>

      <section className="content-card payroll-memory payment-statement termination-memory">
        <div className="card-heading">
          <div>
            <span className="eyebrow">MEMÓRIA DA PRÉVIA</span>
            <h2>
              Rescisão • {displayDate(input.terminationDate)}
              {showInternalCodes && input.employeeCode
                ? ` • ${input.employeeCode}`
                : ""}
            </h2>
          </div>
          <div className="statement-legend">
            <span className="earning">Créditos</span>
            <span className="deduction">Descontos</span>
            <span className="employer">Empresa / FGTS</span>
          </div>
        </div>
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                {showInternalCodes ? <th>ID</th> : null}
                <th>Natureza eSocial</th>
                <th>Descrição</th>
                <th>Referência</th>
                <th>CP</th>
                <th>IRRF</th>
                <th>FGTS</th>
                <th>Origem</th>
                <th>Base</th>
                <th>Valor</th>
              </tr>
            </thead>
            <tbody>
              {!hasCalculationBase ? (
                <tr>
                  <td
                    colSpan={showInternalCodes ? 10 : 9}
                    className="termination-table-empty"
                  >
                    Selecione um funcionário para gerar a memória de
                    cálculo e a matriz de incidências.
                  </td>
                </tr>
              ) : result.lines.map((item) => (
                <tr
                  key={item.code}
                  className={`statement-row ${
                    item.kind === "earning"
                      ? "earning"
                      : item.kind === "deduction"
                        ? "deduction"
                        : "employer"
                  }`}
                >
                  {showInternalCodes ? <td>{item.code}</td> : null}
                  <td>
                    <strong>{item.esocialNatureCode}</strong>
                    <small
                      className={`mapping-status ${item.mappingStatus.toLowerCase()}`}
                    >
                      {item.mappingStatus === "MAPPED"
                        ? "Mapeada"
                        : item.mappingStatus === "REVIEW"
                          ? "Revisar"
                          : "Totalizador"}
                    </small>
                  </td>
                  <td><strong>{item.label}</strong></td>
                  <td>{item.reference}</td>
                  <td>{item.codIncCP}</td>
                  <td>{item.codIncIRRF}</td>
                  <td>{item.codIncFGTS}</td>
                  <td>{item.esocialOrigin}</td>
                  <td>{item.base ? currency.format(item.base) : "—"}</td>
                  <td>{currency.format(item.amount)}</td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr>
                <td colSpan={showInternalCodes ? 7 : 6}>
                  <strong>Totais da prévia</strong>
                </td>
                <td>Bruto {currency.format(result.gross)}</td>
                <td>Descontos {currency.format(result.totalDeductions)}</td>
                <td><strong>Líquido {currency.format(result.net)}</strong></td>
              </tr>
            </tfoot>
          </table>
        </div>
        <details className="statement-rules">
          <summary>Ver critério aplicado em cada verba</summary>
          <div>
            {(hasCalculationBase ? result.lines : []).map((item) => (
              <p key={item.code}>
                <strong>
                  {showInternalCodes ? `${item.code} • ` : ""}
                  natureza {item.esocialNatureCode} •{" "}
                  {item.label}:
                </strong>{" "}
                {item.note}
              </p>
            ))}
          </div>
        </details>
        <div className="payroll-warnings">
          {result.warnings.map((warning) => (
            <p key={warning}>
              <strong>Conferir:</strong> {warning}
            </p>
          ))}
        </div>
      </section>

      <section className="content-card termination-official-sources">
        <div className="card-heading">
          <div>
            <span className="eyebrow">CONFERÊNCIAS EXTERNAS</span>
            <h2>Fontes oficiais — acesso manual e seguro</h2>
          </div>
        </div>
        <div>
          {terminationRules2026.sources.map((source) => (
            <a
              key={source.url}
              href={source.url}
              target="_blank"
              rel="noreferrer"
            >
              <strong>{source.label}</strong>
              <small>Abrir portal oficial ↗</small>
            </a>
          ))}
        </div>
        <p>
          Os portais podem exigir login, certificado digital, cookies ou
          validação humana. O Beta Gestão 365 não reutiliza credenciais e não
          contorna controles de acesso.
        </p>
      </section>

      <section className="content-card saved-previews">
        <div className="card-heading">
          <div>
            <span className="eyebrow">HISTÓRICO AUDITÁVEL</span>
            <h2>Prévias rescisórias salvas</h2>
          </div>
          <span className="soft-badge">{terminations.length} registros</span>
        </div>
        {terminations.length ? (
          <div className="preview-list">
            {terminations.slice(0, 8).map((record) => (
              <article key={record.id}>
                <span>
                  <strong>{record.title}</strong>
                  <small>
                    {String(
                      record.payload.terminationTypeLabel ||
                        "Prévia rescisória",
                    )}
                    {" • "}
                    {displayDate(record.recordDate)}
                  </small>
                </span>
                <span>
                  <small>Líquido estimado</small>
                  <strong>
                    {currency.format(
                      Number(record.payload.netAmount || record.amount),
                    )}
                  </strong>
                </span>
                <span className={`status-pill ${statusClass(record.status)}`}>
                  {record.status}
                </span>
              </article>
            ))}
          </div>
        ) : (
          <div className="card-empty compact">
            <strong>Nenhuma prévia rescisória salva</strong>
            <p>
              Selecione um funcionário, confira as bases e salve para iniciar o
              histórico.
            </p>
          </div>
        )}
      </section>
    </div>
  );
}
