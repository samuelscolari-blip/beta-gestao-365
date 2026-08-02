const stopWords = new Set([
  "a",
  "as",
  "da",
  "das",
  "de",
  "do",
  "dos",
  "e",
  "em",
  "o",
  "os",
  "para",
  "por",
]);

const synonymGroups = [
  ["valor", "vlr", "custo", "montante", "total", "preco"],
  ["data", "dt", "dia", "prazo", "previsao", "vencimento"],
  ["descricao", "desc", "historico", "atividade", "servico", "tarefa"],
  [
    "responsavel",
    "gestor",
    "encarregado",
    "lider",
    "coordenador",
    "titular",
    "colaborador",
    "funcionario",
    "pessoa",
  ],
  ["obra", "projeto", "centro custo", "centro de custo"],
  ["codigo", "cod", "id", "identificador", "matricula"],
];

function normalizeHeader(value) {
  return String(value ?? "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim()
    .replace(/\s+/g, " ");
}

function expandedTokens(value) {
  const normalized = normalizeHeader(value);
  const tokens = new Set(
    normalized
      .split(" ")
      .filter((token) => token.length >= 2 && !stopWords.has(token)),
  );

  for (const group of synonymGroups) {
    const normalizedGroup = group.map(normalizeHeader);
    if (normalizedGroup.some((item) => normalized.includes(item))) {
      for (const item of normalizedGroup) {
        for (const token of item.split(" ")) {
          if (token.length >= 2) tokens.add(token);
        }
      }
    }
  }

  return tokens;
}

function scoreHeader(header, alias) {
  const normalizedHeader = normalizeHeader(header);
  const normalizedAlias = normalizeHeader(alias);
  if (!normalizedHeader || !normalizedAlias) return 0;
  if (normalizedHeader === normalizedAlias) return 1;

  const headerTokens = expandedTokens(normalizedHeader);
  const aliasTokens = expandedTokens(normalizedAlias);
  if (!headerTokens.size || !aliasTokens.size) return 0;

  let intersection = 0;
  for (const token of aliasTokens) {
    if (headerTokens.has(token)) intersection += 1;
  }

  const coverage = intersection / aliasTokens.size;
  const precision = intersection / headerTokens.size;
  const hasStrongToken = [...aliasTokens].some(
    (token) => token.length >= 4 && headerTokens.has(token),
  );

  if (!hasStrongToken) return 0;
  if (coverage === 1 && precision >= 0.5) return 0.94;
  if (aliasTokens.size >= 2 && coverage >= 0.67 && precision >= 0.5) return 0.82;
  return 0;
}

/**
 * Faz correspondência conservadora. O exato sempre vence; a aproximação
 * semântica só é aceita com boa cobertura de tokens para evitar colunas erradas.
 */
export function findSemanticHeaderIndex(headers, aliases, usedIndexes = new Set()) {
  let bestIndex = -1;
  let bestScore = 0;

  for (let index = 0; index < headers.length; index += 1) {
    if (usedIndexes.has(index)) continue;
    for (const alias of aliases) {
      const score = scoreHeader(headers[index], alias);
      if (score > bestScore) {
        bestScore = score;
        bestIndex = index;
      }
    }
  }

  return bestScore >= 0.8 ? bestIndex : -1;
}

/**
 * Normaliza um cabeçalho completo para as chaves reais do módulo. Colunas sem
 * correspondência segura permanecem nulas e são ignoradas pelo importador.
 */
export function normalizeSemanticHeaders(headers, fields) {
  const normalized = Array.from({ length: headers.length }, () => null);
  const usedIndexes = new Set();
  const matchedFields = new Set();

  // Reserva primeiro todas as correspondências exatas. Isso impede, por
  // exemplo, que “Matrícula” (alias exato do gestor) seja capturada antes por
  // uma aproximação com “Matrícula CEI anterior”.
  for (const field of fields) {
    const aliases = [field.label, ...(field.aliases || [])].map(normalizeHeader);
    const index = headers.findIndex(
      (header, headerIndex) =>
        !usedIndexes.has(headerIndex) &&
        aliases.includes(normalizeHeader(header)),
    );
    if (index < 0) continue;
    normalized[index] = field.key;
    usedIndexes.add(index);
    matchedFields.add(field.key);
  }

  for (const field of fields) {
    if (matchedFields.has(field.key)) continue;
    const index = findSemanticHeaderIndex(
      headers,
      [field.label, ...(field.aliases || [])],
      usedIndexes,
    );
    if (index < 0) continue;
    normalized[index] = field.key;
    usedIndexes.add(index);
  }

  return normalized;
}

export { normalizeHeader as normalizeSemanticHeader };
