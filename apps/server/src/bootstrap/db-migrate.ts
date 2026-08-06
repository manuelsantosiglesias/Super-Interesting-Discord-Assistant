import { getDbConnection, closeDbConnection } from '../db/connection.js';
import { runMigrations } from '../db/migrator.js';

export async function migrate(): Promise<void> {
  const db = getDbConnection();
  console.log('Ejecutando migraciones de base de datos...');
  const { error, results } = await runMigrations(db);

  if (error) {
    console.error('Error al ejecutar migraciones:', error);
    throw error;
  }

  if (!results || results.length === 0) {
    console.log('No hay migraciones nuevas por aplicar.');
  } else {
    results.forEach((res) => {
      console.log(`Migración [${res.migrationName}]: ${res.status}`);
    });
  }
}

const isDirectRun = process.argv[1]?.replace(/\\/g, '/').endsWith('bootstrap/db-migrate.ts') || 
                    process.argv[1]?.replace(/\\/g, '/').endsWith('bootstrap/db-migrate.js');

if (isDirectRun) {
  migrate()
    .then(async () => {
      await closeDbConnection();
      process.exit(0);
    })
    .catch(async (err) => {
      await closeDbConnection();
      process.exit(1);
    });
}
