import argon2 from 'argon2';
import mysql from 'mysql2/promise';

async function resetUserPassword() {
  const username = process.env.TARGET_USER || process.argv[2] || 'user1';
  const newPassword = process.env.NEW_PASSWORD || process.argv[3];

  if (!newPassword) {
    console.error('Error: Debes proporcionar la nueva contraseña. Uso: npx tsx scripts/reset-user-password.ts <username> <newPassword>');
    process.exit(1);
  }

  const hash = await argon2.hash(newPassword, { type: argon2.argon2id });

  const conn = await mysql.createConnection({
    host: process.env.DB_HOST || 'sida-db',
    user: process.env.DB_USER || 'sida_app',
    password: process.env.DB_PASSWORD || 'super_password_segura',
    database: process.env.DB_NAME || 'super_interesting_discord_assistant'
  });

  await conn.execute(
    'UPDATE users SET password_hash = ?, must_change_password = 0, updated_at = NOW() WHERE username = ?',
    [hash, username]
  );

  console.log(`Contraseña para el usuario '${username}' actualizada exitosamente.`);
  await conn.end();
}

resetUserPassword().catch(console.error);
