import { 
  AppError, 
  ConflictError, 
  NotFoundError, 
  UniqueEntityID 
} from '@super-assistant/shared-kernel';
import { Config } from '@super-assistant/config';
import { ResolveSoundByCommand, SoundRepository } from '@super-assistant/soundboard';
import { GuildConfigurationRepository, GetGuild } from '@super-assistant/guild-management';
import { PlaybackRequest, PlaybackEventRepository } from '../domain/index.js';
import { PlaybackQueueManager } from '../infrastructure/voice-queue.js';

export class GenerateInstallUrl {
  constructor(private config: Config) {}

  execute(): string {
    const clientId = this.config.discord.application_id;
    if (!clientId) {
      return '';
    }
    // Permisos: View Channel (1024) + Send Messages (2048) + Read Msg History (65536) + Connect (1048576) + Speak (2097152) = 3213312
    const permissions = '3213312';
    const scopes = encodeURIComponent('bot applications.commands');
    return `https://discord.com/oauth2/authorize?client_id=${clientId}&permissions=${permissions}&scope=${scopes}`;
  }
}

export class PlaySoundFromWeb {
  constructor(
    private soundRepo: SoundRepository,
    private guildRepo: GuildConfigurationRepository,
    private queueManager: PlaybackQueueManager
  ) {}

  async execute(input: {
    soundId: string;
    discordGuildId: string;
    voiceChannelId: string;
    webUserId: string;
  }): Promise<void> {
    const sound = await this.soundRepo.findById(input.soundId);
    if (!sound || !sound.isActive || sound.deletedAt) {
      throw new NotFoundError('SOUND_NOT_FOUND', 'El sonido solicitado no existe o está inactivo.');
    }

    const guild = await this.guildRepo.findByDiscordGuildId(input.discordGuildId);
    if (!guild || !guild.isEnabled) {
      throw new AppError('DISCORD_GUILD_DISABLED', 'El bot está deshabilitado en este servidor.');
    }

    const queue = this.queueManager.getOrCreateQueue(input.discordGuildId);
    
    // Validar si el bot ya está en un canal de voz diferente de este servidor
    const currentChannel = queue.getCurrentChannel();
    if (currentChannel && currentChannel !== input.voiceChannelId) {
      throw new AppError(
        'DISCORD_BOT_BUSY', 
        'El bot ya se encuentra reproduciendo sonido en otro canal de voz de este servidor.'
      );
    }

    const request = PlaybackRequest.create({
      soundId: sound.id.toString(),
      guildId: guild.id.toString(),
      requestedByDiscordUserId: null,
      requestedByWebUserId: input.webUserId,
      textChannelId: null,
      voiceChannelId: input.voiceChannelId,
      source: 'WEB'
    });

    await queue.enqueue(request);
  }
}

export class HandlePrefixSoundCommand {
  constructor(
    private guildRepo: GuildConfigurationRepository,
    private soundRepo: SoundRepository,
    private queueManager: PlaybackQueueManager,
    private resolver: ResolveSoundByCommand,
    private cooldowns: Map<string, number> = new Map() // AuthorId -> LastCommandTimestamp
  ) {}

