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

test("publicação baixa e confirma exatamente o commit esperado", async () => {
  const content = await deployWorkflow();

  assert.match(content, /TARGET_SHA:/);
  assert.match(content, /ref: \$\{\{ env\.TARGET_SHA \}\}/);
  assert.match(content, /test "\$\(git rev-parse HEAD\)" = "\$TARGET_SHA"/);
  assert.match(content, /echo "commit=\$TARGET_SHA"/);
  assert.match(content, /expected="commit=\$TARGET_SHA"/);
  assert.match(content, /deployment-version\.txt/);
});

test("build, testes, D1 e diagnóstico precedem a conclusão", async () => {
  const content = await deployWorkflow();

  const lint = content.indexOf("npm run lint");
  const tests = content.indexOf("npm test");
  const migration = content.indexOf("npm run db:migrate:remote");
  const deploy = content.indexOf("npm run deploy:cloudflare");
  const marker = content.indexOf("Confirmar o commit exato publicado");
  const browser = content.indexOf("npm run diagnose:live");

  assert.ok(lint > -1);
  assert.ok(tests > lint);
  assert.ok(migration > tests);
  assert.ok(deploy > migration);
  assert.ok(marker > deploy);
  assert.ok(browser > marker);
});

test("a validação da PR executa lint antes de build e testes", async () => {
  const content = await validationWorkflow();

  const lint = content.indexOf("npm run lint");
  const build = content.indexOf("npm run build");
  const tests = content.indexOf("node --test tests/*.test.mjs");

  assert.ok(lint > -1);
  assert.ok(build > lint);
  assert.ok(tests > build);
});
