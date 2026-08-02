function countDelimiter(line, delimiter) {
  let quoted = false;
  let count = 0;
  for (let index = 0; index < line.length; index += 1) {
    const character = line[index];
    if (character === '"') {
      if (quoted && line[index + 1] === '"') index += 1;
      else quoted = !quoted;
    } else if (!quoted && character === delimiter) {
      count += 1;
    }
  }
  return count;
}

export function detectCsvDelimiter(text) {
  const firstLine = String(text)
    .replace(/^\uFEFF/, "")
    .split(/\r?\n/)
    .find((line) => line.trim()) || "";
  return [";", ",", "\t"]
    .map((delimiter) => ({ delimiter, count: countDelimiter(firstLine, delimiter) }))
    .sort((left, right) => right.count - left.count)[0]?.delimiter || ";";
}

/**
 * Parser RFC 4180 compatível com o navegador e com Cloudflare. Suporta aspas,
 * separadores dentro de campos, quebras de linha internas e BOM UTF-8.
 */
export function parseCsvRows(input, delimiter = detectCsvDelimiter(input)) {
  const text = String(input).replace(/^\uFEFF/, "");
  const rows = [];
  let row = [];
  let cell = "";
  let quoted = false;

  for (let index = 0; index < text.length; index += 1) {
    const character = text[index];
    if (character === '"') {
      if (quoted && text[index + 1] === '"') {
        cell += '"';
        index += 1;
      } else {
        quoted = !quoted;
      }
      continue;
    }
    if (!quoted && character === delimiter) {
      row.push(cell);
      cell = "";
      continue;
    }
    if (!quoted && (character === "\n" || character === "\r")) {
      if (character === "\r" && text[index + 1] === "\n") index += 1;
      row.push(cell);
      if (row.some((value) => String(value).trim())) rows.push(row);
      row = [];
      cell = "";
      continue;
    }
    cell += character;
  }

  if (quoted) throw new Error("O arquivo CSV possui aspas abertas sem fechamento.");
  row.push(cell);
  if (row.some((value) => String(value).trim())) rows.push(row);
  return rows;
}

