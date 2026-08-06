import { loadConfig } from '@super-assistant/config';
import { registerSlashCommands } from '@super-assistant/discord-integration';

export async function run(): Promise<void> {
  const config = loadConfig();
  const simpleLogger = {
    info: (msg: string) => console.log(`[INFO] ${msg}`),
    error: (msg: string, err: any) => console.error(`[ERROR] ${msg}`, err)
  };
  await registerSlashCommands(config, simpleLogger);
}

const isDirectRun = process.argv[1]?.replace(/\\/g, '/').endsWith('bootstrap/discord-register.ts') || 
                    process.argv[1]?.replace(/\\/g, '/').endsWith('bootstrap/discord-register.js');

if (isDirectRun) {
  run()
    .then(() => process.exit(0))
    .catch((err) => {
      console.error('Fallo al registrar comandos de Discord:', err);
      process.exit(1);
    });
}
