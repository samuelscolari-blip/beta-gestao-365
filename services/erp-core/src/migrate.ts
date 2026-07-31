import { createHash } from "node:crypto";
import { readdir, readFile } from "node:fs/promises";
import path from "node:path";
import postgres from "postgres";

async function migrate() {
  const databaseUrl = process.env.DATABASE_URL?.trim();
  if (!databaseUrl) throw new Error("DATABASE_URL não configurada.");
  const migrationsDirectory =
    process.env.MIGRATIONS_DIR || path.resolve(process.cwd(), "migrations");
  const files = (await readdir(migrationsDirectory))
    .filter((file) => /^\d+.*\.sql$/.test(file))
    .sort();
  if (!files.length) throw new Error("Nenhuma migração SQL encontrada.");

  const client = postgres(databaseUrl, {
    max: 1,
    prepare: false,
  });
  try {
    await client`
      create table if not exists core_schema_migrations (
        id text primary key,
        checksum text not null,
        applied_at timestamptz not null default now()
      )
    `;
    for (const file of files) {
      const sqlText = await readFile(
        path.join(migrationsDirectory, file),
        "utf8",
      );
      const checksum = createHash("sha256").update(sqlText).digest("hex");
      const [applied] = await client<{
        checksum: string;
      }[]>`
        select checksum
        from core_schema_migrations
        where id = ${file}
      `;
      if (applied) {
        if (applied.checksum !== checksum) {
          throw new Error(
            `A migração já aplicada ${file} foi alterada; crie uma nova versão.`,
          );
        }
        continue;
      }
      await client.begin(async (transaction) => {
        await transaction.unsafe(sqlText);
        await transaction`
          insert into core_schema_migrations (id, checksum)
          values (${file}, ${checksum})
        `;
      });
    }
  } finally {
    await client.end({ timeout: 5 });
  }
}

migrate().catch((error: unknown) => {
  const message =
    error instanceof Error ? error.message : "Falha desconhecida na migração.";
  process.stderr.write(`Migração interrompida: ${message}\n`);
  process.exitCode = 1;
});
