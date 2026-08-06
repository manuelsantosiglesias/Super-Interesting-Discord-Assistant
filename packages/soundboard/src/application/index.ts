import { 
  ConflictError, 
  NotFoundError, 
  UniqueEntityID, 
  AppError, 
  PaginatedResult 
} from '@super-assistant/shared-kernel';
import { Config } from '@super-assistant/config';
import { 
  Sound, 
  SoundCommandName, 
  SoundRepository, 
  AudioProcessor, 
  AudioStorage,
  SoundListQuery 
} from '../domain/index.js';
import * as fs from 'fs';
import * as path from 'path';

export class UploadSound {
  constructor(
    private soundRepo: SoundRepository,
    private audioProcessor: AudioProcessor,
    private audioStorage: AudioStorage,
    private config: Config
  ) {}

  async execute(input: {
    tempFilePath: string;
    originalFilename: string;
    displayName: string;
    commandName: string;
    description: string | null;
    volume: number;
    uploadedBy: string;
  }): Promise<Sound> {
    const commandNameVO = new SoundCommandName(input.commandName);
    
    // 1. Validar unicidad del comando
    const existing = await this.soundRepo.findByCommandName(commandNameVO.toValue());
    if (existing && !existing.deletedAt) {
      throw new ConflictError('SOUND_COMMAND_ALREADY_EXISTS', `El comando '${commandNameVO.toValue()}' ya está registrado.`);
    }

    // 2. Inspeccionar archivo temporal
    let metadata;
    try {
      metadata = await this.audioProcessor.inspect(input.tempFilePath);
    } catch (err: any) {
      throw new AppError('SOUND_INVALID_AUDIO', 'El archivo no contiene audio válido o está corrupto.');
    }

    // 3. Validar límites de duración y tamaño
    const maxSizeBytes = this.config.app.max_audio_size_mb * 1024 * 1024;
    const stats = fs.statSync(input.tempFilePath);
    if (stats.size > maxSizeBytes) {
      throw new AppError(
        'SOUND_FILE_TOO_LARGE', 
        `El archivo excede el tamaño máximo permitido de ${this.config.app.max_audio_size_mb} MB.`
      );
    }

    const durationSeconds = metadata.durationMs / 1000;
    if (durationSeconds > this.config.app.max_audio_duration_seconds) {
      throw new AppError(
        'SOUND_DURATION_TOO_LONG', 
        `La duración excede el límite permitido de ${this.config.app.max_audio_duration_seconds} segundos.`
      );
    }

    if (metadata.durationMs <= 0) {
      throw new AppError('SOUND_INVALID_AUDIO', 'El archivo de audio tiene una duración de cero segundos.');
    }

    const soundId = new UniqueEntityID();
    const soundIdStr = soundId.toString();
    const oggFilename = `${soundIdStr}.ogg`;

    // Rutas físicas y almacenamiento
    const localOggPath = path.join(this.config.app.temp_directory, oggFilename);
    let oggStoredFilename = '';
    let originalStoredFilename: string | null = null;

    try {
      // 4. Convertir a Ogg Opus en directorio temporal primero
      await this.audioProcessor.convertToOggOpus(input.tempFilePath, localOggPath);

      // 5. Mover y persistir el archivo normalizado
      oggStoredFilename = await this.audioStorage.saveFile(localOggPath, oggFilename, false);

      // 6. Conservar original opcionalmente
      if (this.config.app.preserve_originals) {
        const ext = path.extname(input.originalFilename) || '.bin';
        const origFilename = `${soundIdStr}${ext}`;
        originalStoredFilename = await this.audioStorage.saveFile(input.tempFilePath, origFilename, true);
      }

      // 7. Crear entidad e insertar en BD
      const sound = Sound.create({
        displayName: input.displayName.trim() || commandNameVO.toValue(),
        commandName: commandNameVO,
        description: input.description,
        originalFilename: input.originalFilename,
        storageFilename: oggStoredFilename,
        originalStorageFilename: originalStoredFilename,
        mimeType: 'audio/ogg',
        sizeBytes: fs.statSync(this.audioStorage.getFilePath(oggStoredFilename, false)).size,
        durationMs: metadata.durationMs,
        sha256: metadata.sha256,
        volume: input.volume,
        uploadedBy: input.uploadedBy
      }, soundId);

      await this.soundRepo.save(sound);
      return sound;

    } catch (dbOrProcError) {
      // PATRÓN COMPENSATORIO: Limpieza si falla el proceso o la base de datos
      try {
        if (oggStoredFilename) {
          await this.audioStorage.deleteFile(oggStoredFilename, false);
        }
        if (originalStoredFilename) {
          await this.audioStorage.deleteFile(originalStoredFilename, true);
        }
      } catch (cleanupErr) {
        // Loggear o ignorar error secundario en limpieza
      }
      throw dbOrProcError;
    } finally {
      // Eliminar archivos temporales siempre
      try {
        if (fs.existsSync(localOggPath)) {
          fs.unlinkSync(localOggPath);
        }
      } catch (err) {}
    }
  }
}

