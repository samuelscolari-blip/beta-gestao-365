import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const read = (path) => readFile(new URL(`../${path}`, import.meta.url), "utf8");

test("o site permanece público e o login administrativo usa rota isolada", async () => {
  const [page, component, worker, wrangler] = await Promise.all([
    read("app/page.tsx"),
    read("app/components/SecureBetaAppV66.tsx"),
    read("worker/index.ts"),
    read("wrangler.jsonc"),
  ]);

  assert.match(page, /SecureBetaAppV66/);
  assert.match(component, /Acesso do administrador/);
  assert.match(component, /Entrar com Google/);
  assert.match(component, /href="\/admin-login"/);
  assert.match(component, /href="\/admin-logout"/);
  assert.match(worker, /url\.pathname === "\/admin-login"/);
  assert.match(worker, /url\.pathname === "\/admin-logout"/);
  assert.match(worker, /__Host-beta_admin_session/);
  assert.match(worker, /HttpOnly; Secure; SameSite=Lax; Path=\//);
  assert.match(worker, /ADMIN_EMAIL = "scolarisamuel@gmail\.com"/);
  assert.match(worker, /ADMIN_SESSION_SECRET/);
  assert.doesNotMatch(wrangler, /access_app|application_aud|"Restrito"/i);
});

test("a sessão interna é validada antes de liberar a identidade administrativa", async () => {
  const worker = await read("worker/index.ts");

  assert.match(worker, /crypto\.subtle\.sign/);
  assert.match(worker, /crypto\.subtle\.verify/);
  assert.match(worker, /payload\.email !== ADMIN_EMAIL/);
  assert.match(worker, /payload\.exp <= now/);
  assert.match(worker, /headers\.set\("x-beta-authenticated-email", email\)/);
  assert.match(worker, /cf-access-jwt-assertion/);
});

test("Aprovados aparece também para visitantes e inclui aluguéis", async () => {
  const component = await read("app/components/SecureBetaAppV66.tsx");

  assert.match(component, /ApprovedDecisionFallback/);
  assert.match(component, /!props\.isAdmin \? <ApprovedDecisionFallback/);
  assert.match(component, /data-v66-approved="overview"/);
  assert.match(component, /data-v66-approved="tab"/);
  assert.match(component, /"rentals"/);
  assert.match(component, /Aluguéis/);
});

test("cartão corporativo exibe os dados exigidos para pagamento", async () => {
  const enhancements = await read("app/lib/v65-module-enhancements.ts");

  assert.match(enhancements, /appendPaymentEvidenceFields\(moduleMap\.cards/);
  assert.match(enhancements, /key: "paymentDate"/);
  assert.match(enhancements, /key: "paidAmount"/);
  assert.match(enhancements, /key: "receiptUrl"/);
});
