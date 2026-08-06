import { describe, it, expect } from 'vitest';
import { Sound, SoundCommandName } from '../src/domain/index.js';
import { UniqueEntityID } from '@super-assistant/shared-kernel';

describe('Soundboard - Sound Domain', () => {
  it('debe validar un CommandName correcto', () => {
    const cmd = new SoundCommandName('risa-malvada');
    expect(cmd.toValue()).toBe('risa-malvada');

    const cmdCaps = new SoundCommandName('  Risa_Malvada_123  ');
    expect(cmdCaps.toValue()).toBe('risa_malvada_123');
  });

  it('debe fallar ante un CommandName inválido', () => {
    expect(() => new SoundCommandName('a')).toThrow('El nombre del comando');
    expect(() => new SoundCommandName('risa malvada')).toThrow('El nombre del comando');
    expect(() => new SoundCommandName('../../etc/passwd')).toThrow('El nombre del comando');
  });

  it('debe crear un sonido activo por defecto', () => {
    const sound = Sound.create({
      displayName: 'Aplausos',
      commandName: new SoundCommandName('aplausos'),
      description: 'Sonido de aplausos',
      originalFilename: 'test.mp3',
      storageFilename: 'sound-uuid.ogg',
      originalStorageFilename: null,
      mimeType: 'audio/ogg',
      sizeBytes: 12345,
      durationMs: 4500,
      sha256: 'abcde12345',
      volume: 1.0,
      uploadedBy: 'user-uuid'
    });

    expect(sound.isActive).toBe(true);
    expect(sound.volume).toBe(1.0);
    expect(sound.normalizedFormat).toBe('ogg');
  });

  it('debe fallar ante un volumen inválido', () => {
    expect(() => {
      Sound.create({
        displayName: 'Aplausos',
        commandName: new SoundCommandName('aplausos'),
        description: null,
        originalFilename: 'test.mp3',
        storageFilename: 'sound-uuid.ogg',
        originalStorageFilename: null,
        mimeType: 'audio/ogg',
        sizeBytes: 12345,
        durationMs: 4500,
        sha256: 'abcde12345',
        volume: 2.5, // Fuera del rango 0-2
        uploadedBy: 'user-uuid'
      });
    }).toThrow('El volumen debe estar entre 0.0 y 2.0.');
  });
});
