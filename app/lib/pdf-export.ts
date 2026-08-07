const PAGE_WIDTH = 841.89;
const PAGE_HEIGHT = 595.28;
const MARGIN_X = 28;
const HEADER_HEIGHT = 62;
const FOOTER_HEIGHT = 24;
const TABLE_HEADER_HEIGHT = 24;
const CELL_PADDING_X = 5;
const CELL_PADDING_Y = 5;
const BODY_FONT_SIZE = 7.4;
const BODY_LINE_HEIGHT = 9.2;
const MAX_CELL_LINES = 3;

const WIN_ANSI_EXTRA = new Map<number, number>([
  [0x20ac, 0x80],
  [0x201a, 0x82],
  [0x0192, 0x83],
  [0x201e, 0x84],
  [0x2026, 0x85],
  [0x2020, 0x86],
  [0x2021, 0x87],
  [0x02c6, 0x88],
  [0x2030, 0x89],
  [0x0160, 0x8a],
  [0x2039, 0x8b],
  [0x0152, 0x8c],
  [0x017d, 0x8e],
  [0x2018, 0x91],
  [0x2019, 0x92],
  [0x201c, 0x93],
  [0x201d, 0x94],
  [0x2022, 0x95],
  [0x2013, 0x96],
  [0x2014, 0x97],
  [0x02dc, 0x98],
  [0x2122, 0x99],
  [0x0161, 0x9a],
  [0x203a, 0x9b],
  [0x0153, 0x9c],
  [0x017e, 0x9e],
  [0x0178, 0x9f],
]);

type PreparedRow = {
  cells: string[][];
  height: number;
};

type PdfTableInput = {
  title: string;
  columns: string[];
  rows: string[][];
  fileName?: string;
  generatedAt?: Date;
};

type HtmlTablePdfOptions = {
  title: string;
  fileName?: string;
  omittedHeaders?: string[];
};

function normalizedText(value: unknown) {
  return (
    String(value ?? "")
      .replace(/[\r\n\t]+/g, " ")
      .replace(/\s+/g, " ")
      .trim() || "-"
  );
}

function normalizedLabel(value: unknown) {
  return normalizedText(value)
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();
}

function winAnsiHex(value: unknown) {
  const bytes: number[] = [];
  for (const character of normalizedText(value)) {
    const codePoint = character.codePointAt(0) ?? 0x3f;
    if (codePoint >= 0x20 && codePoint <= 0x7e) {
      bytes.push(codePoint);
    } else if (codePoint >= 0xa0 && codePoint <= 0xff) {
      bytes.push(codePoint);
    } else {
      bytes.push(WIN_ANSI_EXTRA.get(codePoint) ?? 0x3f);
    }
  }
  return `<${bytes
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("")}>`;
}

