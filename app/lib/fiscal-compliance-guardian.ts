export type FiscalComplianceIssue = {
  field: string;
  message: string;
};

function isBlank(value: unknown) {
  return value === null || value === undefined || String(value).trim() === "";
}

function configuredCredential(payload: Record<string, unknown>) {
  const certificateType = String(payload.certificateType ?? "").trim();
  return (
    Boolean(certificateType && certificateType !== "Não configurado") ||
    !isBlank(payload.certificateId) ||
    !isBlank(payload.powerOfAttorneyId)
  );
}

export class FiscalComplianceGuardian {
  static verify(payload: Record<string, unknown>): FiscalComplianceIssue[] {
    const status = String(payload.status ?? "");
    const issues: FiscalComplianceIssue[] = [];
    const preparedStatuses = [
      "Pronto para transmissão",
      "Transmitido",
      "Em processamento",
      "Processado com sucesso",
    ];
    const transmittedStatuses = [
      "Transmitido",
      "Em processamento",
      "Processado com sucesso",
    ];

    if (
      preparedStatuses.includes(status) &&
      String(payload.validationStatus ?? "") !== "Validado internamente"
    ) {
      issues.push({
        field: "validationStatus",
        message:
          "Conclua a validação interna antes de preparar ou confirmar a transmissão.",
      });
    }

    if (preparedStatuses.includes(status) && !configuredCredential(payload)) {
      issues.push({
        field: "certificateType",
        message:
          "Informe o certificado A1/A3 ou a procuração responsável pela assinatura.",
      });
    }

    if (transmittedStatuses.includes(status) && isBlank(payload.batchProtocol)) {
      issues.push({
        field: "batchProtocol",
        message:
          "Informe o protocolo oficial antes de marcar o evento como transmitido ou processado.",
      });
    }

    if (
      status === "Processado com sucesso" &&
      isBlank(payload.receiptNumber)
    ) {
      issues.push({
        field: "receiptNumber",
        message:
          "Informe o recibo oficial antes de marcar o evento como processado com sucesso.",
      });
    }

    if (
      status === "Rejeitado" &&
      isBlank(payload.rejectionReason) &&
      isBlank(payload.notes)
    ) {
      issues.push({
        field: "rejectionReason",
        message: "Registre o motivo da rejeição para permitir a correção.",
      });
    }

    if (
      !isBlank(payload.dueDate) &&
      !isBlank(payload.competence) &&
      String(payload.dueDate) < String(payload.competence)
    ) {
      issues.push({
        field: "dueDate",
        message:
          "O prazo operacional não pode ser anterior à competência informada.",
      });
    }

    return issues;
  }
}
