import assert from "node:assert/strict";
import { access, readFile } from "node:fs/promises";
import test from "node:test";

async function source(path) {
  return readFile(new URL(`../${path}`, import.meta.url), "utf8");
}

test("Cloudflare deployment binds the production D1 database", async () => {
  const configuration = JSON.parse(await source("wrangler.jsonc"));
  assert.equal(configuration.name, "beta-gestao-365");
  assert.equal(configuration.main, "./worker/index.ts");
  assert.equal(configuration.vars.DEPLOYMENT_PLATFORM, "cloudflare");
  assert.equal(configuration.d1_databases.length, 1);
  assert.equal(configuration.d1_databases[0].binding, "DB");
  assert.equal(
    configuration.d1_databases[0].database_name,
    "beta-gestao-365-db",
  );
  assert.match(
    configuration.d1_databases[0].database_id,
    /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i,
  );
});

test("Cloudflare routes the fixed Ponto host through public workers.dev", async () => {
  const configuration = JSON.parse(await source("wrangler.jsonc"));
  assert.ok(configuration.compatibility_flags.includes("nodejs_compat"));
  assert.ok(
    configuration.compatibility_flags.includes("global_fetch_strictly_public"),
  );
});

test("Vite uses Wrangler as the deployment source of truth", async () => {
  const vite = await source("vite.config.ts");
  assert.doesNotMatch(vite, /SITE_CREATOR_PLACEHOLDER_DATABASE_ID/);
  assert.doesNotMatch(vite, /localBindingConfig/);
  assert.match(vite, /cloudflare\(\{/);
});

test("production deploy runs only through GitHub Actions and workers.dev", async () => {
  const workflow = await source(".github/workflows/deploy-cloudflare.yml");
  assert.match(workflow, /branches: \[main\]/);
  assert.match(workflow, /secrets\.CLOUDFLARE_API_TOKEN/);
  assert.match(workflow, /secrets\.CLOUDFLARE_ACCOUNT_ID/);
  assert.match(workflow, /node scripts\/adopt-d1-migration-history\.mjs/);
  assert.match(workflow, /npm run db:migrate:remote/);
  assert.match(workflow, /test -f dist\/server\/wrangler\.json/);
  assert.match(workflow, /npx wrangler deploy/);
  assert.match(workflow, /--config dist\/server\/wrangler\.json/);
  assert.match(workflow, /--message "\$DEPLOY_MESSAGE"/);
  assert.match(
    workflow,
    /https:\/\/beta-gestao-365\.scolarisamuel\.workers\.dev\//,
  );
  assert.doesNotMatch(workflow, /chatgpt\.site/i);

  await assert.rejects(
    access(new URL("../.openai/hosting.json", import.meta.url)),
    (error) => error?.code === "ENOENT",
  );
});

test("Google identity is verified before becoming administrator identity", async () => {
  const worker = await source("worker/index.ts");
  const access = await source("app/lib/server-access.ts");
  assert.match(worker, /www\.googleapis\.com\/oauth2\/v3\/certs/);
  assert.match(worker, /crypto\.subtle\.verify/);
  assert.match(worker, /audienceMatches\(payload\.aud\)/);
  assert.match(worker, /payload\.email_verified !== true/);
  assert.match(worker, /email !== ADMIN_EMAIL/);
  assert.match(worker, /headers\.delete\("oai-authenticated-user-email"\)/);
  assert.match(worker, /headers\.set\("x-beta-authenticated-email", email\)/);
  assert.doesNotMatch(worker, /cf-access-jwt-assertion|POLICY_AUD|TEAM_DOMAIN/);
  assert.match(access, /x-beta-authenticated-email/);
  assert.doesNotMatch(access, /oai-authenticated-user-email/);
});
