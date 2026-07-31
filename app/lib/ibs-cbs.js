/**
 * Motor técnico de IBS/CBS para o período de testes de 2026.
 * As alíquotas permanecem parametrizáveis e as rotinas não transmitem
 * obrigações fiscais nem substituem validação contábil.
 */

export const IBS_CBS_RULES_VERSION = "BR-RTC-2026.2-NT2025.002-v1.40";
export const IBS_CBS_DEFAULTS = Object.freeze({
  effectiveFrom: "2026-01-01",
  effectiveTo: "2026-12-31",
  // Em 2026, a NT 2025.002 v1.40 atribui 0,1% ao IBS da UF e 0% ao
  // IBS municipal. A divisão 0,05% + 0,05% passa a valer em 2027/2028.
  ibsStateRate: 0.1,
  ibsMunicipalRate: 0,
  ibsRate: 0.1,
  cbsRate: 0.9,
  testYear: 2026,
});

const number = (value) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
};

export const roundMoney = (value) =>
  Math.round((number(value) + Number.EPSILON) * 100) / 100;

export const roundRate = (value) =>
  Math.round((number(value) + Number.EPSILON) * 1000000) / 1000000;

export function normalizeCompetence(value) {
  const text = String(value || "").trim();
  const match = text.match(/^(\d{4})-(\d{2})/);
  return match ? `${match[1]}-${match[2]}` : "";
}

export function isValidFiscalKey(value) {
  const digits = String(value || "").replace(/\D/g, "");
  return digits.length === 44;
}

export function isValidIbsCbsCst(value) {
  return /^\d{3}$/.test(String(value || "").trim());
}

export function isValidCClassTrib(value) {
  return /^\d{6}$/.test(String(value || "").trim());
}

export function isCompatibleCstAndCClassTrib(cst, cClassTrib) {
  const normalizedCst = String(cst || "").trim();
  const normalizedClass = String(cClassTrib || "").trim();
  return (
    isValidIbsCbsCst(normalizedCst) &&
    isValidCClassTrib(normalizedClass) &&
    normalizedClass.startsWith(normalizedCst)
  );
}
export function isIbsCbsApplicable(config = {}, reference = "") {
  const regime = String(config.regime || "Regime regular").trim().toLowerCase();
  const competence = normalizeCompetence(reference);
  const referenceDate = String(reference || "").match(/^\d{4}-\d{2}-\d{2}$/)
    ? String(reference)
    : competence
      ? `${competence}-01`
      : new Date().toISOString().slice(0, 10);
  const effectiveFrom = String(config.effectiveFrom || IBS_CBS_DEFAULTS.effectiveFrom);
  const effectiveTo = String(config.effectiveTo || "");
  const enabled = config.incidenceEnabled !== false && Number(config.incidenceEnabled) !== 0;
  const inVigency = (!effectiveFrom || referenceDate >= effectiveFrom) && (!effectiveTo || referenceDate <= effectiveTo);
  const simplified2026 = referenceDate.startsWith("2026-") && (regime.includes("simples") || regime.includes("mei"));
  return enabled && inVigency && !simplified2026;
}

export function ibsCbsApplicabilityReason(config = {}, reference = "") {
  const competence = normalizeCompetence(reference);
  const referenceDate = String(reference || "").match(/^\d{4}-\d{2}-\d{2}$/)
    ? String(reference)
    : competence
      ? `${competence}-01`
      : new Date().toISOString().slice(0, 10);
  const regime = String(config.regime || "Regime regular");
  if (config.incidenceEnabled === false || Number(config.incidenceEnabled) === 0) return "Incidência desativada na configuração vigente.";
  if (referenceDate.startsWith("2026-") && /simples|mei/i.test(regime)) return "A alíquota de teste de 2026 não se aplica ao Simples Nacional/MEI.";
  if (config.effectiveFrom && referenceDate < String(config.effectiveFrom)) return "Documento anterior ao início da vigência configurada.";
  if (config.effectiveTo && referenceDate > String(config.effectiveTo)) return "Documento posterior ao fim da vigência configurada.";
  return "IBS/CBS aplicável conforme a configuração vigente.";
}

