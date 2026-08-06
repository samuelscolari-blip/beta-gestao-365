import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";

const access = fs.readFileSync("app/components/AccessGate.tsx", "utf8");
const page = fs.readFileSync("app/page.tsx", "utf8");
const staffAccess = fs.readFileSync("app/lib/staff-access.ts", "utf8");
const staffLogin = fs.readFileSync("app/api/staff-login/route.ts", "utf8");
const staffLogout = fs.readFileSync("app/api/staff-logout/route.ts", "utf8");
const pointLayout = fs.readFileSync("app/ponto/layout.tsx", "utf8");
const pointLock = fs.readFileSync(
  "app/components/StaffPointIdentityLock.tsx",
  "utf8",
);
const peopleLayout = fs.readFileSync("app/pessoas/novo/layout.tsx", "utf8");

test("sistema abre somente pela tela restrita", () => {
  assert.match(page, /AccessGate/);
  assert.match(page, /hasStaffSessionCookie/);
  assert.match(page, /staffSessionFromHeaders/);
  assert.match(access, /ÁREA RESTRITA/);
  assert.match(access, /Matrícula/);
  assert.match(access, /admin-google-login/);
  assert.match(access, /api\/staff-login/);
});

test("três encarregados possuem matrícula própria e hash, sem senha em texto puro", () => {
  for (const registration of ["ENC-001", "ENC-002", "ENC-003"]) {
    assert.match(staffAccess, new RegExp(registration));
  }
  for (const name of ["Carlos Eduardo", "Ricardo Lima", "João Ferreira"]) {
    assert.match(staffAccess, new RegExp(name));
  }
  assert.match(staffAccess, /PBKDF2/);
  assert.match(staffAccess, /120_000/);
  assert.match(staffAccess, /password_salt/);
  assert.match(staffAccess, /password_hash/);
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

test("encarregado fica limitado e vinculado ao próprio ponto", () => {
  assert.match(pointLayout, /StaffPointIdentityLock/);
  assert.match(pointLock, /employee-name/);
  assert.match(pointLock, /employee-code/);
  assert.match(pointLock, /readOnly = true/);
  assert.match(pointLock, /select\.disabled = true/);
  assert.match(pointLock, /O encarregado só pode registrar o próprio ponto/);
  assert.match(peopleLayout, /SOLE_ADMIN_EMAIL/);
  assert.match(peopleLayout, /exclusivo do administrador/);
});