function glyphWeight(character: string) {
  if (character === " ") return 0.28;
  if (/[MW@%&]/.test(character)) return 0.86;
  if (/[ilI1.,:;|!'`]/.test(character)) return 0.25;
  if (/[A-ZÁÀÂÃÉÊÍÓÔÕÚÇ]/.test(character)) return 0.61;
  if (/[0-9]/.test(character)) return 0.53;
  return 0.5;
}

function textWidth(value: unknown, fontSize: number) {
  return [...normalizedText(value)].reduce(
    (sum, character) => sum + glyphWeight(character) * fontSize,
    0,
  );
}

function fitWithEllipsis(value: string, maxWidth: number, fontSize: number) {
  const suffix = "...";
  if (textWidth(value, fontSize) <= maxWidth) return value;
  let output = value;
  while (
    output &&
    textWidth(`${output}${suffix}`, fontSize) > maxWidth
  ) {
    output = output.slice(0, -1);
  }
  return `${output.trimEnd()}${suffix}`;
}

function wrapText(
  value: unknown,
  maxWidth: number,
  fontSize: number,
  maxLines = MAX_CELL_LINES,
) {
  const text = normalizedText(value);
  if (textWidth(text, fontSize) <= maxWidth) return [text];

  const words = text.split(" ");
  const lines: string[] = [];
  let current = "";

  for (const word of words) {
    const candidate = current ? `${current} ${word}` : word;
    if (textWidth(candidate, fontSize) <= maxWidth) {
      current = candidate;
      continue;
    }

    if (current) lines.push(current);
    current = word;

    while (textWidth(current, fontSize) > maxWidth) {
      let chunk = "";
      for (const character of current) {
        if (textWidth(`${chunk}${character}`, fontSize) > maxWidth) break;
        chunk += character;
      }
      if (!chunk) chunk = current.slice(0, 1);
      lines.push(chunk);
      current = current.slice(chunk.length);
      if (lines.length >= maxLines) break;
    }

    if (lines.length >= maxLines) break;
  }

  if (lines.length < maxLines && current) lines.push(current);
  if (lines.length > maxLines) lines.length = maxLines;

  const consumed = lines.join(" ").replace(/\s+/g, " ");
  if (consumed.length < text.length && lines.length) {
    lines[lines.length - 1] = fitWithEllipsis(
      lines[lines.length - 1],
      maxWidth,
      fontSize,
    );
  }

  return lines.length
    ? lines
    : [fitWithEllipsis(text, maxWidth, fontSize)];
}

function calculateColumnWidths(
  columns: string[],
  rows: string[][],
  availableWidth: number,
) {
  const minimum = Math.max(
    48,
    Math.min(72, (availableWidth / Math.max(columns.length, 1)) * 0.62),
  );
  const maximum = Math.max(minimum, Math.min(190, availableWidth * 0.31));
  const preferred = columns.map((column, columnIndex) => {
    const samples = [
      column,
      ...rows.slice(0, 80).map((row) => row[columnIndex] ?? ""),
    ];
    const measured = Math.max(
      ...samples.map(
        (sample) =>
          textWidth(sample, BODY_FONT_SIZE) + CELL_PADDING_X * 2,
      ),
    );
    return Math.min(maximum, Math.max(minimum, measured));
  });

  let widths = [...preferred];
  const totalWidth = () =>
    widths.reduce((total, width) => total + width, 0);

  if (totalWidth() > availableWidth) {
    const shrinkable = widths.reduce(
      (total, width) => total + Math.max(0, width - minimum),
      0,
    );
    const overflow = totalWidth() - availableWidth;
    widths = shrinkable
      ? widths.map(
          (width) =>
            width -
            (Math.max(0, width - minimum) / shrinkable) * overflow,
        )
      : widths.map(() => availableWidth / widths.length);
  } else if (totalWidth() < availableWidth) {
    const extra = availableWidth - totalWidth();
    const preferredTotal =
      preferred.reduce((total, width) => total + width, 0) || 1;
    widths = widths.map(
      (width, index) => width + extra * (preferred[index] / preferredTotal),
    );
  }

  const correction = availableWidth - totalWidth();
  if (widths.length) widths[widths.length - 1] += correction;
  return widths;
}

function preparePages(
  columns: string[],
  rows: string[][],
  widths: number[],
) {
  const topY = PAGE_HEIGHT - HEADER_HEIGHT - 16;
  const bottomY = FOOTER_HEIGHT + 10;
  const pages: PreparedRow[][] = [];
  let currentPage: PreparedRow[] = [];
  let y = topY - TABLE_HEADER_HEIGHT;

  for (const row of rows) {
    const cells = columns.map((_, index) =>
      wrapText(
        row[index] ?? "-",
        widths[index] - CELL_PADDING_X * 2,
        BODY_FONT_SIZE,
      ),
    );
    const lineCount = Math.max(1, ...cells.map((cell) => cell.length));
    const height = Math.max(
      20,
      lineCount * BODY_LINE_HEIGHT + CELL_PADDING_Y * 2,
    );

    if (currentPage.length && y - height < bottomY) {
      pages.push(currentPage);
      currentPage = [];
      y = topY - TABLE_HEADER_HEIGHT;
    }

    currentPage.push({ cells, height });
    y -= height;
  }

  if (currentPage.length || !pages.length) pages.push(currentPage);
  return pages;
}

function textCommand(
  text: unknown,
  x: number,
  y: number,
  fontSize: number,
  font = "F1",
  color = "0.08 0.17 0.24",
) {
  return (
    `${color} rg BT /${font} ${fontSize.toFixed(2)} Tf ` +
    `1 0 0 1 ${x.toFixed(2)} ${y.toFixed(2)} Tm ` +
    `${winAnsiHex(text)} Tj ET\n`
  );
}

function createPageStream({
  title,
  subtitle,
  columns,
  widths,
  rows,
  pageIndex,
  totalPages,
  generatedLabel,
}: {
  title: string;
  subtitle: string;
  columns: string[];
  widths: number[];
  rows: PreparedRow[];
  pageIndex: number;
  totalPages: number;
  generatedLabel: string;
}) {
  const commands: string[] = [];
  commands.push(
    `0.035 0.165 0.265 rg 0 ${(PAGE_HEIGHT - HEADER_HEIGHT).toFixed(2)} ` +
      `${PAGE_WIDTH.toFixed(2)} ${HEADER_HEIGHT.toFixed(2)} re f\n`,
  );
  commands.push(
    textCommand(
      "BETA CONSTRUTORA",
      MARGIN_X,
      PAGE_HEIGHT - 24,
      9.5,
      "F2",
      "1 1 1",
    ),
  );
  commands.push(
    textCommand(
      title,
      MARGIN_X,
      PAGE_HEIGHT - 43,
      16,
      "F2",
      "1 1 1",
    ),
  );
  commands.push(
    textCommand(
      subtitle,
      PAGE_WIDTH - MARGIN_X - 250,
      PAGE_HEIGHT - 43,
      8,
      "F1",
      "0.78 0.90 0.95",
    ),
  );

  let y = PAGE_HEIGHT - HEADER_HEIGHT - 16;
  const tableWidth = widths.reduce((sum, width) => sum + width, 0);
  commands.push(
    `0.89 0.95 0.97 rg ${MARGIN_X.toFixed(2)} ` +
      `${(y - TABLE_HEADER_HEIGHT).toFixed(2)} ${tableWidth.toFixed(2)} ` +
      `${TABLE_HEADER_HEIGHT.toFixed(2)} re f\n`,
  );
  commands.push(
    `0.64 0.75 0.80 RG 0.55 w ${MARGIN_X.toFixed(2)} ` +
      `${(y - TABLE_HEADER_HEIGHT).toFixed(2)} ${tableWidth.toFixed(2)} ` +
      `${TABLE_HEADER_HEIGHT.toFixed(2)} re S\n`,
  );

  let x = MARGIN_X;
  columns.forEach((column, index) => {
    const label = fitWithEllipsis(
      column.toUpperCase(),
      widths[index] - CELL_PADDING_X * 2,
      7.6,
    );
    commands.push(
      textCommand(
        label,
        x + CELL_PADDING_X,
        y - 15.5,
        7.6,
        "F2",
        "0.06 0.25 0.34",
      ),
    );
    if (index) {
      commands.push(
        `0.73 0.82 0.86 RG 0.4 w ${x.toFixed(2)} ` +
          `${(y - TABLE_HEADER_HEIGHT).toFixed(2)} m ${x.toFixed(2)} ` +
          `${y.toFixed(2)} l S\n`,
      );
    }
    x += widths[index];
  });
  y -= TABLE_HEADER_HEIGHT;

  rows.forEach((row, rowIndex) => {
    if (rowIndex % 2 === 1) {
      commands.push(
        `0.965 0.979 0.985 rg ${MARGIN_X.toFixed(2)} ` +
          `${(y - row.height).toFixed(2)} ${tableWidth.toFixed(2)} ` +
          `${row.height.toFixed(2)} re f\n`,
      );
    }
    commands.push(
      `0.82 0.87 0.89 RG 0.4 w ${MARGIN_X.toFixed(2)} ` +
        `${(y - row.height).toFixed(2)} ${tableWidth.toFixed(2)} ` +
        `${row.height.toFixed(2)} re S\n`,
    );

    let cellX = MARGIN_X;
    row.cells.forEach((lines, columnIndex) => {
      lines.forEach((line, lineIndex) => {
        commands.push(
          textCommand(
            line,
            cellX + CELL_PADDING_X,
            y -
              CELL_PADDING_Y -
              BODY_FONT_SIZE -
              lineIndex * BODY_LINE_HEIGHT,
            BODY_FONT_SIZE,
          ),
        );
      });
      if (columnIndex) {
        commands.push(
          `0.88 0.91 0.92 RG 0.35 w ${cellX.toFixed(2)} ` +
            `${(y - row.height).toFixed(2)} m ${cellX.toFixed(2)} ` +
            `${y.toFixed(2)} l S\n`,
        );
      }
      cellX += widths[columnIndex];
    });
    y -= row.height;
  });

  commands.push(
    textCommand(
      generatedLabel,
      MARGIN_X,
      14,
      7,
      "F1",
      "0.38 0.47 0.52",
    ),
  );
  commands.push(
    textCommand(
      `Página ${pageIndex + 1} de ${totalPages}`,
      PAGE_WIDTH - MARGIN_X - 76,
      14,
      7,
      "F2",
      "0.23 0.35 0.41",
    ),
  );
  return commands.join("");
}

export function createTablePdf(input: PdfTableInput) {
  if (!input.columns.length) {
    throw new Error("A tabela não possui colunas para exportar.");
  }

  const generatedAt = input.generatedAt || new Date();
  const columns = input.columns.map(normalizedText);
  const rows = input.rows.map((row) =>
    columns.map((_, index) => normalizedText(row[index])),
  );
  const widths = calculateColumnWidths(
    columns,
    rows,
    PAGE_WIDTH - MARGIN_X * 2,
  );
  const pages = preparePages(columns, rows, widths);
  const generatedLabel = `Gerado em ${generatedAt.toLocaleString("pt-BR", {
    dateStyle: "short",
    timeStyle: "short",
  })}`;
  const subtitle = `${rows.length} registro${rows.length === 1 ? "" : "s"}`;

  const objects = new Map<number, string>();
  const pageObjectNumbers = pages.map((_, index) => 5 + index * 2);
  objects.set(1, "<< /Type /Catalog /Pages 2 0 R >>");
  objects.set(
    2,
    `<< /Type /Pages /Count ${pages.length} /Kids [` +
      `${pageObjectNumbers.map((number) => `${number} 0 R`).join(" ")}] >>`,
  );
  objects.set(
    3,
    "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica " +
      "/Encoding /WinAnsiEncoding >>",
  );
  objects.set(
    4,
    "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold " +
      "/Encoding /WinAnsiEncoding >>",
  );

  pages.forEach((pageRows, index) => {
    const pageObjectNumber = pageObjectNumbers[index];
    const contentObjectNumber = pageObjectNumber + 1;
    const stream = createPageStream({
      title: normalizedText(input.title),
      subtitle,
      columns,
      widths,
      rows: pageRows,
      pageIndex: index,
      totalPages: pages.length,
      generatedLabel,
    });
    objects.set(
      pageObjectNumber,
      `<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ` +
        `${PAGE_WIDTH.toFixed(2)} ${PAGE_HEIGHT.toFixed(2)}] ` +
        "/Resources << /Font << /F1 3 0 R /F2 4 0 R >> >> " +
        `/Contents ${contentObjectNumber} 0 R >>`,
    );
    objects.set(
      contentObjectNumber,
      `<< /Length ${stream.length} >>\nstream\n${stream}endstream`,
    );
  });

  let pdf = "%PDF-1.4\n%Beta Gestao 365\n";
  const offsets = [0];
  const maxObjectNumber = Math.max(...objects.keys());

  for (
    let objectNumber = 1;
    objectNumber <= maxObjectNumber;
    objectNumber += 1
  ) {
    offsets[objectNumber] = pdf.length;
    pdf += `${objectNumber} 0 obj\n${objects.get(objectNumber)}\nendobj\n`;
  }

  const xrefOffset = pdf.length;
  pdf += `xref\n0 ${maxObjectNumber + 1}\n`;
  pdf += "0000000000 65535 f \n";
  for (
    let objectNumber = 1;
    objectNumber <= maxObjectNumber;
    objectNumber += 1
  ) {
    pdf += `${String(offsets[objectNumber]).padStart(10, "0")} 00000 n \n`;
  }
  pdf +=
    `trailer\n<< /Size ${maxObjectNumber + 1} /Root 1 0 R >>\n` +
    `startxref\n${xrefOffset}\n%%EOF\n`;
  return pdf;
}

function safeFileName(value: string) {
  const base = value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-zA-Z0-9._-]+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "")
    .toLowerCase();
  return `${base || "beta-construtora-relatorio"}.pdf`;
}

