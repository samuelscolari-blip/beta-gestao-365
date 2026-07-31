import { readFile, writeFile } from "node:fs/promises";

async function read(path) {
  return readFile(path, "utf8");
}

async function writeIfChanged(path, before, after) {
  if (before === after) return false;
  await writeFile(path, after, "utf8");
  console.log(`Normalizado: ${path}`);
  return true;
}

function replaceRequired(text, oldText, newText, label) {
  if (text.includes(newText)) return text;
  const count = text.split(oldText).length - 1;
  if (count !== 1) {
    throw new Error(`${label}: esperado 1 trecho antigo, encontrado ${count}.`);
  }
  return text.replace(oldText, newText);
}

let changed = false;

// 1. Impede que o MutationObserver da V52 reescreva o mesmo título e
// bloqueie a thread principal do navegador.
const v52Path = "app/components/BetaAppV52.tsx";
const v52Before = await read(v52Path);
let v52After = v52Before;

v52After = replaceRequired(
  v52After,
  `      const topTitle = document.querySelector<HTMLElement>(".topbar-left strong");
      if (topTitle && nextModule === "dashboard") topTitle.textContent = "Visão Executiva Geral";`,
  `      const topTitle = document.querySelector<HTMLElement>(".topbar-left strong");
      if (
        topTitle &&
        nextModule === "dashboard" &&
        topTitle.textContent !== "Visão Executiva Geral"
      ) {
        topTitle.textContent = "Visão Executiva Geral";
      }`,
  "Proteção do título executivo",
);

v52After = replaceRequired(
  v52After,
  `    enhance();
    const observer = new MutationObserver(enhance);
    observer.observe(document.body, { childList: true, subtree: true });
    return () => observer.disconnect();`,
  `    let animationFrame: number | null = null;
    let disposed = false;

    const scheduleEnhancement = () => {
      if (disposed || animationFrame !== null) return;

      animationFrame = window.requestAnimationFrame(() => {
        animationFrame = null;
        if (disposed) return;

        observer.disconnect();
        try {
          enhance();
        } finally {
          if (!disposed) {
            observer.observe(document.body, {
              childList: true,
              subtree: true,
            });
          }
        }
      });
    };

    const observer = new MutationObserver(scheduleEnhancement);
    scheduleEnhancement();

    return () => {
      disposed = true;
      observer.disconnect();
      if (animationFrame !== null) {
        window.cancelAnimationFrame(animationFrame);
        animationFrame = null;
      }
    };`,
  "Agendamento seguro do observador V52",
);

changed = (await writeIfChanged(v52Path, v52Before, v52After)) || changed;

// 2. Remove a nomenclatura antiga dos formulários.
const modulesPath = "app/lib/modules.ts";
const modulesBefore = await read(modulesPath);
const modulesAfter = modulesBefore.replace('  "Vence em 7 dias",\n', "");
changed =
  (await writeIfChanged(modulesPath, modulesBefore, modulesAfter)) || changed;

// 3. Cria os dados fictícios novos diretamente como Pendente.
const demoPath = "db/demo-records.ts";
const demoBefore = await read(demoPath);
const demoAfter = demoBefore.replaceAll('"Vence em 7 dias"', '"Pendente"');
changed = (await writeIfChanged(demoPath, demoBefore, demoAfter)) || changed;

// 4. Atualiza automaticamente no D1 somente os registros fictícios antigos.
const recordsPath = "db/records.ts";
const recordsBefore = await read(recordsPath);
let recordsAfter = recordsBefore;

if (!recordsAfter.includes("const pendingStatusBackfills")) {
  recordsAfter = replaceRequired(
    recordsAfter,
    "SELECT id, module, reference, payload, source FROM records",
    "SELECT id, module, reference, status, payload, source FROM records",
    "Consulta de demonstração com status",
  );

  recordsAfter = replaceRequired(
    recordsAfter,
    `      reference: string;
      payload: string;
      source: string;`,
    `      reference: string;
      status: string;
      payload: string;
      source: string;`,
    "Tipo do status de demonstração",
  );

  const marker = `    }>();

  const demoWorkerCounts = new Map(`;
  const migration = [
    "    }>();",
    "",
    "  const pendingStatusBackfills = (existing.results || []).flatMap((row) => {",
    "    let payload: Record<string, unknown> = {};",
    "    try {",
    "      payload = JSON.parse(row.payload || \"{}\") as Record<string, unknown>;",
    "    } catch {",
    "      payload = {};",
    "    }",
    "    const topLevelUsesLegacyStatus = row.status === \"Vence em 7 dias\";",
    "    const payloadUsesLegacyStatus =",
    "      String(payload.status || \"\") === \"Vence em 7 dias\";",
    "    if (!topLevelUsesLegacyStatus && !payloadUsesLegacyStatus) return [];",
    "    return [{",
    "      id: row.id,",
    "      module: row.module,",
    "      payload: { ...payload, status: \"Pendente\" },",
    "    }];",
    "  });",
    "",
    "  if (pendingStatusBackfills.length) {",
    "    const updatedAt = new Date().toISOString();",
    "    await db.batch(",
    "      pendingStatusBackfills.map((record) =>",
    "        db",
    "          .prepare(",
    "            `UPDATE records",
    "             SET status = ?, payload = ?, updated_at = ?",
    "             WHERE tenant_id = ? AND id = ? AND source = ?`,",
    "          )",
    "          .bind(",
    "            \"Pendente\",",
    "            JSON.stringify(record.payload),",
    "            updatedAt,",
    "            DEFAULT_TENANT_ID,",
    "            record.id,",
    "            DEMO_SOURCE,",
    "          ),",
    "      ),",
    "    );",
    "    for (const record of pendingStatusBackfills) {",
    "      await audit(",
    "        \"DEMO_REFRESH\",",
    "        record.module,",
    "        record.id,",
    "        \"Situação fictícia padronizada como Pendente\",",
    "        \"Sistema\",",
    "      );",
    "    }",
    "  }",
    "",
    "  const demoWorkerCounts = new Map(",
  ].join("\n");

  recordsAfter = replaceRequired(
    recordsAfter,
    marker,
    migration,
    "Migração automática do status Pendente",
  );
}

changed =
  (await writeIfChanged(recordsPath, recordsBefore, recordsAfter)) || changed;

if (!changed) {
  console.log("Frontend e status já estão normalizados.");
}
