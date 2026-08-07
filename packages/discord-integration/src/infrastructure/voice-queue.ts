import { 
  joinVoiceChannel, 
  createAudioPlayer, 
  createAudioResource, 
  AudioPlayerStatus, 
  VoiceConnectionStatus, 
  getVoiceConnection,
  getVoiceConnections,
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

      // 2. Unirse al canal de voz de Discord (o desconectar y cambiar de canal si el bot está en otro)
      const currentChannelId = (this.connection as any)?.joinConfig?.channelId || (getVoiceConnection(this.discordGuildId) as any)?.joinConfig?.channelId;
      const targetChannelId = request.voiceChannelId;
      const isDifferentChannel = currentChannelId && currentChannelId !== targetChannelId;

      if (!this.connection || this.connection.state.status === VoiceConnectionStatus.Destroyed || isDifferentChannel) {
        if (this.connection) {
          try {
            this.connection.removeAllListeners();
            if (this.connection.state.status !== VoiceConnectionStatus.Destroyed) {
              this.connection.destroy();
            }
          } catch (e) {}
          this.connection = null;
        }

        // Desconectar cualquier otra conexión activa de voz en Discord (incluso en otros servidores)
        try {
          for (const [gId, conn] of getVoiceConnections()) {
            if (gId !== this.discordGuildId || conn.joinConfig?.channelId !== targetChannelId) {
              try {
                conn.removeAllListeners();
                if (conn.state.status !== VoiceConnectionStatus.Destroyed) {
                  conn.destroy();
                }
              } catch (e) {}
            }
          }
        } catch (e) {}

        const guild = (global as any).discordClient?.guilds.cache.get(this.discordGuildId);
        const adapterCreator = guild?.voiceAdapterCreator;

        this.connection = joinVoiceChannel({
          channelId: targetChannelId,
          guildId: this.discordGuildId,
          adapterCreator,
          selfMute: false,
          selfDeaf: true
        });

        if (this.player && this.connection) {
          this.connection.subscribe(this.player);
        }

        this.connection.on('stateChange', (oldState, newState) => {
          console.log(`[VoiceConnection] ${this.discordGuildId}: ${oldState.status} -> ${newState.status}`);
        });

        this.connection.on(VoiceConnectionStatus.Disconnected, async () => {
          try {
            this.clearQueue('DISCORD_MANUAL_DISCONNECT', 'El bot ha sido desconectado manualmente del canal de voz.');
          } catch (err) {}
        });
      }

      // 3. Crear reproductor de audio
      if (!this.player) {
        this.player = createAudioPlayer();
        this.connection.subscribe(this.player);

        this.player.on('stateChange', (oldState, newState) => {
          console.log(`[AudioPlayer] ${this.discordGuildId}: ${oldState.status} -> ${newState.status}`);
        });

        this.player.on(AudioPlayerStatus.Idle, async () => {
          if (this.currentRequest) {
            this.currentRequest.completePlayback();
            await this.playbackEventRepo.update(this.currentRequest);
          }
          await this.playNext();
        });

        this.player.on('error', async (error) => {
          console.error(`[AudioPlayer ERROR] ${this.discordGuildId}:`, error.message, error.stack);
          if (this.currentRequest) {
            this.currentRequest.failPlayback('PLAYBACK_ERROR', error.message);
            await this.playbackEventRepo.update(this.currentRequest);
          }
          await this.playNext();
        });
      }

      // 4. Crear recurso de audio y reproducir
      const resource = createAudioResource(audioPath, {
        inlineVolume: true
      });

      if (resource.volume) {
        const volumeFactor = (guildConfig?.defaultVolume ?? 1.0) * (sound.volume ?? 1.0);
        resource.volume.setVolume(Math.min(Math.max(volumeFactor, 0.0), 2.0));
      }

      this.currentRequest.startPlayback();
      await this.playbackEventRepo.update(this.currentRequest);

      this.player.play(resource);

    } catch (err: any) {
      console.error(`[GuildVoiceQueue ${this.discordGuildId}] Error al procesar audio:`, err);
      if (this.currentRequest) {
        this.currentRequest.failPlayback('PLAYBACK_FAILED', err.message || 'Error desconocido de reproducción');
        await this.playbackEventRepo.update(this.currentRequest);
      }
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
        this.connection.removeAllListeners();
        this.connection.destroy();
      } catch (e) {}
      this.connection = null;
    }

    if (this.player) {
      try {
        this.player.stop();
      } catch (e) {}
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
    // Desconectar activamente al bot de cualquier otro servidor antes de operar en el servidor indicado
    for (const [gId, existingQueue] of this.queues.entries()) {
      if (gId !== discordGuildId) {
        try {
          existingQueue.disconnect();
        } catch (e) {}
      }
    }

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
