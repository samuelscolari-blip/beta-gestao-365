export type SheetCandidateMetrics = {
  headerScore: number;
  records: number;
  invalid: number;
  score: number;
};

export type SheetStructuralAssessment = {
  isValid: boolean;
  confidence: number;
  reason?: string;
};

export class SheetAnalyzer {
  static readonly MIN_HEADER_SCORE = 2;
  static readonly AMBIGUITY_RATIO = 0.82;

  static assessKnownSheet(
    sheetName: string,
    moduleLabel: string,
    candidate: SheetCandidateMetrics | undefined,
  ): SheetStructuralAssessment {
    if (!candidate || candidate.records <= 0) {
      return {
        isValid: false,
        confidence: 0,
        reason: `A aba “${sheetName}” tem nome de “${moduleLabel}”, mas não contém registros reconhecíveis desse módulo.`,
      };
    }

    const headerConfidence = Math.min(
      1,
      candidate.headerScore / Math.max(this.MIN_HEADER_SCORE, 4),
    );
    const recordConfidence = Math.min(1, candidate.records / 5);
    const invalidPenalty = Math.min(
      0.5,
      candidate.invalid / Math.max(1, candidate.records + candidate.invalid),
    );
    const confidence = Math.max(
      0,
      Math.min(1, headerConfidence * 0.55 + recordConfidence * 0.45 - invalidPenalty),
    );

    if (candidate.headerScore < this.MIN_HEADER_SCORE) {
      return {
        isValid: false,
        confidence,
        reason: `A aba “${sheetName}” possui poucas colunas reconhecidas para “${moduleLabel}”. Revise o cabeçalho ou selecione o destino manualmente.`,
      };
    }

    return { isValid: true, confidence };
  }

  static isAmbiguous(primaryScore: number, competitorScore: number) {
    return (
      primaryScore > 0 &&
      competitorScore >= primaryScore * this.AMBIGUITY_RATIO
    );
  }

  static genericAssessment(headers: unknown[], rows: unknown[][]) {
    const normalizedHeaders = headers.filter(
      (value) => String(value ?? "").trim() !== "",
    );
    const dataRows = rows.filter((row) =>
      row.some((value) => String(value ?? "").trim() !== ""),
    );

    if (!dataRows.length) {
      return {
        isValid: false,
        confidence: 0,
        reason: "A aba está estruturalmente vazia, sem linhas de dados.",
      } satisfies SheetStructuralAssessment;
    }

    if (normalizedHeaders.length < this.MIN_HEADER_SCORE) {
      return {
        isValid: false,
        confidence: 0.25,
        reason: "A aba não possui cabeçalho suficiente para uma importação segura.",
      } satisfies SheetStructuralAssessment;
    }

    return {
      isValid: true,
      confidence: Math.min(0.75, 0.45 + normalizedHeaders.length * 0.05),
    } satisfies SheetStructuralAssessment;
  }
}
