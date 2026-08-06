import { Kysely } from 'kysely';
import { PlaybackEventRepository, PlaybackRequest, PlaybackSource, PlaybackStatus } from '../domain/index.js';
import { UniqueEntityID, PaginatedResult } from '@super-assistant/shared-kernel';

export class KyselyPlaybackEventRepository implements PlaybackEventRepository {
  constructor(private db: Kysely<any>) {}

  private mapToDomain(row: any): PlaybackRequest {
    return new PlaybackRequest({
      soundId: row.sound_id,
      guildId: row.guild_id,
      requestedByDiscordUserId: row.requested_by_discord_user_id,
      requestedByWebUserId: row.requested_by_web_user_id,
      textChannelId: row.text_channel_id,
      voiceChannelId: row.voice_channel_id,
      source: row.source as PlaybackSource,
      status: row.status as PlaybackStatus,
      errorCode: row.error_code,
      errorMessage: row.error_message,
      requestedAt: new Date(row.requested_at),
      startedAt: row.started_at ? new Date(row.started_at) : null,
      completedAt: row.completed_at ? new Date(row.completed_at) : null
    }, new UniqueEntityID(row.id));
  }

  async findById(id: string): Promise<PlaybackRequest | null> {
    const row = await this.db
      .selectFrom('playback_events')
      .selectAll()
      .where('id', '=', id)
      .executeTakeFirst();
    if (!row) return null;
    return this.mapToDomain(row);
  }

  async save(request: PlaybackRequest): Promise<void> {
    await this.db
      .insertInto('playback_events')
      .values({
        id: request.id.toString(),
        sound_id: request.soundId,
        guild_id: request.guildId,
        requested_by_discord_user_id: request.requestedByDiscordUserId,
        requested_by_web_user_id: request.requestedByWebUserId,
        text_channel_id: request.textChannelId,
        voice_channel_id: request.voiceChannelId,
        source: request.source,
        status: request.status,
        error_code: request.errorCode,
        error_message: request.errorMessage,
        requested_at: request.requestedAt,
        started_at: request.startedAt,
        completed_at: request.completedAt
      })
      .execute();
  }

  async update(request: PlaybackRequest): Promise<void> {
    await this.db
      .updateTable('playback_events')
      .set({
        status: request.status,
        error_code: request.errorCode,
        error_message: request.errorMessage,
        started_at: request.startedAt,
        completed_at: request.completedAt
      })
      .where('id', '=', request.id.toString())
      .execute();
  }

  async list(options: { page: number; pageSize: number; guildId?: string }): Promise<PaginatedResult<PlaybackRequest>> {
    const limit = Math.min(Math.max(options.pageSize, 1), 100);
    const offset = (Math.max(options.page, 1) - 1) * limit;

    let q = this.db.selectFrom('playback_events').selectAll();
    let countQ = this.db.selectFrom('playback_events').select((eb) => eb.fn.count('id').as('total'));

    if (options.guildId) {
      q = q.where('guild_id', '=', options.guildId);
      countQ = countQ.where('guild_id', '=', options.guildId);
    }

    const countRes = await countQ.executeTakeFirst();
    const totalItems = Number(countRes?.total || 0);
    const totalPages = Math.ceil(totalItems / limit);

    const rows = await q
      .orderBy('requested_at', 'desc')
      .limit(limit)
      .offset(offset)
      .execute();

    return {
      items: rows.map(r => this.mapToDomain(r)),
      pagination: {
        page: options.page,
        pageSize: limit,
        totalItems,
        totalPages
      }
    };
  }
}
