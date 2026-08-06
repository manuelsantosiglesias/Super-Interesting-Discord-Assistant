import { Entity, UniqueEntityID, PaginatedResult } from '@super-assistant/shared-kernel';

export type PlaybackSource = 'DISCORD_PREFIX' | 'DISCORD_SLASH' | 'WEB';
export type PlaybackStatus = 'QUEUED' | 'PLAYING' | 'COMPLETED' | 'FAILED' | 'REJECTED';

export interface PlaybackRequestProps {
  soundId: string;
  guildId: string; // ID interno de discord_guilds
  requestedByDiscordUserId: string | null;
  requestedByWebUserId: string | null;
  textChannelId: string | null;
  voiceChannelId: string;
  source: PlaybackSource;
  status: PlaybackStatus;
  errorCode: string | null;
  errorMessage: string | null;
  requestedAt: Date;
  startedAt: Date | null;
  completedAt: Date | null;
}

export class PlaybackRequest extends Entity<PlaybackRequestProps> {
  static create(
    props: Omit<PlaybackRequestProps, 'status' | 'errorCode' | 'errorMessage' | 'requestedAt' | 'startedAt' | 'completedAt'>,
    id?: UniqueEntityID
  ): PlaybackRequest {
    return new PlaybackRequest({
      ...props,
      status: 'QUEUED',
      errorCode: null,
      errorMessage: null,
      requestedAt: new Date(),
      startedAt: null,
      completedAt: null
    }, id);
  }

  get soundId(): string { return this.props.soundId; }
  get guildId(): string { return this.props.guildId; }
  get requestedByDiscordUserId(): string | null { return this.props.requestedByDiscordUserId; }
  get requestedByWebUserId(): string | null { return this.props.requestedByWebUserId; }
  get textChannelId(): string | null { return this.props.textChannelId; }
  get voiceChannelId(): string { return this.props.voiceChannelId; }
  get source(): PlaybackSource { return this.props.source; }
  get status(): PlaybackStatus { return this.props.status; }
  get errorCode(): string | null { return this.props.errorCode; }
  get errorMessage(): string | null { return this.props.errorMessage; }
  get requestedAt(): Date { return this.props.requestedAt; }
  get startedAt(): Date | null { return this.props.startedAt; }
  get completedAt(): Date | null { return this.props.completedAt; }

  public startPlayback(now: Date = new Date()): void {
    this.props.status = 'PLAYING';
    this.props.startedAt = now;
  }

  public completePlayback(now: Date = new Date()): void {
    this.props.status = 'COMPLETED';
    this.props.completedAt = now;
  }

  public failPlayback(code: string, message: string, now: Date = new Date()): void {
    this.props.status = 'FAILED';
    this.props.errorCode = code;
    this.props.errorMessage = message;
    this.props.completedAt = now;
  }

  public rejectPlayback(code: string, message: string, now: Date = new Date()): void {
    this.props.status = 'REJECTED';
    this.props.errorCode = code;
    this.props.errorMessage = message;
    this.props.completedAt = now;
  }
}

export interface PlaybackEventRepository {
  findById(id: string): Promise<PlaybackRequest | null>;
  save(request: PlaybackRequest): Promise<void>;
  update(request: PlaybackRequest): Promise<void>;
  list(options: { page: number; pageSize: number; guildId?: string }): Promise<PaginatedResult<PlaybackRequest>>;
}
