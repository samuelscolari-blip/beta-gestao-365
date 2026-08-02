import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const read = (path) => readFile(new URL(`../${path}`, import.meta.url), "utf8");

test("a sessão administrativa fica vinculada ao navegador por 30 dias", async () => {
  const [worker, migration] = await Promise.all([
    read("worker/index.ts"),
    read("drizzle/0008_remember_admin_device.sql"),
  ]);

  assert.match(worker, /ADMIN_SESSION_TTL_SECONDS = 60 \* 60 \* 24 \* 30/);
  assert.match(worker, /randomSessionToken/);
  assert.match(worker, /sha256Hex/);
  assert.match(worker, /admin_device_sessions/);
  assert.match(worker, /createAdminDeviceSession/);
  assert.match(worker, /Max-Age=\$\{session\.maxAge\}/);
  assert.match(worker, /Priority=High/);
  assert.match(migration, /CREATE TABLE IF NOT EXISTS `admin_device_sessions`/);
  assert.match(migration, /token_hash/);
  assert.match(migration, /expires_at/);
});

test("o aviso fixo some e o login abre somente pelo avatar ou por necessidade", async () => {
  const [component, css] = await Promise.all([
    read("app/components/SecureBetaAppV66.tsx"),
    read("app/v66.css"),
  ]);

  assert.doesNotMatch(component, /Administrador ativo/);
  assert.doesNotMatch(component, /className={`v66-admin-access/);
  assert.match(component, /data-v69-admin-login="open"/);
  assert.match(component, /REMEMBERED_ADMIN_KEY/);
  assert.match(component, /beta:admin-required/);
  assert.match(component, /target\?\.closest\("\.top-avatar"\)/);
  assert.match(component, /window\.google\.accounts\.id\.prompt\(\)/);
  assert.match(component, /Este navegador ficará[\s\S]*reconhecido por 30 dias/);
  assert.match(css, /\.topbar-actions > \.sync-chip/);
  assert.match(css, /\.topbar-actions > \.tenant-chip/);
  assert.match(css, /display: none !important/);
  assert.match(css, /\.v69-admin-modal/);
});
