import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const wrapper = readFileSync(
  "app/components/SecureBetaAppV102.tsx",
  "utf8",
);
const pdf = readFileSync("app/lib/pdf-export.ts", "utf8");

test("Modelo vira Arquivo PDF e exporta a tabela exibida", () => {
  assert.match(wrapper, /buttonLabel\(candidate\) === "modelo"/);
  assert.match(wrapper, /setButtonLabel\(pdfButton, "Arquivo PDF"\)/);
  assert.match(wrapper, /exportHtmlTableToPdf\(table/);
  assert.match(wrapper, /fileName: `Beta Construtora - \$\{title\}`/);
  assert.match(wrapper, /event\.stopImmediatePropagation\(\)/);
});

test("Arquivo PDF e Excel ficam antes de Importar sem movimentação repetida", () => {
  const reorder = wrapper.slice(
    wrapper.indexOf("const importButton"),
    wrapper.indexOf("function peopleToolbar"),
  );
  const excelGuard = reorder.indexOf(
    "if (excelButton.nextElementSibling !== importButton)",
  );
  const excelMove = reorder.indexOf(
    "toolbar.insertBefore(excelButton, importButton)",
  );
  const pdfGuard = reorder.indexOf(
    "if (pdfButton.nextElementSibling !== excelButton)",
  );
  const pdfMove = reorder.indexOf(
    "toolbar.insertBefore(pdfButton, excelButton)",
  );

  assert.ok(excelGuard >= 0);
  assert.ok(excelMove > excelGuard);
  assert.ok(pdfGuard > excelMove);
  assert.ok(pdfMove > pdfGuard);
});

test("o arquivo gerado é um PDF real, paginado e sem a coluna Ações", () => {
  assert.match(pdf, /%PDF-1\.4/);
  assert.match(pdf, /new Blob\(\[pdf\], \{ type: "application\/pdf" \}\)/);
  assert.match(pdf, /link\.download = safeFileName/);
  assert.match(pdf, /thead th/);
  assert.match(pdf, /tbody tr/);
  assert.match(pdf, /\["Ações", "Detalhes"\]/);
  assert.match(pdf, /`Página \$\{pageIndex \+ 1\} de \$\{totalPages\}`/);
});

test("o PDF usa exatamente os textos mostrados na tabela", () => {
  assert.match(
    pdf,
    /cells\[index\]\?\.innerText \|\| cells\[index\]\?\.textContent/,
  );
  assert.match(pdf, /Não há registros exibidos para exportar em PDF/);
});
