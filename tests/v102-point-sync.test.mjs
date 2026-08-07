import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const route = readFileSync(
  "app/api/integrations/ponto/sync/route.ts",
  "utf8",
);
const sync = readFileSync("app/lib/ponto-sync.ts", "utf8");
const wrapper = readFileSync(
  "app/components/SecureBetaAppV102.tsx",
  "utf8",
);
const page = readFileSync("app/page.tsx", "utf8");

test("a sincronização lê o Cadastro de Funcionários persistente", () => {
  assert.match(sync, /listRecords\("people"\)/);
  assert.match(sync, /sourceRecordId: `beta-gestao-365:people:\$\{record\.id\}`/);
  assert.match(sync, /person\.registration \|\| person\.employeeCode \|\| record\.reference/);
});

test("documentos pessoais nunca entram no payload enviado ao Ponto", () => {
  const payloadBlock = sync.slice(
    sync.indexOf("const payload = people.map"),
    sync.indexOf("if (!payload.length)"),
  );
  for (const forbidden of [
    "person.cpf",
    "person.pis",
    "person.rgNumber",
    "person.ctpsNumber",
    "person.birthDate",
    "person.salary",
  ]) {
    assert.doesNotMatch(payloadBlock, new RegExp(forbidden.replace(".", "\\.")));
  }
});

test("perfil operacional é conservador", () => {
  assert.match(sync, /role\.includes\("ENCARREG"\).*"OPERATOR"/s);
  assert.match(sync, /role\.includes\("ENGENHEIRO"\).*"CHIEF_ENGINEER"/s);
  assert.match(sync, /return "EMPLOYEE_SELF_SERVICE"/);
});

test("o Gestão valida, envia snapshot completo e confirma BASE REAL nessa ordem", () => {
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
});

test("Pessoas e Obras disparam sincronização automática após gravação", () => {
  assert.match(wrapper, /installAutomaticPointSync/);
  assert.match(wrapper, /pathname !== "\/api\/records"/);
  assert.match(wrapper, /moduleId === "people" \|\| moduleId === "works"/);
  assert.match(wrapper, /if \(affectsPoint && response\.ok\) schedule\(\)/);
  // A abertura administrativa também agenda uma recuperação silenciosa.
  // Não acoplamos o teste à posição exata dos comentários dessa rotina.
  assert.match(wrapper, /schedule\(\);/);
  assert.match(wrapper, /stopped = true/);
});

test("o botão manual continua existindo como conferência administrativa", () => {
  assert.match(wrapper, /if \(!isAdmin\) return/);
  assert.match(wrapper, /Sincronizar com Ponto/);
  assert.match(route, /requireSoleAdmin\(request\)/);
  assert.match(route, /syncOfficialDirectoryToPoint/);
  assert.match(page, /SecureBetaAppV102/);
});
