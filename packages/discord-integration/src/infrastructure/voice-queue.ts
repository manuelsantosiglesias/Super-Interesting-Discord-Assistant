import { 
  joinVoiceChannel, 
  createAudioPlayer, 
  createAudioResource, 
  AudioPlayerStatus, 
  VoiceConnectionStatus, 
  getVoiceConnection,
  AudioPlayer,
  VoiceConnection
} from '@discordjs/voice';
import { PlaybackRequest, PlaybackEventRepository } from '../domain/index.js';
import { SoundRepository } from '@super-assistant/soundboard';
import { GuildConfigurationRepository } from '@super-assistant/guild-management';
import * as fs from 'fs';
import * as path from 'path';

export class GuildVoiceQueue {
  private queue: PlaybackRequest[] = [];
  private connection: VoiceConnection | null = null;
  private player: AudioPlayer | null = null;
  private disconnectTimer: NodeJS.Timeout | null = null;
  private currentRequest: PlaybackRequest | null = null;

  constructor(
    private discordGuildId: string,
    private soundRepo: SoundRepository,
    private guildRepo: GuildConfigurationRepository,
    private playbackEventRepo: PlaybackEventRepository,
    private uploadDir: string
  ) {}

  public async enqueue(request: PlaybackRequest): Promise<void> {
    const guildConfig = await this.guildRepo.findByDiscordGuildId(this.discordGuildId);
    const maxQueue = guildConfig?.maxQueueSize ?? 10;

    if (this.queue.length >= maxQueue) {
      request.rejectPlayback('DISCORD_QUEUE_FULL', 'La cola de reproducción del servidor está llena.');
      await this.playbackEventRepo.save(request);
      throw new Error('DISCORD_QUEUE_FULL');
    }

    this.queue.push(request);
    await this.playbackEventRepo.save(request);

    // Cancelar el temporizador de desconexión si estaba activo
    if (this.disconnectTimer) {
      clearTimeout(this.disconnectTimer);
      this.disconnectTimer = null;
    }

    // Si no se está reproduciendo nada, comenzar reproducción
    if (!this.currentRequest) {
      await this.playNext();
    }
  }

  private async playNext(): Promise<void> {
    if (this.queue.length === 0) {
      this.currentRequest = null;
      // Iniciar el temporizador de salida por inactividad
      await this.startDisconnectTimeout();
      return;
    }

    const request = this.queue.shift()!;
    this.currentRequest = request;

    const sound = await this.soundRepo.findById(request.soundId);
    const guildConfig = await this.guildRepo.findByDiscordGuildId(this.discordGuildId);

    if (!sound || !sound.isActive || sound.deletedAt) {
      request.failPlayback('SOUND_NOT_FOUND', 'El sonido solicitado no existe o está inactivo.');
      await this.playbackEventRepo.update(request);
      await this.playNext();
      return;
    }

    try {
      // 1. Obtener y verificar ruta física del audio
      const audioPath = path.resolve(this.uploadDir, sound.storageFilename);
      if (!fs.existsSync(audioPath)) {
        throw new Error(`Archivo de audio no encontrado: ${audioPath}`);
      }

      // 2. Unirse al canal de voz de Discord
      if (!this.connection || this.connection.state.status === VoiceConnectionStatus.Destroyed) {
        this.connection = joinVoiceChannel({
          channelId: request.voiceChannelId,
          guildId: this.discordGuildId,
          adapterCreator: (this.connection as any)?.adapterCreator || (global as any).discordClient?.guilds.cache.get(this.discordGuildId)?.voiceAdapterCreator,
          selfMute: false,
          selfDeaf: true
        });

        this.connection.on(VoiceConnectionStatus.Disconnected, async () => {
          try {
            // Intentar reconectar o limpiar estado si es desconexión definitiva
            this.clearQueue('DISCORD_MANUAL_DISCONNECT', 'El bot ha sido desconectado manualmente del canal de voz.');
          } catch (err) {}
        });
      }

      // 3. Crear reproductor de audio
      if (!this.player) {
        this.player = createAudioPlayer();
        this.connection.subscribe(this.player);

        this.player.on(AudioPlayerStatus.Idle, async () => {
          if (this.currentRequest) {
            this.currentRequest.completePlayback();
            await this.playbackEventRepo.update(this.currentRequest);
          }
          await this.playNext();
        });

        this.player.on('error', async (error) => {
          if (this.currentRequest) {
            this.currentRequest.failPlayback('PLAYBACK_ERROR', error.message);
            await this.playbackEventRepo.update(this.currentRequest);
          }
          await this.playNext();
        });
      }

      // 4. Crear recurso y ajustar volumen
      const resource = createAudioResource(audioPath, { inlineVolume: true });
      
      const guildVol = guildConfig?.defaultVolume ?? 1.0;
      const soundVol = sound.volume ?? 1.0;
      const finalVolume = Math.min(Math.max(guildVol * soundVol, 0.0), 2.0);
      
      if (resource.volume) {
        resource.volume.setVolume(finalVolume);
      }

      // 5. Iniciar la reproducción
      request.startPlayback();
      await this.playbackEventRepo.update(request);

      this.player.play(resource);

    } catch (error: any) {
      request.failPlayback('DISCORD_VOICE_CONNECTION_FAILED', error.message || 'Error desconocido al conectar o reproducir.');
      await this.playbackEventRepo.update(request);
      await this.playNext();
    }
  }

