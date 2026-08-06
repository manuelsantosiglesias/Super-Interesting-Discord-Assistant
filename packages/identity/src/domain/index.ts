import { Entity, UniqueEntityID, PaginatedResult } from '@super-assistant/shared-kernel';

export type UserRole = 'ADMIN' | 'USER';

export interface UserProps {
  username: string;
  passwordHash: string;
  role: UserRole;
  isActive: boolean;
  mustChangePassword: boolean;
  failedLoginAttempts: number;
  lockedUntil: Date | null;
  lastLoginAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

export class User extends Entity<UserProps> {
  static create(props: Omit<UserProps, 'failedLoginAttempts' | 'lockedUntil' | 'lastLoginAt' | 'createdAt' | 'updatedAt'>, id?: UniqueEntityID): User {
    const now = new Date();
    return new User({
      ...props,
      failedLoginAttempts: 0,
      lockedUntil: null,
      lastLoginAt: null,
      createdAt: now,
      updatedAt: now
    }, id);
  }

  get username(): string { return this.props.username; }
  get passwordHash(): string { return this.props.passwordHash; }
  get role(): UserRole { return this.props.role; }
  get isActive(): boolean { return this.props.isActive; }
  get mustChangePassword(): boolean { return this.props.mustChangePassword; }
  get failedLoginAttempts(): number { return this.props.failedLoginAttempts; }
  get lockedUntil(): Date | null { return this.props.lockedUntil; }
  get lastLoginAt(): Date | null { return this.props.lastLoginAt; }
  get createdAt(): Date { return this.props.createdAt; }
  get updatedAt(): Date { return this.props.updatedAt; }

  public incrementFailedAttempts(maxAttempts: number, lockMinutes: number): void {
    this.props.failedLoginAttempts += 1;
    if (this.props.failedLoginAttempts >= maxAttempts) {
      const lockUntil = new Date();
      lockUntil.setMinutes(lockUntil.getMinutes() + lockMinutes);
      this.props.lockedUntil = lockUntil;
    }
    this.props.updatedAt = new Date();
  }

  public resetFailedAttempts(): void {
    this.props.failedLoginAttempts = 0;
    this.props.lockedUntil = null;
    this.props.updatedAt = new Date();
  }

  public isLocked(now: Date = new Date()): boolean {
    if (!this.props.lockedUntil) return false;
    return this.props.lockedUntil > now;
  }

  public updatePassword(newHash: string, mustChange: boolean = false): void {
    this.props.passwordHash = newHash;
    this.props.mustChangePassword = mustChange;
    this.props.updatedAt = new Date();
  }

  public disable(): void {
    this.props.isActive = false;
    this.props.updatedAt = new Date();
  }

  public enable(): void {
    this.props.isActive = true;
    this.props.updatedAt = new Date();
  }

  public recordLogin(now: Date = new Date()): void {
    this.props.lastLoginAt = now;
    this.props.updatedAt = now;
    this.resetFailedAttempts();
  }
}

export interface UserSessionProps {
  userId: string;
  expiresAt: Date;
  createdAt: Date;
  lastSeenAt: Date;
  ipHash: string | null;
  userAgent: string | null;
}

export class UserSession extends Entity<UserSessionProps> {
  static create(props: Omit<UserSessionProps, 'createdAt' | 'lastSeenAt'>, id?: UniqueEntityID): UserSession {
    const now = new Date();
    return new UserSession({
      ...props,
      createdAt: now,
      lastSeenAt: now
    }, id);
  }

  get userId(): string { return this.props.userId; }
  get expiresAt(): Date { return this.props.expiresAt; }
  get createdAt(): Date { return this.props.createdAt; }
  get lastSeenAt(): Date { return this.props.lastSeenAt; }
  get ipHash(): string | null { return this.props.ipHash; }
  get userAgent(): string | null { return this.props.userAgent; }

  public isExpired(now: Date = new Date()): boolean {
    return this.props.expiresAt < now;
  }

  public touch(now: Date = new Date(), durationHours: number = 12): void {
    this.props.lastSeenAt = now;
    const newExpires = new Date(now);
    newExpires.setHours(newExpires.getHours() + durationHours);
    this.props.expiresAt = newExpires;
  }
}

export interface UserRepository {
  findById(id: string): Promise<User | null>;
  findByUsername(username: string): Promise<User | null>;
  list(options: { page: number; pageSize: number }): Promise<PaginatedResult<User>>;
  save(user: User): Promise<void>;
  update(user: User): Promise<void>;
}

export interface SessionRepository {
  findById(id: string): Promise<UserSession | null>;
  save(session: UserSession): Promise<void>;
  update(session: UserSession): Promise<void>;
  delete(id: string): Promise<void>;
  deleteByUserId(userId: string): Promise<void>;
  cleanupExpired(now: Date): Promise<void>;
}

export interface PasswordHasher {
  hash(password: string): Promise<string>;
  compare(password: string, hash: string): Promise<boolean>;
}
