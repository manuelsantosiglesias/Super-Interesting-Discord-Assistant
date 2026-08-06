import { NotFoundError, UniqueEntityID } from '@super-assistant/shared-kernel';
import { Config } from '@super-assistant/config';
import { GuildConfiguration, GuildConfigurationRepository } from '../domain/index.js';

export class RegisterGuild {
  constructor(
    private guildRepo: GuildConfigurationRepository,
    private config: Config
  ) {}

  async execute(input: { discordGuildId: string; guildName: string }): Promise<GuildConfiguration> {
    let guildConfig = await this.guildRepo.findByDiscordGuildId(input.discordGuildId);
    
    if (guildConfig) {
      guildConfig.update({
        guildName: input.guildName,
        isEnabled: true // Volver a habilitar si se reconecta
      });
      await this.guildRepo.update(guildConfig);
    } else {
      guildConfig = GuildConfiguration.create({
        discordGuildId: input.discordGuildId,
        guildName: input.guildName,
        commandPrefix: this.config.discord.default_prefix,
        defaultVolume: 1.0,
        leaveAfterSeconds: this.config.discord.leave_channel_after_seconds,
        maxQueueSize: 10,
        userCooldownSeconds: 2,
        isEnabled: true
      });
      await this.guildRepo.save(guildConfig);
    }

    return guildConfig;
  }
}

export class MarkGuildDisconnected {
  constructor(private guildRepo: GuildConfigurationRepository) {}

  async execute(discordGuildId: string): Promise<void> {
    const guildConfig = await this.guildRepo.findByDiscordGuildId(discordGuildId);
    if (guildConfig) {
      guildConfig.update({ isEnabled: false });
      await this.guildRepo.update(guildConfig);
    }
  }
}

export class ListGuilds {
  constructor(private guildRepo: GuildConfigurationRepository) {}

  async execute(): Promise<GuildConfiguration[]> {
    return this.guildRepo.list();
  }
}

export class GetGuild {
  constructor(private guildRepo: GuildConfigurationRepository) {}

  async execute(idOrDiscordId: string): Promise<GuildConfiguration> {
    // Intentar buscar por ID interno
    let guild = await this.guildRepo.findById(idOrDiscordId);
    if (!guild) {
      // Intentar buscar por ID de Discord
      guild = await this.guildRepo.findByDiscordGuildId(idOrDiscordId);
    }
    
    if (!guild) {
      throw new NotFoundError('DISCORD_GUILD_NOT_FOUND', 'No se encontró el servidor de Discord.');
    }
    return guild;
  }
}

export class UpdateGuildConfiguration {
  constructor(private guildRepo: GuildConfigurationRepository) {}

  async execute(
    discordGuildId: string,
    props: {
      commandPrefix?: string;
      defaultVolume?: number;
      leaveAfterSeconds?: number;
      maxQueueSize?: number;
      userCooldownSeconds?: number;
      isEnabled?: boolean;
      allowedTextChannelIds?: string[];
    }
  ): Promise<GuildConfiguration> {
    const guild = await this.guildRepo.findByDiscordGuildId(discordGuildId);
    if (!guild) {
      throw new NotFoundError('DISCORD_GUILD_NOT_FOUND', 'No se encontró el servidor de Discord.');
    }

    guild.update(props);
    await this.guildRepo.update(guild);
    return guild;
  }
}
