import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";

const access = fs.readFileSync("app/components/AccessGate.tsx", "utf8");
const page = fs.readFileSync("app/page.tsx", "utf8");
const masterAccess = fs.readFileSync("app/lib/master-point-access.ts", "utf8");
const employees = fs.readFileSync("app/lib/point-test-employees.ts", "utf8");
const registration = fs.readFileSync("app/lib/employee-registration.ts", "utf8");
const masterLogin = fs.readFileSync("app/api/master-point-login/route.ts", "utf8");
const oldStaffLogin = fs.readFileSync("app/api/staff-login/route.ts", "utf8");
const staffLogout = fs.readFileSync("app/api/staff-logout/route.ts", "utf8");
const clockApi = fs.readFileSync("app/api/time-clock/route.js", "utf8");
const pointLayout = fs.readFileSync("app/ponto/layout.tsx", "utf8");
const peopleLayout = fs.readFileSync("app/pessoas/novo/layout.tsx", "utf8");

test("tela pública oferece CPF, nome e senha master", () => {
  assert.match(page, /AccessGate/);
  assert.match(access, /CPF do colaborador/);
  assert.match(access, /Senha master do encarregado/);
  assert.match(access, /selectedEmployee\.name/);
  assert.match(access, /api\/master-point-options/);
  assert.match(access, /api\/master-point-login/);
  assert.match(access, /Abrir sistema de ponto/);
  assert.match(access, /admin-google-login/);
  assert.doesNotMatch(access, /api\/staff-login/);
});

test("CPFs fictícios geram matrículas com cinco primeiros dígitos", () => {
  assert.match(employees, /cpf: "34135084079"[\s\S]*?name: "Carlos Eduardo"/);
  assert.match(employees, /cpf: "25804152033"[\s\S]*?name: "Ricardo Lima"/);
  assert.match(employees, /cpf: "74509305010"[\s\S]*?name: "João Ferreira"/);
  assert.match(employees, /registrationFromCpf/);
  assert.match(registration, /REGISTRATION_DIGIT_COUNT = 5/);
  assert.match(registration, /digits\.slice\(0, REGISTRATION_DIGIT_COUNT\)/);
});

test("senha master usa hash e sessão segura sem expor o segredo", () => {
  assert.match(masterAccess, /PBKDF2/);
  assert.match(masterAccess, /PASSWORD_ITERATIONS = 120_000/);
  assert.match(masterAccess, /MASTER_PASSWORD_SALT/);
  assert.match(masterAccess, /MASTER_PASSWORD_HASH/);
  assert.match(masterAccess, /MASTER_SESSION_TTL_SECONDS = 60 \* 60 \* 12/);
  assert.match(masterAccess, /HttpOnly; Secure; SameSite=Lax/);
  assert.doesNotMatch(masterAccess, /BET@Cons4\$%TR9!MV/);
  assert.match(masterLogin, /createMasterPointSession/);
  assert.match(masterLogin, /masterPointSessionCookie/);
});

test("senha master libera apenas o portal de ponto", () => {
  assert.match(page, /masterPointSessionFromHeaders/);
  assert.match(page, /redirect\("\/ponto"\)/);
  assert.match(pointLayout, /masterPointSessionFromHeaders/);
  assert.doesNotMatch(page, /accessRole="encarregado"/);
  assert.match(oldStaffLogin, /acesso individual foi desativado/i);
  assert.match(oldStaffLogin, /status: 410/);
});

test("encarregado master pode alternar entre todos com autoria", () => {
  assert.match(clockApi, /masterPointSessionFromHeaders/);
  assert.match(clockApi, /POINT_TEST_EMPLOYEES/);
  assert.match(clockApi, /actorRegistration/);
  assert.match(clockApi, /Encarregado autorizado/);
  assert.match(clockApi, /actor_registration/);
  assert.match(clockApi, /actor_name/);
  assert.match(clockApi, /actor_role/);
  assert.match(clockApi, /Ponto de \$\{employee\.name\} registrado/);
});

test("logout limpa também a sessão master", () => {
  assert.match(staffLogout, /deleteMasterPointSession/);
  assert.match(staffLogout, /clearMasterPointSessionCookie/);
  assert.match(staffLogout, /clearStaffSessionCookie/);
});

test("cadastro de colaboradores continua exclusivo do administrador", () => {
  assert.match(peopleLayout, /SOLE_ADMIN_EMAIL/);
  assert.match(peopleLayout, /exclusivo do administrador/);
});
