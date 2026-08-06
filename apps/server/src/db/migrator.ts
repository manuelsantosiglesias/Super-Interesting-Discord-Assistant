import * as path from 'path';
import { promises as fs } from 'fs';
import { Kysely, Migrator, FileMigrationProvider } from 'kysely';
import { findProjectRoot } from '@super-assistant/config';

export function createMigrator(db: Kysely<any>): Migrator {
  const root = findProjectRoot();
  return new Migrator({
    db,
    provider: new FileMigrationProvider({
      fs,
      path,
      migrationFolder: path.join(root, 'migrations')
    })
  });
}

export async function runMigrations(db: Kysely<any>): Promise<{ error?: any; results?: any[] }> {
  const migrator = createMigrator(db);
  const { error, results } = await migrator.migrateToLatest();
  return { error, results };
}

export async function rollbackMigration(db: Kysely<any>): Promise<{ error?: any; results?: any[] }> {
  const migrator = createMigrator(db);
  const { error, results } = await migrator.migrateDown();
  return { error, results };
}

export async function getMigrationStatus(db: Kysely<any>): Promise<readonly any[]> {
  const migrator = createMigrator(db);
  return migrator.getMigrations();
}
