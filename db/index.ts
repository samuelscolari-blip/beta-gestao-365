import { drizzle } from "drizzle-orm/d1";
import * as schema from "./schema";

/*
 * O binding do D1 vem por importação TARDIA, e não estática.
 *
 * `cloudflare:workers` só existe dentro do runtime da Cloudflare. Uma
 * importação estática é içada para o topo do bundle do Worker, e aí a
 * validação do artefato — que carrega `dist/server/index.js` no Node para
 * conferir o export default — quebra com ERR_UNSUPPORTED_ESM_URL_SCHEME. O
 * build da Cloudflare falha antes de publicar.
 *
 * Enquanto nenhuma rota importava este arquivo, ele passava despercebido: o
 * empacotador o descartava e o topo do bundle ficava limpo. Bastaria alguém
 * chamar `getDb()` de uma rota para o deploy quebrar sem causa aparente. É o
 * mesmo padrão já adotado em `db/records.ts`.
 */
async function workerEnvironment() {
  const { env } = await import("cloudflare:workers");
  return env;
}

export async function getDb() {
  const env = await workerEnvironment();

  if (!env.DB) {
    throw new Error(
      "Cloudflare D1 binding `DB` is unavailable. Confirm the D1 configuration in wrangler.jsonc before using the database."
    );
  }

  return drizzle(env.DB, { schema });
}
