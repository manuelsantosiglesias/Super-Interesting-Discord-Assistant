import readline from 'readline';
import { Writable } from 'stream';
import { getDbConnection, closeDbConnection } from '../db/connection.js';
import { KyselyUserRepository, Argon2PasswordHasher, CreateUser } from '@super-assistant/identity';
import { loadConfig } from '@super-assistant/config';

function askPassword(query: string): Promise<string> {
  const mutableStdout = new class extends Writable {
    private muted = false;
    public mute() { this.muted = true; }
    public unmute() { this.muted = false; }
    override _write(chunk: any, encoding: BufferEncoding, callback: () => void) {
      if (!this.muted) {
        process.stdout.write(chunk, encoding);
      }
      callback();
    }
  }();

  const rl = readline.createInterface({
    input: process.stdin,
    output: mutableStdout,
    terminal: true
  });

  return new Promise((resolve) => {
    mutableStdout.mute();
    rl.question(query, (answer) => {
      mutableStdout.unmute();
      rl.close();
      resolve(answer);
    });
  });
}

function ask(query: string): Promise<string> {
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout
  });
  return new Promise((resolve) => {
    rl.question(query, (answer) => {
      rl.close();
      resolve(answer);
    });
  });
}

export async function createAdmin(): Promise<void> {
  console.log('Creando el primer usuario administrador...');
  
  const username = await ask('Usuario: ');
  const password = await askPassword('Contraseña: ');

  if (!username || !password) {
    console.error('El nombre de usuario y contraseña son requeridos.');
    return;
  }

  const db = getDbConnection();
  const config = loadConfig();
  const userRepo = new KyselyUserRepository(db as any);
  const hasher = new Argon2PasswordHasher();
  const createUserUseCase = new CreateUser(userRepo, hasher, config);

  try {
    const user = await createUserUseCase.execute({
      username,
      password,
      role: 'ADMIN'
    });
    console.log(`\nAdministrador creado exitosamente: ${user.username} (ID: ${user.id.toString()})`);
  } catch (err: any) {
    console.error(`\nError al crear administrador: ${err.message}`);
    throw err;
  }
}

const isDirectRun = process.argv[1]?.replace(/\\/g, '/').endsWith('bootstrap/admin-create.ts') || 
                    process.argv[1]?.replace(/\\/g, '/').endsWith('bootstrap/admin-create.js');

if (isDirectRun) {
  createAdmin()
    .then(async () => {
      await closeDbConnection();
      process.exit(0);
    })
    .catch(async (err) => {
      await closeDbConnection();
      process.exit(1);
    });
}
