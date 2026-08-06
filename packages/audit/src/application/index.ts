import { PaginatedResult } from '@super-assistant/shared-kernel';
import { AuditEvent, AuditLogRepository, AuditLogQuery } from '../domain/index.js';
import { createHash } from 'crypto';

function hashIpAddress(ip: string | null): string | null {
  if (!ip) return null;
  return createHash('sha256').update(ip).digest('hex');
}

export class WriteAuditEvent {
  constructor(private auditRepo: AuditLogRepository) {}

  async execute(input: {
    userId: string | null;
    action: string;
    entityType?: string | null;
    entityId?: string | null;
    metadataJson?: Record<string, any> | null;
    ipAddress?: string | null;
  }): Promise<void> {
    const event = AuditEvent.create({
      userId: input.userId,
      action: input.action,
      entityType: input.entityType || null,
      entityId: input.entityId || null,
      metadataJson: input.metadataJson || null,
      ipHash: hashIpAddress(input.ipAddress || null)
    });

    await this.auditRepo.save(event);
  }
}

export class ListAuditEvents {
  constructor(private auditRepo: AuditLogRepository) {}

  async execute(query: AuditLogQuery): Promise<PaginatedResult<AuditEvent>> {
    return this.auditRepo.list(query);
  }
}
