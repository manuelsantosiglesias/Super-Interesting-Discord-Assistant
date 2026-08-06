import { DomainError, Entity, UniqueEntityID, PaginatedResult } from '@super-assistant/shared-kernel';

export class SoundCommandName {
  private readonly value: string;

  constructor(name: string) {
    if (!name) {
      throw new DomainError('SOUND_INVALID_COMMAND', 'El nombre del comando no puede estar vacío.');
    }
    const normalized = name.trim().toLowerCase();
    
    // Validar longitud
    if (normalized.length < 2 || normalized.length > 64) {
      throw new DomainError('SOUND_INVALID_COMMAND', 'El nombre del comando debe tener entre 2 y 64 caracteres.');
    }
    
    // Validar caracteres: letras, números, guiones y guiones bajos únicamente
    // Evita inyecciones de comandos, path traversal, barras y puntos
    if (!/^[a-z0-9\-_]+$/.test(normalized)) {
      throw new DomainError(
        'SOUND_INVALID_COMMAND', 
        'El nombre del comando solo puede contener letras, números, guiones y guiones bajos.'
      );
    }

    this.value = normalized;
  }

  public toString(): string {
    return this.value;
  }

  public toValue(): string {
    return this.value;
  }

  public equals(other: SoundCommandName): boolean {
    return this.value === other.toValue();
  }
}

export interface AudioMetadata {
  mimeType: string;
  sizeBytes: number;
  durationMs: number;
  sha256: string;
}

export interface SoundProps {
  displayName: string;
  commandName: SoundCommandName;
  description: string | null;
  originalFilename: string;
  storageFilename: string;
  originalStorageFilename: string | null;
  mimeType: string;
  normalizedFormat: string; // siempre "ogg"
  sizeBytes: number;
  durationMs: number;
  sha256: string;
  volume: number; // 0.000 a 2.000
  isActive: boolean;
  uploadedBy: string; // UserId
  createdAt: Date;
  updatedAt: Date;
  deletedAt: Date | null;
}

export class Sound extends Entity<SoundProps> {
  static create(
    props: Omit<SoundProps, 'normalizedFormat' | 'isActive' | 'createdAt' | 'updatedAt' | 'deletedAt'>, 
    id?: UniqueEntityID
  ): Sound {
    if (props.volume < 0 || props.volume > 2) {
      throw new DomainError('SOUND_INVALID_VOLUME', 'El volumen debe estar entre 0.0 y 2.0.');
    }
    const now = new Date();
    return new Sound({
      ...props,
      normalizedFormat: 'ogg',
      isActive: true,
      createdAt: now,
      updatedAt: now,
      deletedAt: null
    }, id);
  }

  get displayName(): string { return this.props.displayName; }
  get commandName(): SoundCommandName { return this.props.commandName; }
  get description(): string | null { return this.props.description; }
  get originalFilename(): string { return this.props.originalFilename; }
  get storageFilename(): string { return this.props.storageFilename; }
  get originalStorageFilename(): string | null { return this.props.originalStorageFilename; }
  get mimeType(): string { return this.props.mimeType; }
  get normalizedFormat(): string { return this.props.normalizedFormat; }
  get sizeBytes(): number { return this.props.sizeBytes; }
  get durationMs(): number { return this.props.durationMs; }
  get sha256(): string { return this.props.sha256; }
  get volume(): number { return this.props.volume; }
  get isActive(): boolean { return this.props.isActive; }
  get uploadedBy(): string { return this.props.uploadedBy; }
  get createdAt(): Date { return this.props.createdAt; }
  get updatedAt(): Date { return this.props.updatedAt; }
  get deletedAt(): Date | null { return this.props.deletedAt; }

  public updateMetadata(props: {
    displayName?: string;
    commandName?: SoundCommandName;
    description?: string | null;
    volume?: number;
    isActive?: boolean;
  }): void {
    if (props.volume !== undefined && (props.volume < 0 || props.volume > 2)) {
      throw new DomainError('SOUND_INVALID_VOLUME', 'El volumen debe estar entre 0.0 y 2.0.');
    }
    
    if (props.displayName !== undefined) this.props.displayName = props.displayName;
    if (props.commandName !== undefined) this.props.commandName = props.commandName;
    if (props.description !== undefined) this.props.description = props.description;
    if (props.volume !== undefined) this.props.volume = props.volume;
    if (props.isActive !== undefined) this.props.isActive = props.isActive;
    
    this.props.updatedAt = new Date();
  }

  public delete(now: Date = new Date()): void {
    this.props.deletedAt = now;
    this.props.updatedAt = now;
  }

  public restore(): void {
    this.props.deletedAt = null;
    this.props.updatedAt = new Date();
  }
}

export interface SoundListQuery {
  search?: string;
  active?: boolean;
  page: number;
  pageSize: number;
  sort?: 'displayName' | 'commandName' | 'createdAt' | 'durationMs' | 'sizeBytes';
  direction?: 'asc' | 'desc';
}

export interface SoundRepository {
  findById(id: string): Promise<Sound | null>;
  findByCommandName(commandName: string): Promise<Sound | null>;
  list(query: SoundListQuery): Promise<PaginatedResult<Sound>>;
  save(sound: Sound): Promise<void>;
  update(sound: Sound): Promise<void>;
  delete(id: string): Promise<void>; // Borrado lógico (marcar en BD)
  physicalDelete(id: string): Promise<void>; // Borrado físico (si se requiere purgar)
}

export interface AudioProcessor {
  inspect(filePath: string): Promise<AudioMetadata>;
  convertToOggOpus(srcPath: string, destPath: string): Promise<void>;
}

export interface AudioStorage {
  saveFile(srcPath: string, filename: string, isOriginal: boolean): Promise<string>;
  getFilePath(filename: string, isOriginal: boolean): string;
  deleteFile(filename: string, isOriginal: boolean): Promise<void>;
  fileExists(filename: string, isOriginal: boolean): Promise<boolean>;
}
