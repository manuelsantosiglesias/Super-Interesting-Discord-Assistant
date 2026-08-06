import mysql from 'mysql2/promise';
import { loadConfig } from '@super-assistant/config';

export async function createDatabase(): Promise<void> {
  const config = loadConfig();
  const connection = await mysql.createConnection({
    host: config.mysql.host,
    port: config.mysql.port,
    user: config.mysql.user,
    password: config.mysql.password,
  });

  const dbName = config.mysql.database;
  console.log(`Creando base de datos '${dbName}' si no existe...`);
  await connection.query(
    `CREATE DATABASE IF NOT EXISTS \`${dbName}\` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;`
  );
  console.log(`Base de datos creada o ya existente.`);
  await connection.end();
}

// Permitir ejecución directa por CLI
const isDirectRun = process.argv[1]?.replace(/\\/g, '/').endsWith('bootstrap/db-create.ts') || 
                    process.argv[1]?.replace(/\\/g, '/').endsWith('bootstrap/db-create.js');

if (isDirectRun) {
  createDatabase().catch((err) => {
    console.error('Error al crear la base de datos:', err);
    process.exit(1);
  });
}
