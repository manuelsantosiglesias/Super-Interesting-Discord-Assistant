import { describe, it, expect } from 'vitest';
import { User } from '../src/domain/index.js';
import { UniqueEntityID } from '@super-assistant/shared-kernel';

describe('Identity - User Domain', () => {
  it('debe crear un usuario activo por defecto', () => {
    const user = User.create({
      username: 'operador',
      passwordHash: 'argon_hash_123',
      role: 'USER',
      isActive: true,
      mustChangePassword: false
    });

    expect(user.username).toBe('operador');
    expect(user.role).toBe('USER');
    expect(user.isActive).toBe(true);
    expect(user.failedLoginAttempts).toBe(0);
    expect(user.isLocked()).toBe(false);
  });

  it('debe bloquear temporalmente tras superar intentos fallidos', () => {
    const user = User.create({
      username: 'operador',
      passwordHash: 'argon_hash_123',
      role: 'USER',
      isActive: true,
      mustChangePassword: false
    });

    // Simular 3 intentos fallidos (límite 3, bloqueo 15 minutos)
    user.incrementFailedAttempts(3, 15);
    expect(user.failedLoginAttempts).toBe(1);
    expect(user.isLocked()).toBe(false);

    user.incrementFailedAttempts(3, 15);
    user.incrementFailedAttempts(3, 15);
    expect(user.failedLoginAttempts).toBe(3);
    expect(user.isLocked()).toBe(true);
    expect(user.lockedUntil).toBeInstanceOf(Date);
  });

  it('debe desbloquear la cuenta al resetear intentos', () => {
    const user = User.create({
      username: 'operador',
      passwordHash: 'argon_hash_123',
      role: 'USER',
      isActive: true,
      mustChangePassword: false
    });

    user.incrementFailedAttempts(1, 15);
    expect(user.isLocked()).toBe(true);

    user.resetFailedAttempts();
    expect(user.failedLoginAttempts).toBe(0);
    expect(user.isLocked()).toBe(false);
  });

  it('debe cambiar la contraseña y marcar cambios', () => {
    const user = User.create({
      username: 'operador',
      passwordHash: 'argon_hash_123',
      role: 'USER',
      isActive: true,
      mustChangePassword: false
    });

    user.updatePassword('new_hash_456', true);
    expect(user.passwordHash).toBe('new_hash_456');
    expect(user.mustChangePassword).toBe(true);
  });

  it('debe desactivar y activar usuarios', () => {
    const user = User.create({
      username: 'operador',
      passwordHash: 'argon_hash_123',
      role: 'USER',
      isActive: true,
      mustChangePassword: false
    });

    user.disable();
    expect(user.isActive).toBe(false);

    user.enable();
    expect(user.isActive).toBe(true);
  });
});
