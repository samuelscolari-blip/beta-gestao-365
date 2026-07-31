import {
  sql,
  type ExtractTablesWithRelations,
} from "drizzle-orm";
import {
  Injectable,
  OnModuleDestroy,
} from "@nestjs/common";
import {
  drizzle,
  type PostgresJsDatabase,
  type PostgresJsTransaction,
} from "drizzle-orm/postgres-js";
import postgres, { type Sql } from "postgres";
import { loadConfig } from "../config/env";
import * as schema from "./schema";

export type TenantTransaction = PostgresJsTransaction<
  typeof schema,
  ExtractTablesWithRelations<typeof schema>
>;

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

@Injectable()
export class DatabaseService implements OnModuleDestroy {
  readonly client: Sql;
  readonly db: PostgresJsDatabase<typeof schema>;

  constructor() {
    const config = loadConfig();
    this.client = postgres(config.databaseUrl, {
      max: config.databasePoolSize,
      idle_timeout: 20,
      connect_timeout: 10,
      prepare: false,
    });
    this.db = drizzle(this.client, { schema });
  }

  async withTenant<T>(
    tenantId: string,
    work: (tx: TenantTransaction) => Promise<T>,
  ) {
    if (!UUID_PATTERN.test(tenantId)) {
      throw new Error("Identificador de empresa inválido.");
    }
    return this.db.transaction(async (tx) => {
      await tx.execute(
        sql`select set_config('app.tenant_id', ${tenantId}, true)`,
      );
      return work(tx);
    });
  }

  async ping() {
    await this.client`select 1`;
    return true;
  }

  async onModuleDestroy() {
    await this.client.end({ timeout: 5 });
  }
}
