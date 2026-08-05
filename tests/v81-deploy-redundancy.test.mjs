import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const deployWorkflowPath = new URL(
  "../.github/workflows/deploy-cloudflare.yml",
  import.meta.url,
);
const validationWorkflowPath = new URL(
  "../.github/workflows/validate-cloudflare.yml",
  import.meta.url,
);

async function deployWorkflow() {
  return readFile(deployWorkflowPath, "utf8");
}

async function validationWorkflow() {
  return readFile(validationWorkflowPath, "utf8");
}

test("publicação aceita push, PR mesclada e acionamento manual", async () => {
  const content = await deployWorkflow();

  assert.match(content, /push:\s*\n\s*branches: \[main\]/);
  assert.match(
    content,
    /pull_request:\s*\n\s*branches: \[main\]\s*\n\s*types: \[closed\]/,
  );
  assert.match(content, /workflow_dispatch:/);
  assert.match(content, /github\.event\.pull_request\.merged == true/);
  assert.match(
    content,
    /github\.event\.pull_request\.head\.repo\.full_name == github\.repository/,
  );
});

test("eventos duplicados do mesmo commit compartilham o grupo e se cancelam", async () => {
  const content = await deployWorkflow();

  assert.match(
    content,
    /group: beta-gestao-365-production-\$\{\{ github\.event\.pull_request\.merge_commit_sha \|\| github\.sha \}\}/,
  );
  assert.match(content, /cancel-in-progress: true/);
});

test("publicação baixa e confirma exatamente o commit esperado", async () => {
  const content = await deployWorkflow();

  assert.match(content, /TARGET_SHA:/);
  assert.match(content, /ref: \$\{\{ env\.TARGET_SHA \}\}/);
  assert.match(content, /test "\$\(git rev-parse HEAD\)" = "\$TARGET_SHA"/);
  assert.match(content, /echo "commit=\$TARGET_SHA"/);
  assert.match(content, /expected="commit=\$TARGET_SHA"/);
  assert.match(content, /deployment-version\.txt/);
});

test("Cloudflare recebe o título do commit sem abandonar o artefato Vinext", async () => {
  const content = await deployWorkflow();

  assert.match(content, /git log -1 --pretty=%s/);
  assert.match(content, /DEPLOY_MESSAGE=\$deploy_message/);
  assert.match(content, /test -f dist\/server\/wrangler\.json/);
  assert.match(content, /npx wrangler deploy/);
  assert.match(content, /--config dist\/server\/wrangler\.json/);
  assert.match(content, /--message "\$DEPLOY_MESSAGE"/);
  assert.match(content, /echo "message=\$DEPLOY_MESSAGE"/);
  assert.doesNotMatch(content, /github\.event\.head_commit\.message/);
});

test("build, testes, D1 e diagnóstico precedem a conclusão", async () => {
  const content = await deployWorkflow();

  const lint = content.indexOf("npm run lint");
  const tests = content.indexOf("npm test");
  const migration = content.indexOf("npm run db:migrate:remote");
  const deploy = content.indexOf("npx wrangler deploy");
  const marker = content.indexOf("Confirmar o commit exato publicado");
  const browser = content.indexOf("npm run diagnose:live");

  assert.ok(lint > -1);
  assert.ok(tests > lint);
  assert.ok(migration > tests);
  assert.ok(deploy > migration);
  assert.ok(marker > deploy);
  assert.ok(browser > marker);
});

test("a verificação pós-deploy espera o Worker esquentar", async () => {
  /*
   * Comprovado, não suposto: com 45s, três publicações seguidas (#113,
   * #114 e #115) ficaram vermelhas mesmo tendo publicado — os passos
   * "Publicar o Worker" e "Confirmar o commit exato publicado" passaram
   * nas três. O mesmo diagnóstico, disparado à mão contra a MESMA
   * produção com 90s, passou.
   *
   * A espera curta transformava toda mesclagem num deploy vermelho por
   * um motivo que não era defeito. Sinal que sempre falha é sinal que se
   * aprende a ignorar, e aí a verificação deixa de proteger.
   */
  const content = await deployWorkflow();
  const esperas = [...content.matchAll(/DIAGNOSTIC_WAIT_MS: "(\d+)"/g)].map(
    (m) => Number(m[1]),
  );

  assert.ok(esperas.length >= 2, "Os dois diagnósticos pós-deploy sumiram.");
  for (const espera of esperas) {
    assert.ok(
      espera >= 90_000,
      `Espera de ${espera}ms é curta demais para um Worker recém-publicado.`,
    );
  }
});

test("a validação da PR testa o comando descrito sem publicar", async () => {
  const content = await validationWorkflow();

  const lint = content.indexOf("npm run lint");
  const build = content.indexOf("npm run build");
  const dryRun = content.indexOf("--dry-run");
  const tests = content.indexOf("node --test tests/*.test.mjs");

  assert.ok(lint > -1);
  assert.ok(build > lint);
  assert.ok(dryRun > build);
  assert.ok(tests > dryRun);
  assert.match(content, /--config dist\/server\/wrangler\.json/);
  assert.match(content, /--message "\$deploy_message"/);
});