export function calculateIbsCbs(input = {}) {
  const operationValue = Math.max(0, number(input.operationValue));
  const reductionPercent = Math.min(100, Math.max(0, number(input.reductionPercent)));
  const defermentPercent = Math.min(100, Math.max(0, number(input.defermentPercent)));
  const baseBeforeReduction = operationValue;
  const reductionAmount = roundMoney(baseBeforeReduction * (reductionPercent / 100));
  const taxableBase = roundMoney(baseBeforeReduction - reductionAmount);

  const hasValue = (key) =>
    Object.prototype.hasOwnProperty.call(input, key) &&
    input[key] !== "" &&
    input[key] !== null &&
    input[key] !== undefined;
  const applicable = input.applicable !== false && input.incidenceEnabled !== false && Number(input.incidenceEnabled ?? 1) !== 0;
  const informedTotalIbsRate = hasValue("ibsRate") ? number(input.ibsRate) : null;
  const ibsStateRate = roundRate(
    applicable
      ? hasValue("ibsStateRate")
        ? number(input.ibsStateRate)
        : informedTotalIbsRate !== null
          ? informedTotalIbsRate / 2
          : IBS_CBS_DEFAULTS.ibsStateRate
      : 0,
  );
  const ibsMunicipalRate = roundRate(
    applicable
      ? hasValue("ibsMunicipalRate")
        ? number(input.ibsMunicipalRate)
        : informedTotalIbsRate !== null
          ? informedTotalIbsRate / 2
          : IBS_CBS_DEFAULTS.ibsMunicipalRate
      : 0,
  );
  const ibsRate = roundRate(ibsStateRate + ibsMunicipalRate);
  const cbsRate = roundRate(
    applicable
      ? hasValue("cbsRate")
        ? number(input.cbsRate)
        : IBS_CBS_DEFAULTS.cbsRate
      : 0,
  );

  const ibsBeforeDeferment = roundMoney(taxableBase * (ibsRate / 100));
  const cbsBeforeDeferment = roundMoney(taxableBase * (cbsRate / 100));
  const ibsDeferred = roundMoney(ibsBeforeDeferment * (defermentPercent / 100));
  const cbsDeferred = roundMoney(cbsBeforeDeferment * (defermentPercent / 100));
  const ibsAmount = roundMoney(ibsBeforeDeferment - ibsDeferred);
  const cbsAmount = roundMoney(cbsBeforeDeferment - cbsDeferred);
  const totalAmount = roundMoney(ibsAmount + cbsAmount);
  const direction = input.direction === "outgoing" ? "outgoing" : "incoming";
  const creditEligible =
    Boolean(input.creditEligible) &&
    input.creditEnabled !== false &&
    Number(input.creditEnabled ?? 1) !== 0 &&
    applicable;
  const presumedCredit = applicable ? roundMoney(Math.max(0, number(input.presumedCredit))) : 0;
  const potentialCredit = roundMoney(totalAmount + presumedCredit);
  const creditAmount = direction === "incoming" && creditEligible ? potentialCredit : 0;
  const blockedCredit = direction === "incoming" && !creditEligible ? potentialCredit : 0;
  const blockedCreditReason = blockedCredit > 0
    ? String(input.blockedCreditReason || (applicable ? "Direito a crédito não confirmado." : "IBS/CBS não aplicável à operação."))
    : "";

  return {
    rulesVersion: IBS_CBS_RULES_VERSION,
    applicable,
    testPeriod: normalizeCompetence(input.competence).startsWith("2026-") || !input.competence,
    direction,
    operationValue: roundMoney(operationValue),
    baseBeforeReduction: roundMoney(baseBeforeReduction),
    reductionPercent: roundRate(reductionPercent),
    reductionAmount,
    taxableBase,
    defermentPercent: roundRate(defermentPercent),
    ibsStateRate,
    ibsMunicipalRate,
    ibsRate,
    cbsRate,
    ibsBeforeDeferment,
    cbsBeforeDeferment,
    ibsDeferred,
    cbsDeferred,
    ibsAmount,
    cbsAmount,
    totalAmount,
    creditEligible,
    presumedCredit,
    potentialCredit,
    creditAmount: roundMoney(creditAmount),
    blockedCredit: roundMoney(blockedCredit),
    blockedCreditReason,
    warnings: applicable
      ? [
          "Simulação administrativa: validar CST, cClassTrib, enquadramento, benefícios e direito a crédito com a contabilidade.",
          "Em 2026, os valores são tratados como período de testes e não geram transmissão ou pagamento automático por este sistema.",
        ]
      : ["Operação marcada como não aplicável ao IBS/CBS na vigência consultada."],
  };
}