export class ListSounds {
  constructor(private soundRepo: SoundRepository) {}

  async execute(query: SoundListQuery): Promise<PaginatedResult<Sound>> {
    return this.soundRepo.list(query);
  }
}

export class GetSound {
  constructor(private soundRepo: SoundRepository) {}

  async execute(id: string): Promise<Sound> {
    const sound = await this.soundRepo.findById(id);
    if (!sound || sound.deletedAt) {
      throw new NotFoundError('SOUND_NOT_FOUND', 'No se encontró el sonido.');
    }
    return sound;
  }
}

export class UpdateSound {
  constructor(private soundRepo: SoundRepository) {}

  async execute(input: {
    id: string;
    displayName?: string;
    commandName?: string;
    description?: string | null;
    volume?: number;
    isActive?: boolean;
  }): Promise<Sound> {
    const sound = await this.soundRepo.findById(input.id);
    if (!sound || sound.deletedAt) {
      throw new NotFoundError('SOUND_NOT_FOUND', 'No se encontró el sonido.');
    }

    let commandNameVO: SoundCommandName | undefined;
    if (input.commandName !== undefined) {
      commandNameVO = new SoundCommandName(input.commandName);
      
      // Validar que el comando no esté duplicado en otro sonido
      const existing = await this.soundRepo.findByCommandName(commandNameVO.toValue());
      if (existing && existing.id.toString() !== sound.id.toString() && !existing.deletedAt) {
        throw new ConflictError('SOUND_COMMAND_ALREADY_EXISTS', `El comando '${commandNameVO.toValue()}' ya está registrado.`);
      }
    }

    sound.updateMetadata({
      displayName: input.displayName,
      commandName: commandNameVO,
      description: input.description,
      volume: input.volume,
      isActive: input.isActive
    });

    await this.soundRepo.update(sound);
    return sound;
  }
}

export class DeleteSound {
  constructor(
    private soundRepo: SoundRepository,
    private audioStorage: AudioStorage
  ) {}

  async execute(id: string, hardDelete: boolean = false): Promise<void> {
    const sound = await this.soundRepo.findById(id);
    if (!sound || sound.deletedAt) {
      throw new NotFoundError('SOUND_NOT_FOUND', 'No se encontró el sonido.');
    }

    if (hardDelete) {
      // Borrado físico: eliminar archivos de almacenamiento y registro en BD
      await this.soundRepo.physicalDelete(id);
      try {
        await this.audioStorage.deleteFile(sound.storageFilename, false);
        if (sound.originalStorageFilename) {
          await this.audioStorage.deleteFile(sound.originalStorageFilename, true);
        }
      } catch (err) {
        // Loguear error de borrado físico del archivo, pero continuar
      }
    } else {
      // Borrado lógico predeterminado
      sound.delete();
      await this.soundRepo.update(sound);
    }
  }
}

export class StreamSound {
  constructor(
    private soundRepo: SoundRepository,
    private audioStorage: AudioStorage
  ) {}

  async execute(id: string, isOriginal: boolean = false): Promise<string> {
    const sound = await this.soundRepo.findById(id);
    if (!sound || sound.deletedAt) {
      throw new NotFoundError('SOUND_NOT_FOUND', 'No se encontró el sonido.');
    }

    const filename = isOriginal && sound.originalStorageFilename ? sound.originalStorageFilename : sound.storageFilename;
    const isOrigFlag = isOriginal && !!sound.originalStorageFilename;

    if (!(await this.audioStorage.fileExists(filename, isOrigFlag))) {
      throw new NotFoundError('SOUND_FILE_NOT_FOUND', 'El archivo físico del sonido no existe.');
    }

    return this.audioStorage.getFilePath(filename, isOrigFlag);
  }
}

export class CheckCommandAvailability {
  constructor(private soundRepo: SoundRepository) {}

  async execute(name: string): Promise<boolean> {
    try {
      const commandNameVO = new SoundCommandName(name);
      const existing = await this.soundRepo.findByCommandName(commandNameVO.toValue());
      return !existing || !!existing.deletedAt;
    } catch {
      return false; // Si el comando es sintácticamente inválido, no está disponible
    }
  }
}

export class ResolveSoundByCommand {
  constructor(private soundRepo: SoundRepository) {}

  async execute(commandName: string): Promise<Sound> {
    const normalized = commandName.trim().toLowerCase();
    const sound = await this.soundRepo.findByCommandName(normalized);
    if (!sound || sound.deletedAt) {
      throw new NotFoundError('SOUND_NOT_FOUND', `No se encontró un sonido con el comando '${commandName}'.`);
    }
    if (!sound.isActive) {
      throw new AppError('SOUND_INACTIVE', `El sonido '${sound.displayName}' está desactivado.`);
    }
    return sound;
  }
}
