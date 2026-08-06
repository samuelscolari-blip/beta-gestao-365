import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";

const supervisorGate = fs.readFileSync(
  "app/components/SupervisorLoginGate.tsx",
  "utf8",
);
const access = fs.readFileSync("app/components/AccessGate.tsx", "utf8");
const page = fs.readFileSync("app/page.tsx", "utf8");
const pointAccessPage = fs.readFileSync("app/acesso-ponto/page.tsx", "utf8");
const masterAccess = fs.readFileSync("app/lib/master-point-access.ts", "utf8");
const employees = fs.readFileSync("app/lib/point-test-employees.ts", "utf8");
const registration = fs.readFileSync("app/lib/employee-registration.ts", "utf8");
const staffLogin = fs.readFileSync("app/api/staff-login/route.ts", "utf8");
const masterOptions = fs.readFileSync(
  "app/api/master-point-options/route.ts",
  "utf8",
);
const masterLogin = fs.readFileSync("app/api/master-point-login/route.ts", "utf8");
const staffLogout = fs.readFileSync("app/api/staff-logout/route.ts", "utf8");
const clockApi = fs.readFileSync("app/api/time-clock/route.js", "utf8");
const pointLayout = fs.readFileSync("app/ponto/layout.tsx", "utf8");
const peopleLayout = fs.readFileSync("app/pessoas/novo/layout.tsx", "utf8");

test("primeira etapa identifica o encarregado por matrícula e senha individual", () => {
  assert.match(page, /SupervisorLoginGate/);
  assert.match(supervisorGate, /ETAPA 1 DE 2/);
  assert.match(supervisorGate, /Matrícula do encarregado/);
  assert.match(supervisorGate, /5 primeiros dígitos do CPF/);
  assert.match(supervisorGate, /Senha individual/);
  assert.match(supervisorGate, /api\/staff-login/);
  assert.match(supervisorGate, /Continuar para os colaboradores/);
  assert.match(staffLogin, /verifyBusinessStaffCredentials/);
  assert.match(staffLogin, /role !== "encarregado"/);
  assert.match(staffLogin, /Somente um encarregado/);
});

test("segunda etapa mostra colaboradores somente após a sessão do encarregado", () => {
  assert.match(pointAccessPage, /businessStaffSessionFromHeaders/);
  assert.match(pointAccessPage, /supervisor\.role !== "encarregado"/);
  assert.match(pointAccessPage, /AccessGate/);
  assert.match(access, /CPF do colaborador/);
  assert.match(access, /Senha master do encarregado/);
  assert.match(access, /selectedEmployee\.name/);
  assert.match(access, /api\/master-point-options/);
  assert.match(access, /api\/master-point-login/);
  assert.match(masterOptions, /businessStaffSessionFromHeaders/);
  assert.match(masterOptions, /status: 401/);
  assert.match(masterLogin, /businessStaffSessionFromHeaders/);
  assert.match(masterLogin, /Identifique primeiro o encarregado/);
});

test("CPFs fictícios geram matrículas com cinco primeiros dígitos", () => {
  assert.match(employees, /cpf: "34135084079"[\s\S]*?name: "Carlos Eduardo"/);
  assert.match(employees, /cpf: "25804152033"[\s\S]*?name: "Ricardo Lima"/);
  assert.match(employees, /cpf: "74509305010"[\s\S]*?name: "João Ferreira"/);
  assert.match(employees, /registrationFromCpf/);
  assert.match(registration, /REGISTRATION_DIGIT_COUNT = 5/);
  assert.match(registration, /digits\.slice\(0, REGISTRATION_DIGIT_COUNT\)/);
});

test("senha master é informada uma única vez por sessão segura", () => {
  assert.match(masterAccess, /PBKDF2/);
  assert.match(masterAccess, /PASSWORD_ITERATIONS = 120_000/);
  assert.match(masterAccess, /MASTER_PASSWORD_SALT/);
  assert.match(masterAccess, /MASTER_PASSWORD_HASH/);
  assert.match(masterAccess, /MASTER_SESSION_TTL_SECONDS = 60 \* 60 \* 12/);
  assert.match(masterAccess, /HttpOnly; Secure; SameSite=Lax/);
  assert.doesNotMatch(masterAccess, /BET@Cons4\$%TR9!MV/);
  assert.match(masterLogin, /createMasterPointSession\(verified\.employee/);
  assert.match(masterLogin, /supervisor\.registration/);
  assert.match(masterLogin, /supervisor\.name/);
  assert.match(masterLogin, /uma única vez/i);
  assert.match(pointLayout, /masterPointSessionFromHeaders/);
  assert.match(pointLayout, /if \(masterSession\) return children/);
});

test("sessão master registra o encarregado real em cada batida", () => {
  assert.match(masterAccess, /actor_registration TEXT NOT NULL/);
  assert.match(masterAccess, /actor_name TEXT NOT NULL/);
  assert.match(masterAccess, /supervisor\.registration/);
  assert.match(masterAccess, /supervisor\.name/);
  assert.doesNotMatch(masterAccess, /actorRegistration: "MASTER"/);
  assert.doesNotMatch(masterAccess, /actorName: "Encarregado autorizado"/);
  assert.match(clockApi, /masterPointSessionFromHeaders/);
  assert.match(clockApi, /actor_registration/);
  assert.match(clockApi, /actor_name/);
  assert.match(clockApi, /actor_role/);
  assert.match(clockApi, /Ponto de \$\{employee\.name\} registrado/);
});

test("depois da senha master o encarregado pode alternar entre todos", () => {
  assert.match(clockApi, /POINT_TEST_EMPLOYEES/);
  assert.match(clockApi, /employees: availableEmployees\(\)/);
  assert.match(clockApi, /actor\.role === "encarregado"/);
  assert.doesNotMatch(clockApi, /MASTER_PASSWORD_HASH/);
  assert.doesNotMatch(clockApi, /verifyMasterPointAccess/);
});

test("logout encerra as duas camadas de sessão", () => {
  assert.match(staffLogout, /deleteMasterPointSession/);
  assert.match(staffLogout, /deleteStaffSession/);
  assert.match(staffLogout, /clearMasterPointSessionCookie/);
  assert.match(staffLogout, /clearStaffSessionCookie/);
});

test("cadastro de colaboradores continua exclusivo do administrador", () => {
  assert.match(peopleLayout, /SOLE_ADMIN_EMAIL/);
  assert.match(peopleLayout, /exclusivo do administrador/);
});
