export type ParsedCsvRow = {
  lineNumber: number;
  row: Record<string, string>;
};

const MAX_HEADER_BYTES = 1024 * 1024;

function countDelimiter(line: string, delimiter: string) {
  let count = 0;
  let quoted = false;

  for (let index = 0; index < line.length; index += 1) {
    const character = line[index];
    if (character === '"') {
      if (quoted && line[index + 1] === '"') {
        index += 1;
      } else {
        quoted = !quoted;
      }
    } else if (!quoted && character === delimiter) {
      count += 1;
    }
  }

  return count;
}

function detectDelimiter(headerLine: string) {
  const candidates = [',', ';', '\t'];
  return candidates
    .map((delimiter) => ({ delimiter, count: countDelimiter(headerLine, delimiter) }))
    .sort((left, right) => right.count - left.count)[0]?.delimiter || ',';
}

function parseRecord(record: string, delimiter: string) {
  const fields: string[] = [];
  let field = '';
  let quoted = false;

  for (let index = 0; index < record.length; index += 1) {
    const character = record[index];

    if (quoted) {
      if (character === '"' && record[index + 1] === '"') {
        field += '"';
        index += 1;
      } else if (character === '"') {
        quoted = false;
      } else {
        field += character;
      }
      continue;
    }

    if (character === '"' && field.length === 0) {
      quoted = true;
    } else if (character === delimiter) {
      fields.push(field.trim());
      field = '';
    } else {
      field += character;
    }
  }

  if (quoted) {
    throw new Error('Cabeçalho CSV possui aspas não finalizadas.');
  }

  fields.push(field.trim());
  return fields;
}

function normalizedHeaders(fields: string[]) {
  const counters = new Map<string, number>();

  return fields.map((field, index) => {
    const base = field.replace(/^\uFEFF/, '').trim() || `coluna_${index + 1}`;
    const count = (counters.get(base) || 0) + 1;
    counters.set(base, count);
    return count === 1 ? base : `${base}_${count}`;
  });
}

class CsvBodyTokenizer {
  private field = '';
  private row: string[] = [];
  private quoted = false;
  private quotePending = false;
  private skipNextLf = false;
  private currentLine = 2;

  constructor(private readonly delimiter: string) {}

  push(text: string, final = false) {
    const output: Array<{ lineNumber: number; values: string[] }> = [];

    const finishRecord = () => {
      this.row.push(this.field.trim());
      this.field = '';
      if (this.row.some((value) => value.length > 0)) {
        output.push({ lineNumber: this.currentLine, values: this.row });
      }
      this.row = [];
      this.currentLine += 1;
    };

    for (let index = 0; index < text.length; index += 1) {
      const character = text[index];

      if (this.skipNextLf) {
        this.skipNextLf = false;
        if (character === '\n') continue;
      }

      if (this.quotePending) {
        if (character === '"') {
          this.field += '"';
          this.quotePending = false;
          continue;
        }
        this.quotePending = false;
        this.quoted = false;
      }

      if (this.quoted) {
        if (character === '"') {
          this.quotePending = true;
        } else {
          this.field += character;
        }
        continue;
      }

      if (character === '"' && this.field.length === 0) {
        this.quoted = true;
      } else if (character === this.delimiter) {
        this.row.push(this.field.trim());
        this.field = '';
      } else if (character === '\r') {
        finishRecord();
        this.skipNextLf = true;
      } else if (character === '\n') {
        finishRecord();
      } else {
        this.field += character;
      }
    }

    if (final) {
      if (this.quotePending) {
        this.quotePending = false;
        this.quoted = false;
      }
      if (this.quoted) {
        throw new Error('Arquivo CSV possui aspas não finalizadas.');
      }
      if (this.field.length > 0 || this.row.length > 0) finishRecord();
    }

    return output;
  }
}

export async function* parseCsvStream(
  stream: ReadableStream<Uint8Array>,
): AsyncGenerator<ParsedCsvRow> {
  const reader = stream.getReader();
  const decoder = new TextDecoder();
  let headerBuffer = '';
  let headerComplete = false;
  let headers: string[] = [];
  let tokenizer: CsvBodyTokenizer | null = null;

  try {
    while (true) {
      const { value, done } = await reader.read();
      const decoded = decoder.decode(value, { stream: !done });
      let bodyText = decoded;

      if (!headerComplete) {
        headerBuffer += decoded;
        if (headerBuffer.length > MAX_HEADER_BYTES) {
          throw new Error('Cabeçalho CSV excede o limite de 1 MB.');
        }

        const newlineIndex = headerBuffer.indexOf('\n');
        if (newlineIndex < 0 && !done) continue;

        const headerLine = (
          newlineIndex >= 0 ? headerBuffer.slice(0, newlineIndex) : headerBuffer
        ).replace(/\r$/, '');
        const delimiter = detectDelimiter(headerLine);
        headers = normalizedHeaders(parseRecord(headerLine, delimiter));
        tokenizer = new CsvBodyTokenizer(delimiter);
        bodyText = newlineIndex >= 0 ? headerBuffer.slice(newlineIndex + 1) : '';
        headerBuffer = '';
        headerComplete = true;
      }

      if (tokenizer && bodyText) {
        for (const parsed of tokenizer.push(bodyText)) {
          const row = Object.fromEntries(
            headers.map((header, index) => [header, parsed.values[index] || '']),
          );
          yield { lineNumber: parsed.lineNumber, row };
        }
      }

      if (done) break;
    }

    if (!headerComplete) {
      throw new Error('Arquivo CSV sem cabeçalho.');
    }

    if (tokenizer) {
      for (const parsed of tokenizer.push('', true)) {
        const row = Object.fromEntries(
          headers.map((header, index) => [header, parsed.values[index] || '']),
        );
        yield { lineNumber: parsed.lineNumber, row };
      }
    }
  } finally {
    reader.releaseLock();
  }
}
