import { Kysely, sql } from 'kysely';

export async function up(db: Kysely<any>): Promise<void> {
  // 1. sound_collections
  await db.schema
    .createTable('sound_collections')
    .ifNotExists()
    .addColumn('id', 'char(36)', (col) => col.primaryKey())
    .addColumn('name', 'varchar(120)', (col) => col.notNull())
    .addColumn('description', 'varchar(500)')
    .addColumn('created_by', 'char(36)', (col) => col.notNull())
    .addColumn('created_at', 'datetime', (col) => col.notNull())
    .addColumn('updated_at', 'datetime', (col) => col.notNull())
    .addForeignKeyConstraint(
      'fk_collections_created_by',
      ['created_by'],
      'users',
      ['id'],
      (cb) => cb.onDelete('cascade')
    )
    .execute();

  try {
    await db.schema
      .createIndex('idx_collections_created_by')
      .on('sound_collections')
      .column('created_by')
      .execute();
  } catch {}

  // 2. sound_collection_items (slots)
  await db.schema
    .createTable('sound_collection_items')
    .ifNotExists()
    .addColumn('id', 'char(36)', (col) => col.primaryKey())
    .addColumn('collection_id', 'char(36)', (col) => col.notNull())
    .addColumn('sound_id', 'char(36)')
    .addColumn('slot_index', 'integer', (col) => col.notNull())
    .addColumn('custom_label', 'varchar(120)')
    .addColumn('custom_image_url', sql`longtext`)
    .addColumn('color_theme', 'varchar(30)', (col) => col.defaultTo('emerald'))
    .addColumn('created_at', 'datetime', (col) => col.notNull())
    .addColumn('updated_at', 'datetime', (col) => col.notNull())
    .addForeignKeyConstraint(
      'fk_items_collection_id',
      ['collection_id'],
      'sound_collections',
      ['id'],
      (cb) => cb.onDelete('cascade')
    )
    .addForeignKeyConstraint(
      'fk_items_sound_id',
      ['sound_id'],
      'sounds',
      ['id'],
      (cb) => cb.onDelete('set null')
    )
    .execute();

  try {
    await db.schema
      .createIndex('idx_items_collection_slot')
      .on('sound_collection_items')
      .columns(['collection_id', 'slot_index'])
      .execute();
  } catch {}
}

export async function down(db: Kysely<any>): Promise<void> {
  await db.schema.dropTable('sound_collection_items').ifExists().execute();
  await db.schema.dropTable('sound_collections').ifExists().execute();
}
