import { Kysely } from 'kysely';
import { GuildConfigurationRepository, GuildConfiguration } from '../domain/index.js';
import { UniqueEntityID } from '@super-assistant/shared-kernel';

export class KyselyGuildConfigurationRepository implements GuildConfigurationRepository {
  constructor(private db: Kysely<any>) {}

  private async loadAllowedChannels(guildId: string): Promise<string[]> {
    const rows = await this.db
      .selectFrom('guild_allowed_channels')
      .select('discord_channel_id')
      .where('guild_id', '=', guildId)
      .execute();
    return rows.map((r: any) => r.discord_channel_id);
  }

  private mapToDomain(row: any, allowedChannels: string[]): GuildConfiguration {
    return new GuildConfiguration({
      discordGuildId: row.discord_guild_id,
      guildName: row.guild_name,
      commandPrefix: row.command_prefix,
      defaultVolume: Number(row.default_volume),
      leaveAfterSeconds: Number(row.leave_after_seconds),
      maxQueueSize: Number(row.max_queue_size),
      userCooldownSeconds: Number(row.user_cooldown_seconds),
      isEnabled: Boolean(row.is_enabled),
      allowedTextChannelIds: allowedChannels,
      installedAt: new Date(row.installed_at),
      updatedAt: new Date(row.updated_at)
    }, new UniqueEntityID(row.id));
  }

  async findById(id: string): Promise<GuildConfiguration | null> {
    const row = await this.db
      .selectFrom('discord_guilds')
      .selectAll()
      .where('id', '=', id)
      .executeTakeFirst();
    if (!row) return null;
    const channels = await this.loadAllowedChannels(row.id);
    return this.mapToDomain(row, channels);
  }

  async findByDiscordGuildId(discordGuildId: string): Promise<GuildConfiguration | null> {
    const row = await this.db
      .selectFrom('discord_guilds')
      .selectAll()
      .where('discord_guild_id', '=', discordGuildId)
      .executeTakeFirst();
    if (!row) return null;
    const channels = await this.loadAllowedChannels(row.id);
    return this.mapToDomain(row, channels);
  }

  async list(): Promise<GuildConfiguration[]> {
    const rows = await this.db
      .selectFrom('discord_guilds')
      .selectAll()
      .orderBy('installed_at', 'desc')
      .execute();

    const result: GuildConfiguration[] = [];
    for (const row of rows) {
      const channels = await this.loadAllowedChannels(row.id);
      result.push(this.mapToDomain(row, channels));
    }
    return result;
  }

  async save(config: GuildConfiguration): Promise<void> {
    await this.db.transaction().execute(async (trx) => {
      await trx
        .insertInto('discord_guilds')
        .values({
          id: config.id.toString(),
          discord_guild_id: config.discordGuildId,
          guild_name: config.guildName,
          command_prefix: config.commandPrefix,
          default_volume: config.defaultVolume,
          leave_after_seconds: config.leaveAfterSeconds,
          max_queue_size: config.maxQueueSize,
          user_cooldown_seconds: config.userCooldownSeconds,
          is_enabled: config.isEnabled ? 1 : 0,
          installed_at: config.installedAt,
          updated_at: config.updatedAt
        })
        .execute();

      if (config.allowedTextChannelIds.length > 0) {
        const values = config.allowedTextChannelIds.map((channelId) => ({
          guild_id: config.id.toString(),
          discord_channel_id: channelId,
          created_at: new Date()
        }));
        await trx.insertInto('guild_allowed_channels').values(values).execute();
      }
    });
  }

  async update(config: GuildConfiguration): Promise<void> {
    await this.db.transaction().execute(async (trx) => {
      await trx
        .updateTable('discord_guilds')
        .set({
          guild_name: config.guildName,
          command_prefix: config.commandPrefix,
          default_volume: config.defaultVolume,
          leave_after_seconds: config.leaveAfterSeconds,
          max_queue_size: config.maxQueueSize,
          user_cooldown_seconds: config.userCooldownSeconds,
          is_enabled: config.isEnabled ? 1 : 0,
          updated_at: config.updatedAt
        })
        .where('id', '=', config.id.toString())
        .execute();

      await trx
        .deleteFrom('guild_allowed_channels')
        .where('guild_id', '=', config.id.toString())
        .execute();

      if (config.allowedTextChannelIds.length > 0) {
        const values = config.allowedTextChannelIds.map((channelId) => ({
          guild_id: config.id.toString(),
          discord_channel_id: channelId,
          created_at: new Date()
        }));
        await trx.insertInto('guild_allowed_channels').values(values).execute();
      }
    });
  }
}
