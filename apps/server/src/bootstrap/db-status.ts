import { getDbConnection, closeDbConnection } from '../db/connection.js';
import { getMigrationStatus } from '../db/migrator.js';

export async function status(): Promise<void> {
  const db = getDbConnection();
  console.log('Obteniendo estado de las migraciones...');
  const migrations = await getMigrationStatus(db);

  if (migrations.length === 0) {
    console.log('No se encontraron archivos de migración.');
    return;
  }

  console.log('\n--- Estado de Migraciones ---');
  migrations.forEach((m) => {
    const execText = m.executedAt ? `Ejecutada el ${m.executedAt.toLocaleString()}` : 'PENDIENTE';
    console.log(`[${m.name}] - ${execText}`);
  });
  console.log('-----------------------------\n');
}

const isDirectRun = process.argv[1]?.replace(/\\/g, '/').endsWith('bootstrap/db-status.ts') || 
                    process.argv[1]?.replace(/\\/g, '/').endsWith('bootstrap/db-status.js');

if (isDirectRun) {
  status()
    .then(async () => {
      await closeDbConnection();
      process.exit(0);
    })
    .catch(async (err) => {
      await closeDbConnection();
      process.exit(1);
    });
}
