import { setup } from '../apps/server/src/bootstrap/setup.js';

// Ejecutar el setup centralizado del servidor
setup().catch((err) => {
  console.error('Error durante la ejecución del setup:', err);
  process.exit(1);
});
