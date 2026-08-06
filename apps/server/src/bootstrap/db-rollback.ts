import { getDbConnection, closeDbConnection } from '../db/connection.js';
import { rollbackMigration } from '../db/migrator.js';

export async function rollback(): Promise<void> {
  const db = getDbConnection();
  console.log('Revirtiendo última migración aplicada...');
  const { error, results } = await rollbackMigration(db);

  if (error) {
    console.error('Error al revertir migración:', error);
    throw error;
  }

  if (!results || results.length === 0) {
    console.log('No hay ninguna migración para revertir.');
  } else {
    results.forEach((res) => {
      console.log(`Migración revertida [${res.migrationName}]: ${res.status}`);
    });
  }
}

const isDirectRun = process.argv[1]?.replace(/\\/g, '/').endsWith('bootstrap/db-rollback.ts') || 
                    process.argv[1]?.replace(/\\/g, '/').endsWith('bootstrap/db-rollback.js');

if (isDirectRun) {
  rollback()
    .then(async () => {
      await closeDbConnection();
      process.exit(0);
    })
    .catch(async (err) => {
      await closeDbConnection();
      process.exit(1);
    });
}
