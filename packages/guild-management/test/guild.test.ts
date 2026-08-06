import { describe, it, expect } from 'vitest';
import { GuildConfiguration } from '../src/domain/index.js';

describe('Guild Management - Guild Domain', () => {
  it('debe crear una configuración de servidor con prefijo por defecto', () => {
    const guild = GuildConfiguration.create({
      discordGuildId: '123456789',
      guildName: 'Servidor de Pruebas',
      commandPrefix: '-sbdb',
      defaultVolume: 1.0,
      leaveAfterSeconds: 15,
      maxQueueSize: 10,
      userCooldownSeconds: 2,
      isEnabled: true
    });

    expect(guild.discordGuildId).toBe('123456789');
    expect(guild.commandPrefix).toBe('-sbdb');
    expect(guild.defaultVolume).toBe(1.0);
    expect(guild.allowedTextChannelIds).toEqual([]);
  });

  it('debe resolver canales permitidos de forma correcta', () => {
    const guild = GuildConfiguration.create({
      discordGuildId: '123456789',
      guildName: 'Servidor de Pruebas',
      commandPrefix: '-sbdb',
      defaultVolume: 1.0,
      leaveAfterSeconds: 15,
      maxQueueSize: 10,
      userCooldownSeconds: 2,
      isEnabled: true,
      allowedTextChannelIds: ['8888', '9999']
    });

    // Canal 8888 está permitido
    expect(guild.isChannelAllowed('8888')).toBe(true);
    // Canal 7777 no está permitido
    expect(guild.isChannelAllowed('7777')).toBe(false);

    // Si la lista está vacía, permite todo
    const emptyGuild = GuildConfiguration.create({
      discordGuildId: '123456789',
      guildName: 'Servidor de Pruebas',
      commandPrefix: '-sbdb',
      defaultVolume: 1.0,
      leaveAfterSeconds: 15,
      maxQueueSize: 10,
      userCooldownSeconds: 2,
      isEnabled: true
    });
    expect(emptyGuild.isChannelAllowed('7777')).toBe(true);
  });

  it('debe fallar ante un volumen predeterminado inválido', () => {
    expect(() => {
      GuildConfiguration.create({
        discordGuildId: '123456789',
        guildName: 'Servidor de Pruebas',
        commandPrefix: '-sbdb',
        defaultVolume: -0.5, // menor que 0
        leaveAfterSeconds: 15,
        maxQueueSize: 10,
        userCooldownSeconds: 2,
        isEnabled: true
      });
    }).toThrow('El volumen por defecto debe estar entre 0.0 y 2.0.');
  });
});
