import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const route = readFileSync(
  "app/api/integrations/ponto/sync/route.ts",
  "utf8",
);
const wrapper = readFileSync(
  "app/components/SecureBetaAppV102.tsx",
  "utf8",
);
const page = readFileSync("app/page.tsx", "utf8");

test("a sincronização lê o Cadastro de Funcionários persistente", () => {
  assert.match(route, /listRecords\("people"\)/);
  assert.match(route, /sourceRecordId: `beta-gestao-365:people:\$\{record\.id\}`/);
  assert.match(route, /person\.registration \|\| person\.employeeCode \|\| record\.reference/);
});

test("documentos pessoais nunca entram no payload enviado ao Ponto", () => {
  const payloadBlock = route.slice(
    route.indexOf("const payload = people.map"),
    route.indexOf("if (!payload.length)"),
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
  assert.match(route, /role\.includes\("ENCARREG"\).*"OPERATOR"/s);
  assert.match(route, /role\.includes\("ENGENHEIRO"\).*"CHIEF_ENGINEER"/s);
  assert.match(route, /return "EMPLOYEE_SELF_SERVICE"/);
});

test("o Gestão valida antes de sincronizar e declara a origem oficial", () => {
  assert.match(route, /\/api\/integrations\/people\/validate/);
  assert.match(route, /\/api\/integrations\/people\/sync/);
  assert.match(route, /origin: "BETA_GESTAO_365"/);
  assert.match(route, /GESTAO_365_SYNC_TOKEN/);
});

test("somente o administrador ganha a ação visível de sincronização", () => {
  assert.match(wrapper, /if \(!isAdmin\) return/);
  assert.match(wrapper, /Sincronizar com Ponto/);
  assert.match(route, /requireSoleAdmin\(request\)/);
  assert.match(page, /SecureBetaAppV102/);
});