function downloadPdf(pdf: string, fileName: string) {
  const blob = new Blob([pdf], { type: "application/pdf" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = safeFileName(fileName.replace(/\.pdf$/i, ""));
  link.hidden = true;
  document.body.append(link);
  link.click();
  link.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 2_000);
}

export function exportHtmlTableToPdf(
  table: HTMLTableElement,
  options: HtmlTablePdfOptions,
) {
  const omittedHeaders = new Set(
    (options.omittedHeaders || ["Ações", "Detalhes"]).map(normalizedLabel),
  );
  const headers = Array.from(table.querySelectorAll<HTMLTableCellElement>(
    "thead th",
  ));
  const includedIndexes = headers
    .map((header, index) => ({
      index,
      label: normalizedText(header.textContent),
    }))
    .filter((header) => !omittedHeaders.has(normalizedLabel(header.label)));

  if (!includedIndexes.length) {
    throw new Error("A tabela não possui colunas disponíveis para o PDF.");
  }

  const rows = Array.from(table.querySelectorAll<HTMLTableRowElement>(
    "tbody tr",
  )).map((row) => {
    const cells = Array.from(row.cells);
    return includedIndexes.map(({ index }) =>
      normalizedText(cells[index]?.innerText || cells[index]?.textContent),
    );
  });

  if (!rows.length) {
    throw new Error("Não há registros exibidos para exportar em PDF.");
  }

  const pdf = createTablePdf({
    title: options.title,
    columns: includedIndexes.map((header) => header.label),
    rows,
  });
  downloadPdf(
    pdf,
    options.fileName || `Beta Construtora - ${options.title}`,
  );
}
