import { 
  AppError, 
  UniqueEntityID, 
  Clock, 
  IdGenerator, 
  PaginatedResult,
  UnauthorizedError,
  NotFoundError,
  ForbiddenError,
  ConflictError
} from '@super-assistant/shared-kernel';
import { Config } from '@super-assistant/config';
import { 
  UserRepository, 
  SessionRepository, 
  PasswordHasher, 
  User, 
  UserSession,
  UserRole 
} from '../domain/index.js';
import { createHash, randomBytes } from 'crypto';

function generateSecureSessionId(): string {
  const bytes = randomBytes(32);
  return createHash('sha256').update(bytes).digest('hex');
}

function hashIpAddress(ip: string | null): string | null {
  if (!ip) return null;
  return createHash('sha256').update(ip).digest('hex');
}

export class LoginUser {
  constructor(
    private userRepo: UserRepository,
    private sessionRepo: SessionRepository,
    private hasher: PasswordHasher,
    private clock: Clock,
    private config: Config
  ) {}

  async execute(input: {
    username: string;
    password: string;
    ipAddress: string | null;
    userAgent: string | null;
  }): Promise<{ session: UserSession; user: User }> {
    const normalizedUsername = input.username.trim().toLowerCase();
    const now = this.clock.now();

    const user = await this.userRepo.findByUsername(normalizedUsername);
    if (!user) {
      // Lanzar error genérico para no revelar existencia del usuario
      throw new UnauthorizedError('AUTH_INVALID_CREDENTIALS', 'Usuario o contraseña incorrectos.');
    }

    if (!user.isActive) {
      throw new UnauthorizedError('AUTH_ACCOUNT_DISABLED', 'La cuenta está desactivada.');
    }

    if (user.isLocked(now)) {
      throw new UnauthorizedError(
        'AUTH_ACCOUNT_LOCKED', 
        `La cuenta está bloqueada temporalmente hasta ${user.lockedUntil?.toLocaleString()}.`
      );
    }

    const passwordMatches = await this.hasher.compare(input.password, user.passwordHash);
    if (!passwordMatches) {
      user.incrementFailedAttempts(
        this.config.security.max_login_attempts,
        this.config.security.login_lock_minutes
      );
      await this.userRepo.update(user);
      
      if (user.isLocked(now)) {
        throw new UnauthorizedError(
          'AUTH_ACCOUNT_LOCKED', 
          `La cuenta ha sido bloqueada temporalmente por demasiados intentos fallidos.`
        );
      }
      
      throw new UnauthorizedError('AUTH_INVALID_CREDENTIALS', 'Usuario o contraseña incorrectos.');
    }

    user.recordLogin(now);
    await this.userRepo.update(user);

    const sessionId = generateSecureSessionId();
    const expiresAt = new Date(now);
    expiresAt.setHours(expiresAt.getHours() + this.config.security.session_duration_hours);

    const session = UserSession.create({
      userId: user.id.toString(),
      expiresAt,
      ipHash: hashIpAddress(input.ipAddress),
      userAgent: input.userAgent
    }, new UniqueEntityID(sessionId));

    await this.sessionRepo.save(session);

    return { session, user };
  }
}

export class LogoutUser {
  constructor(private sessionRepo: SessionRepository) {}

  async execute(sessionId: string): Promise<void> {
    await this.sessionRepo.delete(sessionId);
  }
}

export class GetCurrentUser {
  constructor(
    private sessionRepo: SessionRepository,
    private userRepo: UserRepository,
    private clock: Clock,
    private config: Config
  ) {}

  async execute(sessionId: string, ipAddress: string | null): Promise<User> {
    const session = await this.sessionRepo.findById(sessionId);
    const now = this.clock.now();

    if (!session || session.isExpired(now)) {
      if (session) {
        await this.sessionRepo.delete(sessionId);
      }
      throw new UnauthorizedError('AUTH_SESSION_EXPIRED', 'La sesión ha expirado.');
    }

    // Opcional: validar IP hash para evitar secuestro de sesión
    const ipHash = hashIpAddress(ipAddress);
    if (session.ipHash && session.ipHash !== ipHash) {
      await this.sessionRepo.delete(sessionId);
      throw new UnauthorizedError('AUTH_SESSION_INVALID', 'Dirección IP de sesión no coincide.');
    }

    const user = await this.userRepo.findById(session.userId);
    if (!user || !user.isActive) {
      await this.sessionRepo.delete(sessionId);
      throw new UnauthorizedError('AUTH_ACCOUNT_DISABLED', 'El usuario asociado no está activo.');
    }

    // Touch sesión para extender su tiempo de vida si es activa
    session.touch(now, this.config.security.session_duration_hours);
    await this.sessionRepo.update(session);

    return user;
  }
}