  async execute(input: {
    discordGuildId: string;
    textChannelId: string;
    authorId: string;
    authorIsBot: boolean;
    content: string;
    userVoiceChannelId: string | null;
    botHasVoicePermissions: boolean;
  }): Promise<{ reply: string } | null> {
    if (input.authorIsBot) return null;

    const guild = await this.guildRepo.findByDiscordGuildId(input.discordGuildId);
    if (!guild || !guild.isEnabled) return null;

    // Verificar si el comando tiene el prefijo de este servidor
    const prefix = guild.commandPrefix;
    if (!input.content.startsWith(prefix)) return null;

    // Verificar si el canal de texto está permitido
    if (!guild.isChannelAllowed(input.textChannelId)) {
      return { reply: 'Este comando no está permitido en este canal.' };
    }

    // Extraer argumento del comando
    const argsStr = input.content.substring(prefix.length).trim();
    if (!argsStr) return null;

    const commandName = argsStr.split(/\s+/)[0];

    // Buscar sonido por nombre de comando
    let sound;
    try {
      sound = await this.resolver.execute(commandName);
    } catch (err: any) {
      return { reply: `No encuentro un sonido con el comando '${commandName}'.` };
    }

    // Validar cooldown por usuario
    const now = Date.now();
    const cooldownMs = guild.userCooldownSeconds * 1000;
    const lastCommand = this.cooldowns.get(input.authorId) || 0;
    if (now - lastCommand < cooldownMs) {
      return { reply: 'Espera un momento antes de volver a reproducir otro sonido.' };
    }
    this.cooldowns.set(input.authorId, now);

    // Validar que el usuario esté en canal de voz
    if (!input.userVoiceChannelId) {
      return { reply: 'Debes estar conectado a un canal de voz para reproducir sonidos.' };
    }

    // Validar permisos del bot para voz
    if (!input.botHasVoicePermissions) {
      return { reply: 'No tengo permisos para conectarme o hablar en tu canal de voz.' };
    }

    const queue = this.queueManager.getOrCreateQueue(input.discordGuildId);
    
    // Validar canal ocupado
    const currentChannel = queue.getCurrentChannel();
    if (currentChannel && currentChannel !== input.userVoiceChannelId) {
      return { reply: 'El bot está ocupado en otro canal de voz de este servidor.' };
    }

    const request = PlaybackRequest.create({
      soundId: sound.id.toString(),
      guildId: guild.id.toString(),
      requestedByDiscordUserId: input.authorId,
      requestedByWebUserId: null,
      textChannelId: input.textChannelId,
      voiceChannelId: input.userVoiceChannelId,
      source: 'DISCORD_PREFIX'
    });

    try {
      await queue.enqueue(request);
      return { reply: `Añadido a la cola: ${sound.displayName}` };
    } catch (err: any) {
      if (err.message === 'DISCORD_QUEUE_FULL') {
        return { reply: 'La cola de sonidos está llena. Inténtalo de nuevo en unos segundos.' };
      }
      return { reply: 'Ocurrió un error al procesar el sonido.' };
    }
  }
}

export class HandleSlashSoundCommand {
  constructor(
    private guildRepo: GuildConfigurationRepository,
    private soundRepo: SoundRepository,
    private queueManager: PlaybackQueueManager,
    private resolver: ResolveSoundByCommand,
    private cooldowns: Map<string, number> = new Map()
  ) {}

  async execute(input: {
    discordGuildId: string;
    textChannelId: string;
    authorId: string;
    commandName: string;
    userVoiceChannelId: string | null;
    botHasVoicePermissions: boolean;
  }): Promise<{ reply: string }> {
    const guild = await this.guildRepo.findByDiscordGuildId(input.discordGuildId);
    if (!guild) {
      throw new AppError('DISCORD_GUILD_NOT_FOUND', 'Este servidor no está registrado.');
    }
    
    if (!guild.isEnabled) {
      return { reply: 'El bot está desactivado en este servidor.' };
    }

    if (!guild.isChannelAllowed(input.textChannelId)) {
      return { reply: 'Este comando no está permitido en este canal.' };
    }

    let sound;
    try {
      sound = await this.resolver.execute(input.commandName);
    } catch (err: any) {
      return { reply: `No encuentro un sonido con el comando '${input.commandName}'.` };
    }

    const now = Date.now();
    const cooldownMs = guild.userCooldownSeconds * 1000;
    const lastCommand = this.cooldowns.get(input.authorId) || 0;
    if (now - lastCommand < cooldownMs) {
      return { reply: 'Espera un momento antes de volver a reproducir otro sonido.' };
    }
    this.cooldowns.set(input.authorId, now);

    if (!input.userVoiceChannelId) {
      return { reply: 'Debes estar conectado a un canal de voz para reproducir sonidos.' };
    }

    if (!input.botHasVoicePermissions) {
      return { reply: 'No tengo permisos para conectarme o hablar en tu canal de voz.' };
    }

    const queue = this.queueManager.getOrCreateQueue(input.discordGuildId);
    
    const currentChannel = queue.getCurrentChannel();
    if (currentChannel && currentChannel !== input.userVoiceChannelId) {
      return { reply: 'El bot está ocupado en otro canal de voz de este servidor.' };
    }

    const request = PlaybackRequest.create({
      soundId: sound.id.toString(),
      guildId: guild.id.toString(),
      requestedByDiscordUserId: input.authorId,
      requestedByWebUserId: null,
      textChannelId: input.textChannelId,
      voiceChannelId: input.userVoiceChannelId,
      source: 'DISCORD_SLASH'
    });

    try {
      await queue.enqueue(request);
      return { reply: `Añadido a la cola: ${sound.displayName}` };
    } catch (err: any) {
      if (err.message === 'DISCORD_QUEUE_FULL') {
        return { reply: 'La cola de sonidos está llena. Inténtalo de nuevo en unos segundos.' };
      }
      return { reply: 'Ocurrió un error al procesar el sonido.' };
    }
  }
}
