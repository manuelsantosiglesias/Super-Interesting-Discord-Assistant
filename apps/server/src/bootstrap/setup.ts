import * as fs from 'fs';
import * as path from 'path';
import { spawnSync } from 'child_process';
import { loadConfig, findProjectRoot } from '@super-assistant/config';
import { getDbConnection, closeDbConnection } from '../db/connection.js';
import { runMigrations } from '../db/migrator.js';
import { KyselyUserRepository, Argon2PasswordHasher, CreateUser } from '@super-assistant/identity';
import { GenerateInstallUrl } from '@super-assistant/discord-integration';
import { createDatabase } from './db-create.js';
import { createAdmin } from './admin-create.js';
import { Client } from 'discord.js';
import ffmpegPath from 'ffmpeg-static';
import ffprobeStatic from 'ffprobe-static';

export async function setup(): Promise<void> {
  console.log('======================================================================');
  console.log('            SUPER INTERESTING DISCORD ASSISTANT - SETUP               ');
  console.log('======================================================================\n');

  const config = loadConfig();
  const root = findProjectRoot();

  // 1. Comprobar versión de Node.js
  const nodeVersion = process.version;
  const majorVersion = parseInt(nodeVersion.replace('v', '').split('.')[0], 10);
  if (majorVersion < 22) {
    console.error(`[ERROR] Node.js versión mínima compatible: 22. Versión actual: ${nodeVersion}`);
    process.exit(1);
  }
  console.log(`[OK] Node.js es compatible (${nodeVersion})`);

  // 2. Comprobar FFmpeg y FFprobe
  const ffmpegExe = (ffmpegPath as any)?.path || (ffmpegPath as unknown as string) || 'ffmpeg';
  const ffprobeExe = (ffprobeStatic as any)?.path || (ffprobeStatic as unknown as string) || 'ffprobe';

  const ffmpegCheck = spawnSync(ffmpegExe, ['-version']);
  const ffprobeCheck = spawnSync(ffprobeExe, ['-version']);

  const hasFFmpeg = ffmpegCheck.status === 0 || ffmpegCheck.status === null;
  const hasFFprobe = ffprobeCheck.status === 0 || ffprobeCheck.status === null;

  if (!hasFFmpeg || !hasFFprobe) {
    console.error('[ERROR] FFmpeg o FFprobe no están disponibles. Asegúrate de instalar dependencias de npm.');
    process.exit(1);
  }
  console.log(`[OK] FFmpeg y FFprobe están disponibles.`);

  // 3. Crear base de datos
  try {
    await createDatabase();
  } catch (err: any) {
    console.error('[ERROR] No se pudo acceder a MySQL. Verifica que el servidor MySQL esté corriendo.', err.message);
    process.exit(1);
  }
  console.log('[OK] Conexión MySQL establecida y base de datos lista.');

  // 4. Crear directorios locales
  const uploadDir = path.resolve(root, config.app.upload_directory);
  const originalsDir = path.resolve(root, config.app.originals_directory);
  const tempDir = path.resolve(root, config.app.temp_directory);

  fs.mkdirSync(uploadDir, { recursive: true });
  fs.mkdirSync(originalsDir, { recursive: true });
  fs.mkdirSync(tempDir, { recursive: true });
  console.log('[OK] Directorios de datos verificados.');

  // 5. Ejecutar migraciones
  const db = getDbConnection();
  const { error, results } = await runMigrations(db);
  if (error) {
    console.error('[ERROR] Error al ejecutar las migraciones:', error);
    await closeDbConnection();
    process.exit(1);
  }
  console.log('[OK] Migraciones aplicadas correctamente.');

  // 6. Crear primer administrador (si no existen usuarios)
  const userRepo = new KyselyUserRepository(db as any);
  const existingUsers = await userRepo.list({ page: 1, pageSize: 1 });
  if (existingUsers.items.length === 0) {
    await createAdmin();
  } else {
    console.log('[INFO] Ya existen usuarios registrados en la base de datos. Saltando creación de administrador.');
  }

  // 7. Validar Discord
  let discordStatus = 'No configurado';
  let installUrl = '';
  if (config.discord.bot_token && config.discord.application_id) {
    console.log('Verificando token de Discord...');
    try {
      const client = new Client({ intents: [] });
      await client.login(config.discord.bot_token);
      discordStatus = 'Conectado (OK)';
      installUrl = new GenerateInstallUrl(config).execute();
      await client.destroy();
    } catch (err: any) {
      discordStatus = `Error al conectar (${err.message})`;
    }
  }

  console.log('\n======================================================================');
  console.log('              CONFIGURACIÓN DE LA APLICACIÓN COMPLETADA               ');
  console.log('======================================================================');
  console.log(`Base de datos:       OK`);
  console.log(`Directorios:         OK`);
  console.log(`FFmpeg:              OK`);
  console.log(`Discord status:      ${discordStatus}`);
  console.log(`Panel web:           ${config.app.web_url}`);
  console.log(`API URL:             ${config.app.base_url}`);
  console.log(`Documentación API:   ${config.app.base_url}/docs`);
  if (installUrl) {
    console.log(`Instalar bot:        ${installUrl}`);
  }
  console.log('======================================================================\n');
}

const isDirectRun = process.argv[1]?.replace(/\\/g, '/').endsWith('bootstrap/setup.ts') || 
                    process.argv[1]?.replace(/\\/g, '/').endsWith('bootstrap/setup.js');

if (isDirectRun) {
  setup()
    .then(async () => {
      await closeDbConnection();
      process.exit(0);
    })
    .catch(async (err) => {
      await closeDbConnection();
      console.error('Error durante la instalación:', err);
      process.exit(1);
    });
}
