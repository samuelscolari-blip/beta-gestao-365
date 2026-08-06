/*
 * Importações de `cloudflare:` no código do Worker.
 *
 * Regressão real: o build da Cloudflare falhou em 54 segundos, sem mensagem
 * útil, porque uma rota nova trouxe `import { env } from "cloudflare:workers"`
 * no topo do arquivo.
 *
 * Esses módulos só existem dentro do runtime da Cloudflare. A importação
 * estática é içada para o topo do bundle do Worker e avaliada antes de tudo —
 * e a validação do artefato, que carrega `dist/server/index.js` no Node para
 * conferir o export default, morre com ERR_UNSUPPORTED_ESM_URL_SCHEME.
 *
 * A forma tardia adia o carregamento para a chamada, que só acontece dentro
 * do Worker. É o padrão que `db/records.ts` já seguia.
 *
 * O `npm run build` acusa isso, mas só depois de empacotar, e com um erro
 * cru do Node. Este teste acusa em milissegundos e diz o que fazer.
 */
import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import test from "node:test";

const PASTAS = ["app", "db", "packages"];
const EXTENSOES = [".ts", ".tsx", ".mjs", ".js"];

function listarFontes(diretorio) {
  return readdirSync(diretorio, { withFileTypes: true }).flatMap((entrada) => {
    const caminho = join(diretorio, entrada.name);
    if (entrada.name === "node_modules" || entrada.name === "dist") return [];
    if (entrada.isDirectory()) return listarFontes(caminho);
    return EXTENSOES.some((fim) => entrada.name.endsWith(fim)) ? [caminho] : [];
  });
}

test("nenhum arquivo do Worker importa `cloudflare:` estaticamente", () => {
  const estatica = /^\s*import\s[^\n]*from\s+["']cloudflare:/m;

  const infratores = PASTAS.flatMap(listarFontes).filter((caminho) =>
    estatica.test(readFileSync(caminho, "utf8")),
  );

  assert.deepEqual(
    infratores,
    [],
    "Importação estática de módulo `cloudflare:`. Ela é avaliada no topo do " +
      "bundle e derruba a validação do artefato no Node — o build da " +
      "Cloudflare falha antes de publicar, com um erro que não aponta o " +
      "arquivo. Use a forma tardia dentro da função que precisa do valor:\n\n" +
      '  async function workerEnv() {\n' +
      '    const { env } = await import("cloudflare:workers");\n' +
      "    return env;\n" +
      "  }\n",
  );
});

test("o acesso ao banco continua existindo, pela forma tardia", () => {
  /*
   * Proibir a importação estática sem verificar isto permitiria "resolver" o
   * teste apagando o acesso ao D1 — que é o contrário do objetivo.
   */
  for (const arquivo of ["db/index.ts", "db/records.ts"]) {
    const fonte = readFileSync(arquivo, "utf8");
    assert.match(
      fonte,
      /await import\("cloudflare:workers"\)/,
      `${arquivo} precisa obter o binding do D1 pela importação tardia.`,
    );
    assert.match(fonte, /env\.DB/, `${arquivo} perdeu o acesso ao banco.`);
  }
});

test("a validação do artefato explica esse erro em vez de despejar a pilha", () => {
  const script = readFileSync("scripts/validate-artifact.sh", "utf8");
  assert.match(script, /ERR_UNSUPPORTED_ESM_URL_SCHEME/);
  assert.match(script, /importação estática pela tardia/);
});