export class CreateUser {
  constructor(
    private userRepo: UserRepository,
    private hasher: PasswordHasher,
    private config: Config
  ) {}

  async execute(input: {
    username: string;
    password: string;
    role: UserRole;
  }): Promise<User> {
    const normalizedUsername = input.username.trim().toLowerCase();
    
    // Validaciones
    if (normalizedUsername.length < 3) {
      throw new AppError('USER_INVALID_USERNAME', 'El nombre de usuario debe tener al menos 3 caracteres.');
    }
    
    if (input.password.length < this.config.security.password_min_length) {
      throw new AppError(
        'USER_PASSWORD_TOO_SHORT', 
        `La contraseña debe tener al menos ${this.config.security.password_min_length} caracteres.`
      );
    }

    const existingUser = await this.userRepo.findByUsername(normalizedUsername);
    if (existingUser) {
      throw new ConflictError('USERNAME_ALREADY_EXISTS', 'El nombre de usuario ya está registrado.');
    }

    const passwordHash = await this.hasher.hash(input.password);
    const user = User.create({
      username: normalizedUsername,
      passwordHash,
      role: input.role,
      isActive: true,
      mustChangePassword: false
    });

    await this.userRepo.save(user);
    return user;
  }
}

export class ListUsers {
  constructor(private userRepo: UserRepository) {}

  async execute(options: { page: number; pageSize: number }): Promise<PaginatedResult<User>> {
    return this.userRepo.list(options);
  }
}

export class EnableUser {
  constructor(private userRepo: UserRepository) {}

  async execute(userId: string): Promise<void> {
    const user = await this.userRepo.findById(userId);
    if (!user) {
      throw new NotFoundError('USER_NOT_FOUND', 'No se encontró el usuario.');
    }
    user.enable();
    await this.userRepo.update(user);
  }
}

export class DisableUser {
  constructor(
    private userRepo: UserRepository,
    private sessionRepo: SessionRepository
  ) {}

  async execute(userId: string): Promise<void> {
    const user = await this.userRepo.findById(userId);
    if (!user) {
      throw new NotFoundError('USER_NOT_FOUND', 'No se encontró el usuario.');
    }
    user.disable();
    await this.userRepo.update(user);
    // Invalidar sesiones
    await this.sessionRepo.deleteByUserId(userId);
  }
}

export class ChangePassword {
  constructor(
    private userRepo: UserRepository,
    private sessionRepo: SessionRepository,
    private hasher: PasswordHasher,
    private config: Config
  ) {}

  async execute(input: {
    userId: string;
    currentPassword: string;
    newPassword: string;
  }): Promise<void> {
    const user = await this.userRepo.findById(input.userId);
    if (!user) {
      throw new NotFoundError('USER_NOT_FOUND', 'No se encontró el usuario.');
    }

    const passwordMatches = await this.hasher.compare(input.currentPassword, user.passwordHash);
    if (!passwordMatches) {
      throw new UnauthorizedError('AUTH_INVALID_CREDENTIALS', 'La contraseña actual es incorrecta.');
    }

    if (input.newPassword.length < this.config.security.password_min_length) {
      throw new AppError(
        'USER_PASSWORD_TOO_SHORT', 
        `La contraseña debe tener al menos ${this.config.security.password_min_length} caracteres.`
      );
    }

    const newHash = await this.hasher.hash(input.newPassword);
    user.updatePassword(newHash, false);
    await this.userRepo.update(user);

    // Invalidar sesiones activas tras cambio de contraseña
    await this.sessionRepo.deleteByUserId(input.userId);
  }
}

export class ResetUserPassword {
  constructor(
    private userRepo: UserRepository,
    private sessionRepo: SessionRepository,
    private hasher: PasswordHasher,
    private config: Config
  ) {}

  async execute(input: {
    userId: string;
    newPassword: string;
  }): Promise<void> {
    const user = await this.userRepo.findById(input.userId);
    if (!user) {
      throw new NotFoundError('USER_NOT_FOUND', 'No se encontró el usuario.');
    }

    if (input.newPassword.length < this.config.security.password_min_length) {
      throw new AppError(
        'USER_PASSWORD_TOO_SHORT', 
        `La contraseña debe tener al menos ${this.config.security.password_min_length} caracteres.`
      );
    }

    const newHash = await this.hasher.hash(input.newPassword);
    user.updatePassword(newHash, true); // Forzar cambio de contraseña al iniciar sesión
    await this.userRepo.update(user);

    // Invalidar sesiones activas
    await this.sessionRepo.deleteByUserId(input.userId);
  }
}

export class CleanupExpiredSessions {
  constructor(
    private sessionRepo: SessionRepository,
    private clock: Clock
  ) {}

  async execute(): Promise<void> {
    await this.sessionRepo.cleanupExpired(this.clock.now());
  }
}
