import { Kysely, sql } from 'kysely';

export async function up(db: Kysely<any>): Promise<void> {
  // 1. users
  await db.schema
    .createTable('users')
    .addColumn('id', 'char(36)', (col) => col.primaryKey())
    .addColumn('username', 'varchar(80)', (col) => col.notNull().unique())
    .addColumn('password_hash', 'varchar(255)', (col) => col.notNull())
    .addColumn('role', sql`enum('ADMIN', 'USER')`, (col) => col.notNull())
    .addColumn('is_active', 'tinyint', (col) => col.notNull().defaultTo(1))
    .addColumn('must_change_password', 'tinyint', (col) => col.notNull().defaultTo(0))
    .addColumn('failed_login_attempts', 'integer', (col) => col.notNull().defaultTo(0))
    .addColumn('locked_until', 'datetime')
    .addColumn('last_login_at', 'datetime')
    .addColumn('created_at', 'datetime', (col) => col.notNull())
    .addColumn('updated_at', 'datetime', (col) => col.notNull())
    .execute();

  // Índice para is_active
  await db.schema
    .createIndex('idx_users_is_active')
    .on('users')
    .column('is_active')
    .execute();

  // 2. user_sessions
  await db.schema
    .createTable('user_sessions')
    .addColumn('id', 'char(64)', (col) => col.primaryKey())
    .addColumn('user_id', 'char(36)', (col) => col.notNull())
    .addColumn('expires_at', 'datetime', (col) => col.notNull())
    .addColumn('created_at', 'datetime', (col) => col.notNull())
    .addColumn('last_seen_at', 'datetime', (col) => col.notNull())
    .addColumn('ip_hash', 'varchar(128)')
    .addColumn('user_agent', 'varchar(500)')
    .addForeignKeyConstraint(
      'fk_sessions_user_id',
      ['user_id'],
      'users',
      ['id'],
      (cb) => cb.onDelete('cascade')
    )
    .execute();

  await db.schema.createIndex('idx_sessions_user_id').on('user_sessions').column('user_id').execute();
  await db.schema.createIndex('idx_sessions_expires_at').on('user_sessions').column('expires_at').execute();

  // 3. sounds
  await db.schema
    .createTable('sounds')
    .addColumn('id', 'char(36)', (col) => col.primaryKey())
    .addColumn('display_name', 'varchar(120)', (col) => col.notNull())
    .addColumn('command_name', 'varchar(64)', (col) => col.notNull().unique())
    .addColumn('description', 'varchar(500)')
    .addColumn('original_filename', 'varchar(255)', (col) => col.notNull())
    .addColumn('storage_filename', 'varchar(255)', (col) => col.notNull().unique())
    .addColumn('original_storage_filename', 'varchar(255)')
    .addColumn('mime_type', 'varchar(100)', (col) => col.notNull())
    .addColumn('normalized_format', 'varchar(20)', (col) => col.notNull())
    .addColumn('size_bytes', 'bigint', (col) => col.notNull())
    .addColumn('duration_ms', 'integer', (col) => col.notNull())
    .addColumn('sha256', 'char(64)', (col) => col.notNull())
    .addColumn('volume', 'decimal(4,3)', (col) => col.notNull().defaultTo(1.000))
    .addColumn('is_active', 'tinyint', (col) => col.notNull().defaultTo(1))
    .addColumn('uploaded_by', 'char(36)', (col) => col.notNull())
    .addColumn('created_at', 'datetime', (col) => col.notNull())
    .addColumn('updated_at', 'datetime', (col) => col.notNull())
    .addColumn('deleted_at', 'datetime')
    .addForeignKeyConstraint(
      'fk_sounds_uploaded_by',
      ['uploaded_by'],
      'users',
      ['id'],
      (cb) => cb.onDelete('restrict')
    )
    .execute();

  await db.schema.createIndex('idx_sounds_display_name').on('sounds').column('display_name').execute();
  await db.schema.createIndex('idx_sounds_is_active').on('sounds').column('is_active').execute();
  await db.schema.createIndex('idx_sounds_sha256').on('sounds').column('sha256').execute();
  await db.schema.createIndex('idx_sounds_created_at').on('sounds').column('created_at').execute();

  // 4. discord_guilds
  await db.schema
    .createTable('discord_guilds')
    .addColumn('id', 'char(36)', (col) => col.primaryKey())
    .addColumn('discord_guild_id', 'varchar(32)', (col) => col.notNull().unique())
    .addColumn('guild_name', 'varchar(150)')
    .addColumn('command_prefix', 'varchar(20)', (col) => col.notNull().defaultTo('-sbdb'))
    .addColumn('default_volume', 'decimal(4,3)', (col) => col.notNull().defaultTo(1.000))
    .addColumn('leave_after_seconds', 'integer', (col) => col.notNull().defaultTo(15))
    .addColumn('max_queue_size', 'integer', (col) => col.notNull().defaultTo(10))
    .addColumn('user_cooldown_seconds', 'integer', (col) => col.notNull().defaultTo(2))
    .addColumn('is_enabled', 'tinyint', (col) => col.notNull().defaultTo(1))
    .addColumn('installed_at', 'datetime', (col) => col.notNull())
    .addColumn('updated_at', 'datetime', (col) => col.notNull())
    .execute();

  // 5. guild_allowed_channels
  await db.schema
    .createTable('guild_allowed_channels')
    .addColumn('guild_id', 'char(36)', (col) => col.notNull())
    .addColumn('discord_channel_id', 'varchar(32)', (col) => col.notNull())
    .addColumn('created_at', 'datetime', (col) => col.notNull())
    .addPrimaryKey(['guild_id', 'discord_channel_id'])
    .addForeignKeyConstraint(
      'fk_allowed_channels_guild_id',
      ['guild_id'],
      'discord_guilds',
      ['id'],
      (cb) => cb.onDelete('cascade')
    )
    .execute();

  // 6. playback_events
  await db.schema
    .createTable('playback_events')
    .addColumn('id', 'char(36)', (col) => col.primaryKey())
    .addColumn('sound_id', 'char(36)')
    .addColumn('guild_id', 'char(36)')
    .addColumn('requested_by_discord_user_id', 'varchar(32)')
    .addColumn('requested_by_web_user_id', 'char(36)')
    .addColumn('text_channel_id', 'varchar(32)')
    .addColumn('voice_channel_id', 'varchar(32)')
    .addColumn('source', sql`enum('DISCORD_PREFIX', 'DISCORD_SLASH', 'WEB')`, (col) => col.notNull())
    .addColumn('status', sql`enum('QUEUED', 'PLAYING', 'COMPLETED', 'FAILED', 'REJECTED')`, (col) => col.notNull())
    .addColumn('error_code', 'varchar(80)')
    .addColumn('error_message', 'varchar(500)')
    .addColumn('requested_at', 'datetime', (col) => col.notNull())
    .addColumn('started_at', 'datetime')
    .addColumn('completed_at', 'datetime')
    .addForeignKeyConstraint(
      'fk_playback_sound_id',
      ['sound_id'],
      'sounds',
      ['id'],
      (cb) => cb.onDelete('set null')
    )
    .addForeignKeyConstraint(
      'fk_playback_guild_id',
      ['guild_id'],
      'discord_guilds',
      ['id'],
      (cb) => cb.onDelete('set null')
    )
    .addForeignKeyConstraint(
      'fk_playback_web_user_id',
      ['requested_by_web_user_id'],
      'users',
      ['id'],
      (cb) => cb.onDelete('set null')
    )
    .execute();

  await db.schema.createIndex('idx_playback_requested_at').on('playback_events').column('requested_at').execute();
  await db.schema.createIndex('idx_playback_guild_id').on('playback_events').column('guild_id').execute();
  await db.schema.createIndex('idx_playback_sound_id').on('playback_events').column('sound_id').execute();
  await db.schema.createIndex('idx_playback_status').on('playback_events').column('status').execute();

  // 7. audit_log
  await db.schema
    .createTable('audit_log')
    .addColumn('id', 'bigint', (col) => col.autoIncrement().primaryKey())
    .addColumn('user_id', 'char(36)')
    .addColumn('action', 'varchar(100)', (col) => col.notNull())
    .addColumn('entity_type', 'varchar(100)')
    .addColumn('entity_id', 'varchar(100)')
    .addColumn('metadata_json', 'json')
    .addColumn('ip_hash', 'varchar(128)')
    .addColumn('created_at', 'datetime', (col) => col.notNull())
    .addForeignKeyConstraint(
      'fk_audit_user_id',
      ['user_id'],
      'users',
      ['id'],
      (cb) => cb.onDelete('set null')
    )
    .execute();

  await db.schema.createIndex('idx_audit_user_created').on('audit_log').columns(['user_id', 'created_at']).execute();
  await db.schema.createIndex('idx_audit_action').on('audit_log').column('action').execute();
  await db.schema.createIndex('idx_audit_entity').on('audit_log').columns(['entity_type', 'entity_id']).execute();
  await db.schema.createIndex('idx_audit_created_at').on('audit_log').column('created_at').execute();
}

export async function down(db: Kysely<any>): Promise<void> {
  await db.schema.dropTable('audit_log').execute();
  await db.schema.dropTable('playback_events').execute();
  await db.schema.dropTable('guild_allowed_channels').execute();
  await db.schema.dropTable('discord_guilds').execute();
  await db.schema.dropTable('sounds').execute();
  await db.schema.dropTable('user_sessions').execute();
  await db.schema.dropTable('users').execute();
}
