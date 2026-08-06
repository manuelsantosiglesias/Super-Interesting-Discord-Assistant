import { Kysely, MysqlDialect } from 'kysely';
import { createPool } from 'mysql2';
import { loadConfig } from '@super-assistant/config';

let dbInstance: Kysely<any> | null = null;
let poolInstance: any = null;

export function getDbConnection(): Kysely<any> {
  if (dbInstance) return dbInstance;

  const config = loadConfig();

  poolInstance = createPool({
    host: config.mysql.host,
    port: config.mysql.port,
    user: config.mysql.user,
    password: config.mysql.password,
    database: config.mysql.database,
    connectionLimit: config.mysql.connection_limit,
    waitForConnections: true,
  });

  const dialect = new MysqlDialect({
    pool: poolInstance
  });

  dbInstance = new Kysely<any>({
    dialect
  });

  return dbInstance;
}

export async function closeDbConnection(): Promise<void> {
  if (poolInstance) {
    await new Promise<void>((resolve, reject) => {
      poolInstance.end((err: any) => {
        if (err) reject(err);
        else resolve();
      });
    });
    dbInstance = null;
    poolInstance = null;
  }
}
export function getPoolInstance() {
  return poolInstance;
}
