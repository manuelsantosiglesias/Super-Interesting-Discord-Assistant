import { Kysely } from 'kysely';
import { AuditLogRepository, AuditEvent, AuditLogQuery } from '../domain/index.js';
import { PaginatedResult } from '@super-assistant/shared-kernel';

export class KyselyAuditLogRepository implements AuditLogRepository {
  constructor(private db: Kysely<any>) {}

  private mapToDomain(row: any): AuditEvent {
    let metadataJson: Record<string, any> | null = null;
    if (row.metadata_json) {
      metadataJson = typeof row.metadata_json === 'string' 
        ? JSON.parse(row.metadata_json) 
        : row.metadata_json;
    }
    return new AuditEvent({
      id: String(row.id),
      userId: row.user_id,
      action: row.action,
      entityType: row.entity_type,
      entityId: row.entity_id,
      metadataJson,
      ipHash: row.ip_hash,
      createdAt: new Date(row.created_at)
    });
  }

  async list(query: AuditLogQuery): Promise<PaginatedResult<AuditEvent>> {
    const limit = Math.min(Math.max(query.pageSize, 1), 100);
    const offset = (Math.max(query.page, 1) - 1) * limit;

    let q = this.db.selectFrom('audit_log').selectAll();

    if (query.userId) {
      q = q.where('user_id', '=', query.userId);
    }
    if (query.action) {
      q = q.where('action', '=', query.action);
    }
    if (query.entityType) {
      q = q.where('entity_type', '=', query.entityType);
    }
    if (query.from) {
      q = q.where('created_at', '>=', query.from);
    }
    if (query.to) {
      q = q.where('created_at', '<=', query.to);
    }

    // Contar total
    let countQ = this.db
      .selectFrom('audit_log')
      .select((eb) => eb.fn.count('id').as('total'));

    if (query.userId) {
      countQ = countQ.where('user_id', '=', query.userId);
    }
    if (query.action) {
      countQ = countQ.where('action', '=', query.action);
    }
    if (query.entityType) {
      countQ = countQ.where('entity_type', '=', query.entityType);
    }
    if (query.from) {
      countQ = countQ.where('created_at', '>=', query.from);
    }
    if (query.to) {
      countQ = countQ.where('created_at', '<=', query.to);
    }

    const countRes = await countQ.executeTakeFirst();
    const totalItems = Number(countRes?.total || 0);
    const totalPages = Math.ceil(totalItems / limit);

    const rows = await q
      .orderBy('created_at', 'desc')
      .limit(limit)
      .offset(offset)
      .execute();

    return {
      items: rows.map(r => this.mapToDomain(r)),
      pagination: {
        page: query.page,
        pageSize: limit,
        totalItems,
        totalPages
      }
    };
  }

  async save(event: AuditEvent): Promise<void> {
    await this.db
      .insertInto('audit_log')
      .values({
        user_id: event.userId,
        action: event.action,
        entity_type: event.entityType,
        entity_id: event.entityId,
        metadata_json: event.metadataJson ? JSON.stringify(event.metadataJson) : null,
        ip_hash: event.ipHash,
        created_at: event.createdAt
      })
      .execute();
  }
}