  private async startDisconnectTimeout(): Promise<void> {
    const guildConfig = await this.guildRepo.findByDiscordGuildId(this.discordGuildId);
    const leaveAfterMs = (guildConfig?.leaveAfterSeconds ?? 15) * 1000;

    this.disconnectTimer = setTimeout(() => {
      this.disconnect();
    }, leaveAfterMs);
  }

  public disconnect(): void {
    if (this.disconnectTimer) {
      clearTimeout(this.disconnectTimer);
      this.disconnectTimer = null;
    }

    if (this.connection) {
      try {
        if (this.connection.state.status !== VoiceConnectionStatus.Destroyed) {
          this.connection.destroy();
        }
      } catch (err) {}
      this.connection = null;
    }

    if (this.player) {
      try {
        this.player.stop(true);
      } catch (err) {}
      this.player = null;
    }

    this.clearQueue('DISCORD_FORCE_DISCONNECT', 'El bot se desconectó debido a inactividad o apagado.');
  }

  public clearQueue(errCode: string = 'DISCORD_QUEUE_CLEARED', errMsg: string = 'Cola limpiada'): void {
    if (this.currentRequest && this.currentRequest.status === 'PLAYING') {
      this.currentRequest.failPlayback(errCode, errMsg);
      this.playbackEventRepo.update(this.currentRequest).catch(() => {});
    }
    this.currentRequest = null;

    const pending = [...this.queue];
    this.queue = [];
    
    for (const req of pending) {
      req.failPlayback(errCode, errMsg);
      this.playbackEventRepo.update(req).catch(() => {});
    }
  }

  public getQueueLength(): number {
    return this.queue.length;
  }

  public getCurrentChannel(): string | null {
    if (this.connection && this.connection.state.status !== VoiceConnectionStatus.Destroyed) {
      return (this.connection as any).joinConfig?.channelId || null;
    }
    return null;
  }
}

export class PlaybackQueueManager {
  private queues: Map<string, GuildVoiceQueue> = new Map();

  constructor(
    private soundRepo: SoundRepository,
    private guildRepo: GuildConfigurationRepository,
    private playbackEventRepo: PlaybackEventRepository,
    private uploadDir: string
  ) {}

  public getOrCreateQueue(discordGuildId: string): GuildVoiceQueue {
    let queue = this.queues.get(discordGuildId);
    if (!queue) {
      queue = new GuildVoiceQueue(
        discordGuildId,
        this.soundRepo,
        this.guildRepo,
        this.playbackEventRepo,
        this.uploadDir
      );
      this.queues.set(discordGuildId, queue);
    }
    return queue;
  }

  public getQueues(): Map<string, GuildVoiceQueue> {
    return this.queues;
  }

  public shutdown(): void {
    for (const queue of this.queues.values()) {
      queue.disconnect();
    }
    this.queues.clear();
  }
}
