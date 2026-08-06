import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";

const clockPage = fs.readFileSync("app/ponto/page.tsx", "utf8");
const clockApi = fs.readFileSync("app/api/time-clock/route.js", "utf8");
const newEmployee = fs.readFileSync("app/pessoas/novo/page.tsx", "utf8");
const wrapper = fs.readFileSync("app/components/SecureBetaAppV131.tsx", "utf8");
const serviceWorker = fs.readFileSync("public/ponto-sw.js", "utf8");
const manifest = fs.readFileSync("public/ponto.webmanifest", "utf8");

test("V131 conecta a tela Pessoas ao cadastro do colaborador do zero", () => {
  assert.match(wrapper, /data-module=\\?"people\\?"/);
  assert.match(wrapper, /\/pessoas\/novo/);
  assert.match(newEmployee, /module:\s*"people"/);
  assert.match(newEmployee, /Salvar e cadastrar o rosto/);
  assert.match(newEmployee, /\/ponto\?/);
});

test("cadastro facial libera o ponto no mesmo celular", () => {
  assert.match(clockPage, /Cadastrar rosto e liberar ponto/);
  assert.match(
    clockPage,
    /Rosto cadastrado com sucesso\. Seu acesso ao ponto está liberado\./,
  );
  assert.match(clockPage, /deviceToken/);
  assert.match(clockApi, /device_token_hash/);
  assert.match(clockApi, /FACE_MATCH_THRESHOLD/);
});

test("batida preserva horário, foto e geolocalização", () => {
  assert.match(clockPage, /occurredAt/);
  assert.match(clockPage, /evidencePhoto/);
  assert.match(clockPage, /position\.coords\.latitude/);
  assert.match(clockPage, /position\.coords\.longitude/);
  assert.match(clockApi, /occurred_at/);
  assert.match(clockApi, /evidence_photo/);
  assert.match(clockApi, /latitude REAL/);
  assert.match(clockApi, /longitude REAL/);
});

test("fila offline usa clientEventId e servidor impede duplicidade", () => {
  assert.match(clockPage, /beta-gestao-365-time-clock/);
  assert.match(clockPage, /clientEventId = crypto\.randomUUID\(\)/);
  assert.match(clockPage, /Sem conexão\. O registro foi salvo neste celular/);
  assert.match(clockApi, /UNIQUE \(tenant_id, client_event_id\)/);
  assert.match(clockApi, /INSERT OR IGNORE INTO time_clock_events/);
  assert.match(serviceWorker, /beta-time-clock-sync/);
  assert.match(serviceWorker, /indexedDB\.open/);
});

test("API carrega cloudflare:workers somente dentro da função", () => {
  assert.doesNotMatch(clockApi, /^import .*cloudflare:workers/m);
  assert.match(clockApi, /await import\("cloudflare:workers"\)/);
});

test("portal possui manifesto instalável e service worker", () => {
  const parsedManifest = JSON.parse(manifest);
  assert.equal(parsedManifest.start_url, "/ponto");
  assert.equal(parsedManifest.display, "standalone");
  assert.match(
    clockPage,
    /navigator\.serviceWorker\.register\("\/ponto-sw\.js"/,
  );
  assert.match(serviceWorker, /caches\.open\(CACHE_NAME\)/);
});
