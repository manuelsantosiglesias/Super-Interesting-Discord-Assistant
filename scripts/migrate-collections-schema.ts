import mysql from 'mysql2/promise';

async function migrateCollectionsSchema() {
  const conn = await mysql.createConnection({
    host: process.env.DB_HOST || 'sida-db',
    user: process.env.DB_USER || 'sida_app',
    password: process.env.DB_PASSWORD || 'super_password_segura',
    database: process.env.DB_NAME || 'super_interesting_discord_assistant'
  });

  try {
    await conn.execute('ALTER TABLE sound_collections ADD COLUMN icon VARCHAR(255) NULL');
    console.log('Columna icon añadida con éxito a sound_collections.');
  } catch (err: any) {
    console.log('Resultado (icon):', err.message);
  }

  try {
    await conn.execute("ALTER TABLE sound_collections ADD COLUMN color_theme VARCHAR(32) NULL DEFAULT 'cyan'");
    console.log('Columna color_theme añadida con éxito a sound_collections.');
  } catch (err: any) {
    console.log('Resultado (color_theme):', err.message);
  }

  await conn.end();
}

migrateCollectionsSchema().catch(console.error);
