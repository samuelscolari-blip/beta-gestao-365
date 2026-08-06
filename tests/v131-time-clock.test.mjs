import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";

const access = fs.readFileSync("app/components/AccessGate.tsx", "utf8");
const clockPage = fs.readFileSync("app/ponto/page.tsx", "utf8");
const clockApi = fs.readFileSync("app/api/time-clock/route.js", "utf8");
const masterAccess = fs.readFileSync("app/lib/master-point-access.ts", "utf8");
const serviceWorker = fs.readFileSync("public/ponto-sw.js", "utf8");
const manifest = fs.readFileSync("public/ponto.webmanifest", "utf8");

test("ponto funciona sem reconhecimento facial ou câmera", () => {
  assert.doesNotMatch(clockPage, /getUserMedia|HUMAN_SCRIPT|embedding|evidencePhoto/);
  assert.doesNotMatch(clockApi, /FACE_MATCH_THRESHOLD|faceSimilarity|evidence_photo/);
  assert.match(clockPage, /Ponto eletrônico operacional sem reconhecimento facial/);
  assert.match(clockPage, /Bater ponto agora/);
});

test("login seleciona CPF e confirma o nome do colaborador", () => {
  assert.match(access, /CPF do colaborador/);
  assert.match(access, /selectedEmployee\.name/);
  assert.match(access, /formattedCpf/);
  assert.match(access, /beta-clock-selected-v132/);
  assert.match(masterAccess, /selectedEmployeeRegistration/);
});

test("batida preserva horário e geolocalização", () => {
  assert.match(clockPage, /occurredAt = new Date\(\)\.toISOString\(\)/);
  assert.match(clockPage, /position\.coords\.latitude/);
  assert.match(clockPage, /position\.coords\.longitude/);
  assert.match(clockApi, /occurred_at/);
  assert.match(clockApi, /latitude REAL/);
  assert.match(clockApi, /longitude REAL/);
  assert.match(clockApi, /accuracy REAL/);
});

test("encarregado master pode registrar para qualquer colaborador com autoria", () => {
  assert.match(clockPage, /Quem está batendo o ponto\?/);
  assert.match(clockPage, /O lançamento ficará identificado/);
  assert.match(clockApi, /masterPointSessionFromHeaders/);
  assert.match(clockApi, /POINT_TEST_EMPLOYEES/);
  assert.match(clockApi, /actor_registration/);
  assert.match(clockApi, /actor_name/);
  assert.match(clockApi, /actor_role/);
  assert.match(clockApi, /Ponto de \$\{employee\.name\} registrado/);
});

test("fila offline usa clientEventId e servidor impede duplicidade", () => {
  assert.match(clockPage, /beta-gestao-365-time-clock/);
  assert.match(clockPage, /clientEventId = crypto\.randomUUID\(\)/);
  assert.match(clockPage, /Sem conexão\. O registro foi salvo neste celular/);
  assert.match(clockApi, /UNIQUE \(tenant_id, client_event_id\)/);
  assert.match(clockApi, /INSERT OR IGNORE INTO time_clock_entries/);
  assert.match(serviceWorker, /beta-time-clock-sync/);
  assert.match(serviceWorker, /indexedDB\.open/);
  assert.match(serviceWorker, /A batida continua pendente/);
});

test("API carrega cloudflare:workers somente dentro da função", () => {
  assert.doesNotMatch(clockApi, /^import .*cloudflare:workers/m);
  assert.match(clockApi, /await import\("cloudflare:workers"\)/);
});

test("portal possui manifesto instalável e cache PWA", () => {
  const parsedManifest = JSON.parse(manifest);
  assert.equal(parsedManifest.start_url, "/ponto");
  assert.equal(parsedManifest.display, "standalone");
  assert.doesNotMatch(parsedManifest.description, /rosto|facial/i);
  assert.match(
    clockPage,
    /navigator\.serviceWorker\.register\("\/ponto-sw\.js"/,
  );
  assert.match(serviceWorker, /CACHE_NAME = "beta-ponto-v132"/);
});
