import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";

const access = fs.readFileSync("app/components/AccessGate.tsx", "utf8");
const page = fs.readFileSync("app/page.tsx", "utf8");
const staffAccess = fs.readFileSync("app/lib/staff-access.ts", "utf8");
const staffLogin = fs.readFileSync("app/api/staff-login/route.ts", "utf8");
const staffLogout = fs.readFileSync("app/api/staff-logout/route.ts", "utf8");
const clockApi = fs.readFileSync("app/api/time-clock/route.js", "utf8");
const pointLayout = fs.readFileSync("app/ponto/layout.tsx", "utf8");
const peopleLayout = fs.readFileSync("app/pessoas/novo/layout.tsx", "utf8");

test("sistema abre somente pela tela restrita", () => {
  assert.match(page, /AccessGate/);
  assert.match(page, /hasStaffSessionCookie/);
  assert.match(page, /staffSessionFromHeaders/);
  assert.match(access, /ÁREA RESTRITA/);
  assert.match(access, /Matrícula/);
  assert.match(access, /admin-google-login/);
  assert.match(access, /api\/staff-login/);
  assert.match(access, /Entrar com matrícula/);
});

test("Carlos é encarregado e Ricardo e João são colaboradores", () => {
  assert.match(
    staffAccess,
    /registration: "ENC-001"[\s\S]*?name: "Carlos Eduardo"[\s\S]*?role: "encarregado"/,
  );
  assert.match(
    staffAccess,
    /registration: "ENC-002"[\s\S]*?name: "Ricardo Lima"[\s\S]*?role: "colaborador"/,
  );
  assert.match(
    staffAccess,
    /registration: "ENC-003"[\s\S]*?name: "João Ferreira"[\s\S]*?role: "colaborador"/,
  );
  assert.match(staffAccess, /ON CONFLICT \(registration\) DO UPDATE SET/);
  assert.match(staffAccess, /role = excluded\.role/);
  assert.match(staffAccess, /PBKDF2/);
  assert.match(staffAccess, /120_000/);
  assert.doesNotMatch(staffAccess, /Beta@CE26!/);
  assert.doesNotMatch(staffAccess, /Beta@RL26!/);
  assert.doesNotMatch(staffAccess, /Beta@JF26!/);
});

test("login possui sessão curta, bloqueio e logout", () => {
  assert.match(staffAccess, /STAFF_SESSION_TTL_SECONDS = 60 \* 60 \* 12/);
  assert.match(staffAccess, /failed_attempts/);
  assert.match(staffAccess, /locked_until/);
  assert.match(staffAccess, /failedAttempts >= 5/);
  assert.match(staffLogin, /staffSessionCookie/);
  assert.match(staffAccess, /HttpOnly/);
  assert.match(staffLogout, /clearStaffSessionCookie/);
});

test("colaborador é direcionado ao ponto e encarregado mantém painel limitado", () => {
  assert.match(page, /staff\.role === "colaborador"/);
  assert.match(page, /redirect\("\/ponto"\)/);
  assert.match(page, /accessRole="encarregado"/);
  assert.doesNotMatch(pointLayout, /StaffPointIdentityLock/);
  assert.match(pointLayout, /staffSessionFromHeaders/);
});

test("servidor permite delegação somente ao encarregado ou administrador", () => {
  assert.match(
    clockApi,
    /actor\.role === "administrador" \|\| actor\.role === "encarregado"/,
  );
  assert.match(
    clockApi,
    /actor\.role === "colaborador" && actor\.registration === employeeCode/,
  );
  assert.match(clockApi, /actor_registration/);
  assert.match(clockApi, /actor_name/);
  assert.match(clockApi, /actor_role/);
});

test("cadastro de colaboradores continua exclusivo do administrador", () => {
  assert.match(peopleLayout, /SOLE_ADMIN_EMAIL/);
  assert.match(peopleLayout, /exclusivo do administrador/);
});
