import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const read = (path) => readFile(new URL(`../${path}`, import.meta.url), "utf8");

test("o domínio continua público e o acesso administrativo usa rota isolada", async () => {
  const [component, route, worker, wrangler] = await Promise.all([
    read("app/components/SecureBetaAppV66.tsx"),
    read("app/admin-login/route.ts"),
    read("worker/index.ts"),
    read("wrangler.jsonc"),
  ]);

  assert.match(component, /Acesso do administrador/);
  assert.match(component, /Entrar com Google/);
  assert.match(component, /href="\/admin-login"/);
  assert.match(component, /href="\/cdn-cgi\/access\/logout"/);
  assert.match(route, /SOLE_ADMIN_EMAIL/);
  assert.match(route, /admin", "ativo"/);
  assert.match(worker, /requestCookie\(request, "CF_Authorization"\)/);
  assert.match(worker, /cf-access-jwt-assertion/);
  assert.doesNotMatch(wrangler, /"Restrito"|access_app|application_aud/i);
});

test("Aprovados aparece também antes do login e inclui aluguéis", async () => {
  const component = await read("app/components/SecureBetaAppV66.tsx");

  assert.match(component, /ApprovedDecisionFallback/);
  assert.match(component, /data-v66-approved="overview"/);
  assert.match(component, /data-v66-approved="tab"/);
  assert.match(component, /"rentals"/);
  assert.match(component, /Aluguéis/);
});

test("cartão corporativo permite informar os dados exigidos ao pagar", async () => {
  const enhancements = await read("app/lib/v65-module-enhancements.ts");

  assert.match(enhancements, /appendPaymentEvidenceFields\(moduleMap\.cards/);
  assert.match(enhancements, /key: "paymentDate"/);
  assert.match(enhancements, /key: "paidAmount"/);
  assert.match(enhancements, /key: "receiptUrl"/);
});
