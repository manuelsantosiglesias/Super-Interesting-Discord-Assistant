import { Kysely } from 'kysely';
import * as argon2 from 'argon2';
import { UserRepository, SessionRepository, PasswordHasher, User, UserSession, UserRole } from '../domain/index.js';
import { UniqueEntityID, PaginatedResult } from '@super-assistant/shared-kernel';

export class KyselyUserRepository implements UserRepository {
  constructor(private db: Kysely<any>) {}

  private mapToDomain(row: any): User {
    return new User({
      username: row.username,
      passwordHash: row.password_hash,
      role: row.role as UserRole,
      isActive: Boolean(row.is_active),
      mustChangePassword: Boolean(row.must_change_password),
      failedLoginAttempts: Number(row.failed_login_attempts),
      lockedUntil: row.locked_until ? new Date(row.locked_until) : null,
      lastLoginAt: row.last_login_at ? new Date(row.last_login_at) : null,
      createdAt: new Date(row.created_at),
      updatedAt: new Date(row.updated_at)
    }, new UniqueEntityID(row.id));
  }

  async findById(id: string): Promise<User | null> {
    const row = await this.db
      .selectFrom('users')
      .selectAll()
      .where('id', '=', id)
      .executeTakeFirst();
    if (!row) return null;
    return this.mapToDomain(row);
  }

  async findByUsername(username: string): Promise<User | null> {
    const row = await this.db
      .selectFrom('users')
      .selectAll()
      .where('username', '=', username)
      .executeTakeFirst();
    if (!row) return null;
    return this.mapToDomain(row);
  }

  async list(options: { page: number; pageSize: number }): Promise<PaginatedResult<User>> {
    const limit = Math.min(Math.max(options.pageSize, 1), 100);
    const offset = (Math.max(options.page, 1) - 1) * limit;

    const totalRes = await this.db
      .selectFrom('users')
      .select((eb) => eb.fn.count('id').as('total'))
      .executeTakeFirst();
    
    const totalItems = Number(totalRes?.total || 0);
    const totalPages = Math.ceil(totalItems / limit);

    const rows = await this.db
      .selectFrom('users')
      .selectAll()
      .orderBy('created_at', 'desc')
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

  async save(user: User): Promise<void> {
    await this.db
      .insertInto('users')
      .values({
        id: user.id.toString(),
        username: user.username,
        password_hash: user.passwordHash,
        role: user.role,
        is_active: user.isActive ? 1 : 0,
        must_change_password: user.mustChangePassword ? 1 : 0,
        failed_login_attempts: user.failedLoginAttempts,
        locked_until: user.lockedUntil,
        last_login_at: user.lastLoginAt,
        created_at: user.createdAt,
        updated_at: user.updatedAt
      })
      .execute();
  }

  async update(user: User): Promise<void> {
    await this.db
      .updateTable('users')
      .set({
        username: user.username,
        password_hash: user.passwordHash,
        role: user.role,
        is_active: user.isActive ? 1 : 0,
        must_change_password: user.mustChangePassword ? 1 : 0,
        failed_login_attempts: user.failedLoginAttempts,
        locked_until: user.lockedUntil,
        last_login_at: user.lastLoginAt,
        updated_at: user.updatedAt
      })
      .where('id', '=', user.id.toString())
      .execute();
  }
}

export class KyselySessionRepository implements SessionRepository {
  constructor(private db: Kysely<any>) {}

  private mapToDomain(row: any): UserSession {
    return new UserSession({
      userId: row.user_id,
      expiresAt: new Date(row.expires_at),
      createdAt: new Date(row.created_at),
      lastSeenAt: new Date(row.last_seen_at),
      ipHash: row.ip_hash,
      userAgent: row.user_agent
    }, new UniqueEntityID(row.id));
  }

  async findById(id: string): Promise<UserSession | null> {
    const row = await this.db
      .selectFrom('user_sessions')
      .selectAll()
      .where('id', '=', id)
      .executeTakeFirst();
    if (!row) return null;
    return this.mapToDomain(row);
  }

  async save(session: UserSession): Promise<void> {
    await this.db
      .insertInto('user_sessions')
      .values({
        id: session.id.toString(),
        user_id: session.userId,
        expires_at: session.expiresAt,
        created_at: session.createdAt,
        last_seen_at: session.lastSeenAt,
        ip_hash: session.ipHash,
        user_agent: session.userAgent
      })
      .execute();
  }

  async update(session: UserSession): Promise<void> {
    await this.db
      .updateTable('user_sessions')
      .set({
        expires_at: session.expiresAt,
        last_seen_at: session.lastSeenAt,
        ip_hash: session.ipHash,
        user_agent: session.userAgent
      })
      .where('id', '=', session.id.toString())
      .execute();
  }

  async delete(id: string): Promise<void> {
    await this.db
      .deleteFrom('user_sessions')
      .where('id', '=', id)
      .execute();
  }

  async deleteByUserId(userId: string): Promise<void> {
    await this.db
      .deleteFrom('user_sessions')
      .where('user_id', '=', userId)
      .execute();
  }

  async cleanupExpired(now: Date): Promise<void> {
    await this.db
      .deleteFrom('user_sessions')
      .where('expires_at', '<', now)
      .execute();
  }
}

export class Argon2PasswordHasher implements PasswordHasher {
  async hash(password: string): Promise<string> {
    return argon2.hash(password, {
      type: argon2.argon2id
    });
  }

  async compare(password: string, hash: string): Promise<boolean> {
    try {
      return await argon2.verify(hash, password);
    } catch {
      return false;
    }
  }
}
