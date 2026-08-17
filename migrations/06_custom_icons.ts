import { Kysely, sql } from 'kysely';

export async function up(db: Kysely<any>): Promise<void> {
  await db.schema
    .createTable('custom_icons')
    .ifNotExists()
    .addColumn('id', 'char(36)', (col) => col.primaryKey())
    .addColumn('name', 'varchar(120)', (col) => col.notNull())
    .addColumn('url', 'varchar(500)', (col) => col.notNull())
    .addColumn('category', 'varchar(30)', (col) => col.notNull().defaultTo('Memes'))
    .addColumn('is_builtin', 'tinyint', (col) => col.notNull().defaultTo(0))
    .addColumn('uploaded_by', 'char(36)')
    .addColumn('created_at', 'datetime', (col) => col.notNull())
    .execute();

  // Seed iconos estándar y memes por defecto si la tabla está vacía
  const countRes = await db.selectFrom('custom_icons').select(sql`count(*) as cnt`).executeTakeFirst();
  const total = Number((countRes as any)?.cnt || 0);

  if (total === 0) {
    const now = new Date();

    const standardIcons = [
      { id: 'std-music', name: 'Música', url: '/iconos/music.svg', category: 'Standard', is_builtin: 1, created_at: now },
      { id: 'std-sparkles', name: 'Destellos', url: '/iconos/sparkles.svg', category: 'Standard', is_builtin: 1, created_at: now },
      { id: 'std-fire', name: 'Fuego', url: '/iconos/fire.svg', category: 'Standard', is_builtin: 1, created_at: now },
      { id: 'std-game', name: 'Juegos', url: '/iconos/game.svg', category: 'Standard', is_builtin: 1, created_at: now },
      { id: 'std-zap', name: 'Rayo', url: '/iconos/zap.svg', category: 'Standard', is_builtin: 1, created_at: now },
      { id: 'std-bot', name: 'Bot', url: '/iconos/bot.svg', category: 'Standard', is_builtin: 1, created_at: now },
      { id: 'std-star', name: 'Estrella', url: '/iconos/star.svg', category: 'Standard', is_builtin: 1, created_at: now },
      { id: 'std-clock', name: 'Reloj', url: '/iconos/clock.svg', category: 'Standard', is_builtin: 1, created_at: now }
    ];

    const memeIcons = [
      { id: 'meme-gato', name: 'Gato Meme', url: '/memes/gato.jpg', category: 'Memes', is_builtin: 0, created_at: now },
      { id: 'meme-smile', name: 'Smile Meme', url: '/memes/smile.jpg', category: 'Memes', is_builtin: 0, created_at: now },
      { id: 'meme-kevin', name: 'Kevin', url: '/memes/kevin.png', category: 'Memes', is_builtin: 0, created_at: now },
      { id: 'meme-luis', name: 'Luis', url: '/memes/luis.png', category: 'Memes', is_builtin: 0, created_at: now },
      { id: 'meme-xocas', name: 'Xocas', url: '/memes/xocas.jpg', category: 'Memes', is_builtin: 0, created_at: now },
      { id: 'meme-rage', name: 'Rage Quit', url: '/memes/rage-quit-meme-4.jpg', category: 'Memes', is_builtin: 0, created_at: now },
      { id: 'meme-streamer', name: 'Streamer', url: '/memes/streamer.png', category: 'Memes', is_builtin: 0, created_at: now },
      { id: 'meme-streamer-vec', name: 'Streamer Silhouette', url: '/memes/online-streamer-silhouette-icon-vector.jpg', category: 'Memes', is_builtin: 0, created_at: now },
      { id: 'meme-download', name: 'Download', url: '/memes/download.jpg', category: 'Memes', is_builtin: 0, created_at: now },
      { id: 'meme-music-jpg', name: 'Música Retro', url: '/memes/music.jpg', category: 'Memes', is_builtin: 0, created_at: now },
      { id: 'meme-74z7dh', name: 'Meme 74z7dh', url: '/memes/74z7dh.png', category: 'Memes', is_builtin: 0, created_at: now }
    ];

    for (const icon of [...standardIcons, ...memeIcons]) {
      await db.insertInto('custom_icons').values(icon).execute();
    }
  }
}

export async function down(db: Kysely<any>): Promise<void> {
  await db.schema.dropTable('custom_icons').ifExists().execute();
}
