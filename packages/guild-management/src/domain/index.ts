import { Entity, UniqueEntityID, DomainError } from '@super-assistant/shared-kernel';

export interface GuildConfigurationProps {
  discordGuildId: string;
  guildName: string | null;
  commandPrefix: string;
  defaultVolume: number;
  leaveAfterSeconds: number;
  maxQueueSize: number;
  userCooldownSeconds: number;
  isEnabled: boolean;
  allowedTextChannelIds: string[];
  installedAt: Date;
  updatedAt: Date;
}

export class GuildConfiguration extends Entity<GuildConfigurationProps> {
  static create(
    props: Omit<GuildConfigurationProps, 'installedAt' | 'updatedAt' | 'allowedTextChannelIds'> & {
      allowedTextChannelIds?: string[];
    },
    id?: UniqueEntityID
  ): GuildConfiguration {
    if (props.defaultVolume < 0 || props.defaultVolume > 2) {
      throw new DomainError('GUILD_INVALID_VOLUME', 'El volumen por defecto debe estar entre 0.0 y 2.0.');
    }
    const now = new Date();
    return new GuildConfiguration({
      ...props,
      allowedTextChannelIds: props.allowedTextChannelIds || [],
      installedAt: now,
      updatedAt: now
    }, id);
  }

  get discordGuildId(): string { return this.props.discordGuildId; }
  get guildName(): string | null { return this.props.guildName; }
  get commandPrefix(): string { return this.props.commandPrefix; }
  get defaultVolume(): number { return this.props.defaultVolume; }
  get leaveAfterSeconds(): number { return this.props.leaveAfterSeconds; }
  get maxQueueSize(): number { return this.props.maxQueueSize; }
  get userCooldownSeconds(): number { return this.props.userCooldownSeconds; }
  get isEnabled(): boolean { return this.props.isEnabled; }
  get allowedTextChannelIds(): string[] { return this.props.allowedTextChannelIds; }
  get installedAt(): Date { return this.props.installedAt; }
  get updatedAt(): Date { return this.props.updatedAt; }

  public update(props: {
    guildName?: string | null;
    commandPrefix?: string;
    defaultVolume?: number;
    leaveAfterSeconds?: number;
    maxQueueSize?: number;
    userCooldownSeconds?: number;
    isEnabled?: boolean;
    allowedTextChannelIds?: string[];
  }): void {
    if (props.defaultVolume !== undefined && (props.defaultVolume < 0 || props.defaultVolume > 2)) {
      throw new DomainError('GUILD_INVALID_VOLUME', 'El volumen por defecto debe estar entre 0.0 y 2.0.');
    }

    if (props.guildName !== undefined) this.props.guildName = props.guildName;
    if (props.commandPrefix !== undefined) this.props.commandPrefix = props.commandPrefix;
    if (props.defaultVolume !== undefined) this.props.defaultVolume = props.defaultVolume;
    if (props.leaveAfterSeconds !== undefined) this.props.leaveAfterSeconds = props.leaveAfterSeconds;
    if (props.maxQueueSize !== undefined) this.props.maxQueueSize = props.maxQueueSize;
    if (props.userCooldownSeconds !== undefined) this.props.userCooldownSeconds = props.userCooldownSeconds;
    if (props.isEnabled !== undefined) this.props.isEnabled = props.isEnabled;
    if (props.allowedTextChannelIds !== undefined) this.props.allowedTextChannelIds = props.allowedTextChannelIds;

    this.props.updatedAt = new Date();
  }

  public isChannelAllowed(channelId: string): boolean {
    if (this.props.allowedTextChannelIds.length === 0) {
      return true; // Permitir todos si está vacío
    }
    return this.props.allowedTextChannelIds.includes(channelId);
  }
}

export interface GuildConfigurationRepository {
  findById(id: string): Promise<GuildConfiguration | null>;
  findByDiscordGuildId(discordGuildId: string): Promise<GuildConfiguration | null>;
  list(): Promise<GuildConfiguration[]>;
  save(config: GuildConfiguration): Promise<void>;
  update(config: GuildConfiguration): Promise<void>;
}
