import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const route = readFileSync(
  "app/api/integrations/ponto/sync/route.ts",
  "utf8",
);
const sync = readFileSync("app/lib/ponto-sync.ts", "utf8");
const modules = readFileSync("app/lib/modules.ts", "utf8");
const betaApp = readFileSync("app/components/BetaApp.tsx", "utf8");
const wrapper = readFileSync(
  "app/components/SecureBetaAppV102.tsx",
  "utf8",
);
const page = readFileSync("app/page.tsx", "utf8");
const wrangler = readFileSync("wrangler.jsonc", "utf8");

test("a sincronização lê o Cadastro de Funcionários persistente", () => {
  assert.match(sync, /listRecords\("people"\)/);
  assert.match(sync, /sourceRecordId: `beta-gestao-365:people:\$\{record\.id\}`/);
  assert.match(sync, /storedPeople\.filter\(\(record\) => record\.source !== DEMO_SOURCE\)/);
  assert.match(sync, /storedWorks\.filter\(\(record\) => record\.source !== DEMO_SOURCE\)/);
});

test("a matrícula operacional usa cinco dígitos sem enviar o CPF ao Ponto", () => {
  assert.match(sync, /onlyDigits\(person\.cpf\)/);
  assert.match(sync, /cpfDigits\.slice\(0, 5\)/);
  assert.match(sync, /ensureUniqueEmployeeNumbers\(payload\)/);

  const payloadBlock = sync.slice(
    sync.indexOf("const payload = people.map"),
    sync.indexOf("if (!payload.length)"),
  );
  for (const forbidden of [
    "cpf:",
    "cpfDigits:",
    "pis:",
    "rgNumber:",
    "ctpsNumber:",
    "birthDate:",
    "salary:",
  ]) {
    assert.doesNotMatch(payloadBlock, new RegExp(forbidden));
  }
});

test("perfil operacional é explícito, reversível e não depende do nome", () => {
  assert.match(sync, /INITIAL_TEAM_POINT_OPERATOR_CODES[\s\S]*"20029"[\s\S]*"20033"[\s\S]*"20044"/);
  assert.match(sync, /person\.employeeCode \|\| recordReference/);
  assert.match(sync, /person\.canRegisterTeamPoint/);
  assert.match(sync, /explicitPermission === true[\s\S]*"OPERATOR"/);
  assert.match(sync, /explicitPermission === false[\s\S]*"EMPLOYEE_SELF_SERVICE"/);
  assert.match(sync, /role\.includes\("ENCARREG"\).*"OPERATOR"/s);
  assert.match(sync, /role\.includes\("ENGENHEIRO"\).*"CHIEF_ENGINEER"/s);
  assert.doesNotMatch(sync, /ALINE|FLORAYNE|STEPHANY/i);
  assert.match(modules, /canRegisterTeamPoint/);
  assert.match(modules, /Pode registrar o ponto da equipe\?/);
  assert.match(modules, /options: \["Não", "Sim"\]/);
  assert.match(
    betaApp,
    /fields: \[[^\]]*"timeClockEmployeeId", "canRegisterTeamPoint", "timeClockSyncStatus"/,
  );
});

test("a ponte usa somente o domínio oficial do Beta Ponto", () => {
  assert.match(sync, /function pointBaseUrl/);
  assert.match(sync, /new URL\(DEFAULT_POINT_BASE_URL\)/);
  assert.match(sync, /parsed\.hostname === official\.hostname/);
  assert.match(sync, /return official\.origin/);
  assert.match(sync, /pointBaseUrl\(runtime\.BETA_PONTO_BASE_URL\)/);
  assert.match(
    wrangler,
    /"BETA_PONTO_BASE_URL": "https:\/\/beta-ponto-eletronico-365\.scolarisamuel\.workers\.dev"/,
  );
});

test("o Gestão valida e envia snapshot antes de uma ativação explícita", () => {
  const validateAt = sync.indexOf("/api/integrations/people/validate");
  const peopleAt = sync.indexOf("/api/integrations/people/sync");
  const environmentAt = sync.indexOf("/api/integrations/environment/mode");

  assert.ok(validateAt >= 0);
  assert.ok(peopleAt > validateAt);
  assert.ok(environmentAt > peopleAt);
  assert.match(sync, /origin: "BETA_GESTAO_365"/);
  assert.match(sync, /fullSnapshot: true/);
  assert.match(sync, /mode: "REAL"/);
  assert.match(sync, /GESTAO_365_SYNC_TOKEN/);
  assert.match(sync, /options\.activateReal === true/);
  assert.match(sync, /ensureInitialActivationSource\(payload\)/);
  assert.match(sync, /ensureInitialActivationSync\(payload, synced\)/);
  assert.match(sync, /semAcesso\.length/);
  assert.match(sync, /INITIAL_REAL_DIRECTORY_TOTAL = 42/);
  assert.match(sync, /INITIAL_REAL_WORKSITE = "ASA BRANCA"/);
  assert.match(sync, /person\.role === "OPERATOR"/);
  assert.match(sync, /ao menos um encarregado com perfil para registrar o ponto da equipe/);
});

test("Pessoas e Obras disparam sincronização automática após gravação", () => {
  assert.match(wrapper, /installAutomaticPointSync/);
  assert.match(wrapper, /pathname !== "\/api\/records"/);
  assert.match(wrapper, /moduleId === "people" \|\| moduleId === "works"/);
  assert.match(wrapper, /if \(affectsPoint && response\.ok\) schedule\(\)/);
  assert.match(wrapper, /requestPointSync\(originalFetch, false\)/);
  // A abertura administrativa também agenda uma recuperação silenciosa.
  // Não acoplamos o teste à posição exata dos comentários dessa rotina.
  assert.match(wrapper, /schedule\(\);/);
  assert.match(wrapper, /stopped = true/);
});

test("o botão manual continua existindo como conferência administrativa", () => {
  assert.match(wrapper, /if \(!isAdmin\) return/);
  assert.match(wrapper, /Ativar \/ sincronizar Ponto/);
  assert.match(wrapper, /requestPointSync\(window\.fetch\.bind\(window\), true\)/);
  assert.match(route, /requireSoleAdmin\(request\)/);
  assert.match(route, /body\.activateReal === true/);
  assert.match(route, /syncOfficialDirectoryToPoint/);
  assert.match(page, /SecureBetaAppV102/);
});

test("falhas remotas mostram o status e diagnósticos operacionais", () => {
  assert.match(sync, /httpStatus: response\.status/);
  assert.match(sync, /remoteUrl: response\.url/);
  assert.match(sync, /response\.status === 401/);
  assert.match(sync, /GESTAO_365_SYNC_TOKEN é idêntico nos dois Workers/);
  assert.match(sync, /response\.status === 404/);
});