export function validateFiscalDocument(document = {}, config = IBS_CBS_DEFAULTS, duplicateKeys = []) {
  const issues = [];
  const critical = (code, message, field) =>
    issues.push({ code, severity: "critical", message, field });
  const warning = (code, message, field) =>
    issues.push({ code, severity: "warning", message, field });

  const direction = document.direction === "outgoing" ? "outgoing" : "incoming";
  const key = String(document.fiscalKey || "").trim();
  const operationValue = number(document.operationValue);
  const competence = normalizeCompetence(document.competence || document.issueDate);
  const applicable = isIbsCbsApplicable(config, document.issueDate || competence);
  const hasValue = (key) => Object.prototype.hasOwnProperty.call(document, key) && document[key] !== "" && document[key] !== null && document[key] !== undefined;
  const calculation = calculateIbsCbs({
    ...document,
    direction,
    competence,
    applicable,
    incidenceEnabled: applicable,
    creditEnabled: config.creditEnabled,
    reductionPercent: hasValue("reductionPercent")
      ? document.reductionPercent
      : config.reductionPercent,
    defermentPercent: hasValue("defermentPercent")
      ? document.defermentPercent
      : config.defermentPercent,
    ibsStateRate: hasValue("ibsStateRate") ? number(document.ibsStateRate) : number(config.ibsStateRate),
    ibsMunicipalRate: hasValue("ibsMunicipalRate") ? number(document.ibsMunicipalRate) : number(config.ibsMunicipalRate),
    cbsRate: hasValue("cbsRate") ? number(document.cbsRate) : number(config.cbsRate),
  });

  if (!key) critical("FISCAL_KEY_MISSING", "Chave do documento fiscal não informada.", "fiscalKey");
  else if (!isValidFiscalKey(key)) critical("FISCAL_KEY_INVALID", "A chave fiscal deve possuir 44 dígitos.", "fiscalKey");
  if (key && duplicateKeys.includes(key.replace(/\D/g, ""))) {
    critical("DUPLICATE_DOCUMENT", "Documento fiscal duplicado para a mesma empresa.", "fiscalKey");
  }
  if (applicable) {
    const cst = String(document.cst || "").trim();
    const cClassTrib = String(document.cClassTrib || "").trim();
    if (!cst) critical("CST_MISSING", "CST IBS/CBS obrigatório.", "cst");
    else if (!isValidIbsCbsCst(cst)) {
      critical("CST_FORMAT_INVALID", "O CST IBS/CBS deve possuir exatamente 3 dígitos.", "cst");
    }
    if (!cClassTrib) critical("CCLASSTRIB_MISSING", "cClassTrib obrigatório.", "cClassTrib");
    else if (!isValidCClassTrib(cClassTrib)) {
      critical("CCLASSTRIB_FORMAT_INVALID", "O cClassTrib deve possuir exatamente 6 dígitos.", "cClassTrib");
    } else if (isValidIbsCbsCst(cst) && !isCompatibleCstAndCClassTrib(cst, cClassTrib)) {
      critical(
        "CCLASSTRIB_CST_MISMATCH",
        "Os 3 primeiros dígitos do cClassTrib devem ser idênticos ao CST IBS/CBS.",
        "cClassTrib",
      );
    }
    if (!String(document.itemCode || "").trim()) critical("ITEM_CODE_MISSING", "Informe NCM, NBS ou código do serviço.", "itemCode");
  }
  if (!String(document.supplierTaxRegime || "").trim()) warning("SUPPLIER_REGIME_MISSING", "Regime tributário do fornecedor não informado.", "supplierTaxRegime");
  if (!String(document.work || "").trim() && !String(document.costCenter || "").trim()) {
    warning("COST_ALLOCATION_MISSING", "Documento sem obra ou centro de custo.", "work");
  }
  if (!String(document.documentUrl || "").trim()) warning("EVIDENCE_MISSING", "Documento fiscal sem link de evidência.", "documentUrl");
  if (!competence) critical("COMPETENCE_MISSING", "Competência de apuração não informada.", "competence");
  if (operationValue <= 0) critical("VALUE_INVALID", "O valor da operação deve ser maior que zero.", "operationValue");

  const expectedIbsRate = roundRate(number(config.ibsStateRate) + number(config.ibsMunicipalRate));
  const informedIbsRate = roundRate(calculation.ibsRate);
  const expectedCbsRate = roundRate(number(config.cbsRate));
  if (applicable && expectedIbsRate && Math.abs(informedIbsRate - expectedIbsRate) > 0.000001) {
    warning("IBS_RATE_MISMATCH", `Alíquota IBS ${informedIbsRate}% difere da configuração vigente de ${expectedIbsRate}%.`, "ibsRate");
  }
  if (applicable && expectedCbsRate && Math.abs(calculation.cbsRate - expectedCbsRate) > 0.000001) {
    warning("CBS_RATE_MISMATCH", `Alíquota CBS ${calculation.cbsRate}% difere da configuração vigente de ${expectedCbsRate}%.`, "cbsRate");
  }

  if (applicable && document.informedIbsAmount !== undefined && document.informedIbsAmount !== "") {
    if (Math.abs(number(document.informedIbsAmount) - calculation.ibsAmount) > 0.01) {
      critical("IBS_VALUE_MISMATCH", "Valor informado do IBS diverge da memória de cálculo.", "informedIbsAmount");
    }
  }
  if (applicable && document.informedCbsAmount !== undefined && document.informedCbsAmount !== "") {
    if (Math.abs(number(document.informedCbsAmount) - calculation.cbsAmount) > 0.01) {
      critical("CBS_VALUE_MISMATCH", "Valor informado da CBS diverge da memória de cálculo.", "informedCbsAmount");
    }
  }
  if (applicable && direction === "incoming" && Boolean(document.creditEligible) && !String(document.creditBasis || "").trim()) {
    warning("CREDIT_BASIS_MISSING", "Crédito indicado sem fundamento ou observação de conferência.", "creditBasis");
  }
  if (applicable && number(document.presumedCredit) > 0 && !String(document.creditBasis || "").trim()) {
    warning("PRESUMED_CREDIT_BASIS_MISSING", "Crédito presumido informado sem fundamento fiscal.", "presumedCredit");
  }
  if (document.informedCreditAmount !== undefined && document.informedCreditAmount !== "" && number(document.informedCreditAmount) - number(calculation.potentialCredit) > 0.01) {
    critical("CREDIT_ABOVE_TAX", "Crédito informado supera o valor tecnicamente disponível na memória de cálculo.", "informedCreditAmount");
  }

  return {
    applicable,
    applicabilityReason: ibsCbsApplicabilityReason(config, document.issueDate || competence),
    issues,
    calculation,
    criticalCount: issues.filter((item) => item.severity === "critical").length,
    warningCount: issues.filter((item) => item.severity === "warning").length,
    status: issues.some((item) => item.severity === "critical")
      ? "Bloqueado para fechamento"
      : issues.length
        ? "Pendente de conferência"
        : applicable
          ? "Conforme"
          : "Não aplicável",
  };
}

