import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const source = (path) => readFile(new URL(`../${path}`, import.meta.url), "utf8");

test("V70 compartilha a inicialização do esquema e permite retry", async () => {
  const records = await source("db/records.ts");
  assert.match(records, /let schemaPromise: Promise<void> \| null = null/);
  assert.match(records, /schemaPromise = ensureSchemaOnce\(\)\.catch/);
  assert.match(records, /schemaPromise = null;[\s\S]*?throw error/);
  assert.match(records, /async function ensureSchemaOnce\(\): Promise<void>/);
});

test("V70 normaliza aliases no backend antes das validações documentais", async () => {
  const route = await source("app/api/records/route.ts");
  assert.match(route, /function applyCanonicalAliases/);
  assert.match(route, /payload\.supplierCode = firstNonBlank/);
  assert.match(route, /payload\.holder = firstNonBlank/);
  assert.match(route, /payload\.cardEnding = firstNonBlank/);
  assert.match(route, /payload\.work = firstNonBlank/);
  assert.match(route, /applyCanonicalAliases\(moduleId, payload\);[\s\S]*?const amount/);
});

test("V70 inicia estratégias isoladas sem remover as validações restantes", async () => {
  const validation = await source("app/lib/record-validation-core.ts");
  assert.match(validation, /const moduleValidators: Partial<Record<string, ModuleValidator>>/);
  assert.match(validation, /people: validatePeopleBusinessRules/);
  assert.match(validation, /contractors: validateContractorBusinessRules/);
  assert.match(validation, /works: validateWorkBusinessRules/);
  assert.match(validation, /validateRemainingBusinessRules\(definition, payload\)/);
  assert.match(validation, /definition\.id === "worklogs"/);
  assert.match(validation, /definition\.id === "assets"/);
  assert.match(validation, /definition\.id === "asset_events"/);
});

test("V70 limita o importador a dois lotes simultâneos e aguarda todos", async () => {
  const app = await source("app/components/BetaApp.tsx");
  assert.match(app, /const concurrencyLimit = 2/);
  assert.match(app, /Promise\.allSettled/);
  assert.match(app, /uploadImportBatch/);
  assert.match(app, /serverFailures\.push\(\.\.\.outcome\.value\.failures\)/);
  assert.doesNotMatch(app, /Promise\.race\(activePromises\)/);
});
