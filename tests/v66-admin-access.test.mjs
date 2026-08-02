import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const read = (path) => readFile(new URL(`../${path}`, import.meta.url), "utf8");

test("o site permanece público e usa o botão oficial do Google", async () => {
  const [page, component, worker, wrangler] = await Promise.all([
    read("app/page.tsx"),
    read("app/components/SecureBetaAppV66.tsx"),
    read("worker/index.ts"),
    read("wrangler.jsonc"),
  ]);

  assert.match(page, /SecureBetaAppV66/);
  assert.match(component, /Acesso administrativo/);
  assert.match(component, /accounts\.google\.com\/gsi\/client/);
  assert.match(component, /window\.google\.accounts\.id\.initialize/);
  assert.match(component, /window\.google\.accounts\.id\.renderButton/);
  assert.match(component, /\/admin-google-login/);
  assert.match(component, /1029361062935-9kd7sr8srn91vu9r4ekt0fjudfqbv1pk\.apps\.googleusercontent\.com/);
  assert.match(worker, /url\.pathname !== "\/admin-google-login"/);
  assert.match(worker, /url\.pathname === "\/admin-logout"/);
  assert.match(worker, /__Host-beta_google_admin/);
  assert.match(worker, /HttpOnly; Secure; SameSite=Lax; Path=\//);
  assert.match(worker, /ADMIN_EMAIL = "scolarisamuel@gmail\.com"/);
  assert.doesNotMatch(worker, /TEAM_DOMAIN|POLICY_AUD|ADMIN_SESSION_SECRET/);
  assert.doesNotMatch(worker, /cf-access-jwt-assertion/);
  assert.doesNotMatch(wrangler, /access_app|application_aud|"Restrito"/i);
});

test("o Worker valida assinatura e declarações do token Google", async () => {
  const worker = await read("worker/index.ts");

  assert.match(worker, /https:\/\/www\.googleapis\.com\/oauth2\/v3\/certs/);
  assert.match(worker, /header\.alg !== "RS256"/);
  assert.match(worker, /audienceMatches\(payload\.aud\)/);
  assert.match(worker, /payload\.iss !== "accounts\.google\.com"/);
  assert.match(worker, /payload\.iss !== "https:\/\/accounts\.google\.com"/);
  assert.match(worker, /payload\.exp <= now/);
  assert.match(worker, /payload\.email_verified !== true/);
  assert.match(worker, /crypto\.subtle\.verify/);
  assert.match(worker, /email !== ADMIN_EMAIL/);
  assert.match(worker, /isSameOrigin\(request\)/);
  assert.match(worker, /headers\.set\("x-beta-authenticated-email", email\)/);
});

test("Aprovados aparece também para visitantes e inclui aluguéis", async () => {
  const [component, decisions] = await Promise.all([
    read("app/components/SecureBetaAppV66.tsx"),
    read("app/lib/approved-decisions.ts"),
  ]);

  assert.match(component, /ApprovedDecisionFallback/);
  assert.match(component, /!props\.isAdmin \? <ApprovedDecisionFallback/);
  assert.match(component, /data-v66-approved="overview"/);
  assert.match(component, /data-v66-approved="tab"/);
  assert.match(component, /approvedDecisionModules/);
  assert.match(decisions, /"rentals"/);
  assert.match(decisions, /rentals: "Aluguéis"/);
  assert.doesNotMatch(decisions, /"pago"|"paga"/);
});

test("cartão corporativo exibe os dados exigidos para pagamento", async () => {
  const enhancements = await read("app/lib/v65-module-enhancements.ts");

  assert.match(enhancements, /appendPaymentEvidenceFields\(moduleMap\.cards/);
  assert.match(enhancements, /key: "paymentDate"/);
  assert.match(enhancements, /key: "paidAmount"/);
  assert.match(enhancements, /key: "receiptUrl"/);
});
