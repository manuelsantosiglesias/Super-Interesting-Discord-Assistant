import { PaginatedResult } from '@super-assistant/shared-kernel';

export interface AuditEventProps {
  id?: string;
  userId: string | null;
  action: string;
  entityType: string | null;
  entityId: string | null;
  metadataJson: Record<string, any> | null;
  ipHash: string | null;
  createdAt: Date;
}

export class AuditEvent {
  public readonly props: AuditEventProps;

  constructor(props: AuditEventProps) {
    this.props = props;
  }

  static create(props: Omit<AuditEventProps, 'createdAt'>): AuditEvent {
    return new AuditEvent({
      ...props,
      createdAt: new Date()
    });
  }

  get id(): string | undefined { return this.props.id; }
  get userId(): string | null { return this.props.userId; }
  get action(): string { return this.props.action; }
  get entityType(): string | null { return this.props.entityType; }
  get entityId(): string | null { return this.props.entityId; }
  get metadataJson(): Record<string, any> | null { return this.props.metadataJson; }
  get ipHash(): string | null { return this.props.ipHash; }
  get createdAt(): Date { return this.props.createdAt; }
}

export interface AuditLogQuery {
  userId?: string;
  action?: string;
  entityType?: string;
  from?: Date;
  to?: Date;
  page: number;
  pageSize: number;
}

export interface AuditLogRepository {
  list(query: AuditLogQuery): Promise<PaginatedResult<AuditEvent>>;
  save(event: AuditEvent): Promise<void>;
}