export function calculateAssessment(documents = [], competence = "") {
  const target = normalizeCompetence(competence);
  const selected = documents.filter((document) => normalizeCompetence(document.competence) === target);
  let ibsDebits = 0;
  let ibsCredits = 0;
  let cbsDebits = 0;
  let cbsCredits = 0;
  let blockedCredits = 0;
  let criticalIssues = 0;
  let pendingDocuments = 0;

  for (const document of selected) {
    const direction = document.direction === "outgoing" ? "outgoing" : "incoming";
    const ibs = number(document.ibsAmount);
    const cbs = number(document.cbsAmount);
    if (direction === "outgoing") {
      ibsDebits += ibs;
      cbsDebits += cbs;
    } else if (document.creditEligible) {
      ibsCredits += ibs;
      cbsCredits += cbs;
    } else {
      blockedCredits +=
        document.blockedCredit === undefined
          ? ibs + cbs
          : number(document.blockedCredit);
    }
    criticalIssues += number(document.criticalCount);
    if (["Bloqueado para fechamento", "Pendente de conferência"].includes(String(document.complianceStatus || ""))) pendingDocuments += 1;
  }

  return {
    competence: target,
    documentCount: selected.length,
    ibsDebits: roundMoney(ibsDebits),
    ibsCredits: roundMoney(ibsCredits),
    ibsBalance: roundMoney(ibsDebits - ibsCredits),
    cbsDebits: roundMoney(cbsDebits),
    cbsCredits: roundMoney(cbsCredits),
    cbsBalance: roundMoney(cbsDebits - cbsCredits),
    blockedCredits: roundMoney(blockedCredits),
    criticalIssues,
    pendingDocuments,
    testPeriod: target.startsWith("2026-"),
    status: criticalIssues > 0 ? "Bloqueada" : "Aberta",
  };
}
