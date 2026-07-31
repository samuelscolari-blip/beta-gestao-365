import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
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

test("Vite uses Wrangler as the deployment source of truth", async () => {
  const vite = await source("vite.config.ts");
  assert.doesNotMatch(vite, /SITE_CREATOR_PLACEHOLDER_DATABASE_ID/);
  assert.doesNotMatch(vite, /localBindingConfig/);
  assert.match(vite, /cloudflare\(\{/);
});

test("Cloudflare identity is verified before becoming administrator identity", async () => {
  const worker = await source("worker/index.ts");
  const access = await source("app/lib/server-access.ts");
  assert.match(worker, /cf-access-jwt-assertion/);
  assert.match(worker, /crypto\.subtle\.verify/);
  assert.match(worker, /POLICY_AUD/);
  assert.match(worker, /TEAM_DOMAIN/);
  assert.match(worker, /headers\.delete\("oai-authenticated-user-email"\)/);
  assert.match(worker, /headers\.set\("x-beta-authenticated-email", email\)/);
  assert.match(access, /x-beta-authenticated-email/);
});
