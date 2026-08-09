import * as fs from 'fs';
import * as path from 'path';
import * as ini from 'ini';
import { z } from 'zod';

export const ConfigSchema = z.object({
  app: z.object({
    host: z.string().default('127.0.0.1'),
    port: z.coerce.number().default(3000),
    base_url: z.string().url(),
    web_url: z.string().url(),
    environment: z.enum(['development', 'production', 'test']).default('development'),
    session_secret: z.string().min(32, 'El secreto de sesión debe tener al menos 32 caracteres'),
    upload_directory: z.string().default('./data/sounds'),
    originals_directory: z.string().default('./data/originals'),
    temp_directory: z.string().default('./data/temp'),
    max_audio_size_mb: z.coerce.number().default(20),
    max_audio_duration_seconds: z.coerce.number().default(60),
    preserve_originals: z.preprocess((val) => val === 'true' || val === '1' || val === true, z.boolean()).default(false),
  }),
  mysql: z.object({
    host: z.string().default('127.0.0.1'),
    port: z.coerce.number().default(3306),
    user: z.string(),
    password: z.string(),
    database: z.string(),
    connection_limit: z.coerce.number().default(10),
  }),
  discord: z.object({
    application_id: z.string().optional(),
    bot_token: z.string().optional(),
    public_key: z.string().optional(),
    default_prefix: z.string().default('-sbdb'),
    leave_channel_after_seconds: z.coerce.number().default(240),
    register_slash_commands_on_start: z.preprocess((val) => val === 'true' || val === '1' || val === true, z.boolean()).default(true),
  }),
  security: z.object({
    allow_registration: z.preprocess((val) => val === 'true' || val === '1' || val === true, z.boolean()).default(false),
    session_duration_hours: z.coerce.number().default(12),
    max_login_attempts: z.coerce.number().default(5),
    login_lock_minutes: z.coerce.number().default(15),
    password_min_length: z.coerce.number().default(12),
    secure_cookies: z.preprocess((val) => val === 'true' || val === '1' || val === true, z.boolean()).default(false),
  }),
  audio: z.object({
    target_format: z.string().default('ogg'),
    target_codec: z.string().default('libopus'),
    target_bitrate: z.string().default('128k'),
    sample_rate: z.coerce.number().default(48000),
    channels: z.coerce.number().default(2),
  }),
});

export type Config = z.infer<typeof ConfigSchema>;

export function findProjectRoot(startDir: string = process.cwd()): string {
  let dir = startDir;
  // Limitar iteraciones para evitar bucle infinito en la raíz
  let iterations = 0;
  while (dir !== path.parse(dir).root && iterations < 20) {
    const pkgPath = path.join(dir, 'package.json');
    if (fs.existsSync(pkgPath)) {
      try {
        const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf8'));
        if (pkg.name === 'super-interesting-discord-assistant') {
          return dir;
        }
      } catch {
        // Ignorar errores al leer/parsear package.json corruptos o ajenos
      }
    }
    dir = path.dirname(dir);
    iterations++;
  }
  return startDir;
}

export function loadConfig(): Config {
  const root = findProjectRoot();
  const configPath = path.join(root, 'config', 'config.ini');

  if (!fs.existsSync(configPath)) {
    throw new Error(`El archivo de configuración no existe en la ruta: ${configPath}`);
  }

  const fileContent = fs.readFileSync(configPath, 'utf-8');
  const parsed = ini.parse(fileContent);

  const result = ConfigSchema.safeParse(parsed);
  if (!result.success) {
    console.error('Error al validar la configuración (config.ini):');
    result.error.errors.forEach((err) => {
      const fieldPath = err.path.join('.');
      console.error(`- Campo "${fieldPath}": ${err.message}`);
    });
    throw new Error('Configuración inválida (CONFIG_INVALID)');
  }

  return result.data;
}
