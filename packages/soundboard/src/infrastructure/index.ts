import { Kysely } from 'kysely';
import ffmpegPath from 'ffmpeg-static';
import ffprobeStatic from 'ffprobe-static';
import { spawn } from 'child_process';
import * as crypto from 'crypto';
import * as fs from 'fs';
import * as path from 'path';
import { 
  SoundRepository, 
  Sound, 
  SoundCommandName, 
  SoundListQuery, 
  AudioStorage, 
  AudioProcessor, 
  AudioMetadata 
} from '../domain/index.js';
import { UniqueEntityID, PaginatedResult } from '@super-assistant/shared-kernel';

export class KyselySoundRepository implements SoundRepository {
  constructor(private db: Kysely<any>) {}

  private mapToDomain(row: any): Sound {
    return new Sound({
      displayName: row.display_name,
      commandName: new SoundCommandName(row.command_name),
      description: row.description,
      originalFilename: row.original_filename,
      storageFilename: row.storage_filename,
      originalStorageFilename: row.original_storage_filename,
      mimeType: row.mime_type,
      normalizedFormat: row.normalized_format,
      sizeBytes: Number(row.size_bytes),
      durationMs: Number(row.duration_ms),
      sha256: row.sha256,
      volume: Number(row.volume),
      isActive: Boolean(row.is_active),
      uploadedBy: row.uploaded_by,
      createdAt: new Date(row.created_at),
      updatedAt: new Date(row.updated_at),
      deletedAt: row.deleted_at ? new Date(row.deleted_at) : null
    }, new UniqueEntityID(row.id));
  }

  async findById(id: string): Promise<Sound | null> {
    const row = await this.db
      .selectFrom('sounds')
      .selectAll()
      .where('id', '=', id)
      .executeTakeFirst();
    if (!row) return null;
    return this.mapToDomain(row);
  }

  async findByCommandName(commandName: string): Promise<Sound | null> {
    const row = await this.db
      .selectFrom('sounds')
      .selectAll()
      .where('command_name', '=', commandName)
      .executeTakeFirst();
    if (!row) return null;
    return this.mapToDomain(row);
  }

  async list(query: SoundListQuery): Promise<PaginatedResult<Sound>> {
    const limit = Math.min(Math.max(query.pageSize, 1), 100);
    const offset = (Math.max(query.page, 1) - 1) * limit;

    let q = this.db.selectFrom('sounds').selectAll().where('deleted_at', 'is', null);

    if (query.active !== undefined) {
      q = q.where('is_active', '=', query.active ? 1 : 0);
    }

    if (query.search) {
      const searchPattern = `%${query.search}%`;
      q = q.where((eb) =>
        eb.or([
          eb('display_name', 'like', searchPattern),
          eb('command_name', 'like', searchPattern),
          eb('description', 'like', searchPattern)
        ])
      );
    }

    // Contar total con los filtros aplicados
    const countQ = this.db
      .selectFrom('sounds')
      .select((eb) => eb.fn.count('id').as('total'))
      .where('deleted_at', 'is', null);
      
    let countResQ = countQ;
    if (query.active !== undefined) {
      countResQ = countResQ.where('is_active', '=', query.active ? 1 : 0);
    }
    if (query.search) {
      const searchPattern = `%${query.search}%`;
      countResQ = countResQ.where((eb) =>
        eb.or([
          eb('display_name', 'like', searchPattern),
          eb('command_name', 'like', searchPattern),
          eb('description', 'like', searchPattern)
        ])
      );
    }
    
    const countRes = await countResQ.executeTakeFirst();
    const totalItems = Number(countRes?.total || 0);
    const totalPages = Math.ceil(totalItems / limit);

    // Ordenamiento con whitelist para prevenir inyección de columnas
    const sortFieldMap: Record<string, string> = {
      displayName: 'display_name',
      commandName: 'command_name',
      createdAt: 'created_at',
      durationMs: 'duration_ms',
      sizeBytes: 'size_bytes'
    };
    
    const sortBy = query.sort && sortFieldMap[query.sort] ? sortFieldMap[query.sort] : 'created_at';
    const direction = query.direction === 'asc' ? 'asc' : 'desc';

    const rows = await q
      .orderBy(sortBy as any, direction)
      .limit(limit)
      .offset(offset)
      .execute();

    return {
      items: rows.map(r => this.mapToDomain(r)),
      pagination: {
        page: query.page,
        pageSize: limit,
        totalItems,
        totalPages
      }
    };
  }

  async save(sound: Sound): Promise<void> {
    await this.db
      .insertInto('sounds')
      .values({
        id: sound.id.toString(),
        display_name: sound.displayName,
        command_name: sound.commandName.toValue(),
        description: sound.description,
        original_filename: sound.originalFilename,
        storage_filename: sound.storageFilename,
        original_storage_filename: sound.originalStorageFilename,
        mime_type: sound.mimeType,
        normalized_format: sound.normalizedFormat,
        size_bytes: sound.sizeBytes,
        duration_ms: sound.durationMs,
        sha256: sound.sha256,
        volume: sound.volume,
        is_active: sound.isActive ? 1 : 0,
        uploaded_by: sound.uploadedBy,
        created_at: sound.createdAt,
        updated_at: sound.updatedAt,
        deleted_at: sound.deletedAt
      })
      .execute();
  }

  async update(sound: Sound): Promise<void> {
    await this.db
      .updateTable('sounds')
      .set({
        display_name: sound.displayName,
        command_name: sound.commandName.toValue(),
        description: sound.description,
        volume: sound.volume,
        is_active: sound.isActive ? 1 : 0,
        updated_at: sound.updatedAt,
        deleted_at: sound.deletedAt
      })
      .where('id', '=', sound.id.toString())
      .execute();
  }

  async delete(id: string): Promise<void> {
    const sound = await this.findById(id);
    if (sound) {
      sound.delete();
      await this.update(sound);
    } else {
      const now = new Date();
      await this.db
        .updateTable('sounds')
        .set({
          deleted_at: now
        })
        .where('id', '=', id)
        .execute();
    }
  }

  async physicalDelete(id: string): Promise<void> {
    await this.db
      .deleteFrom('sounds')
      .where('id', '=', id)
      .execute();
  }
}

export class LocalAudioStorage implements AudioStorage {
  constructor(
    private uploadDir: string,
    private originalsDir: string
  ) {
    if (!fs.existsSync(uploadDir)) {
      fs.mkdirSync(uploadDir, { recursive: true });
    }
    if (!fs.existsSync(originalsDir)) {
      fs.mkdirSync(originalsDir, { recursive: true });
    }
  }

  getFilePath(filename: string, isOriginal: boolean): string {
    const baseDir = isOriginal ? this.originalsDir : this.uploadDir;
    const safeFilename = path.basename(filename);
    return path.resolve(baseDir, safeFilename);
  }

  async saveFile(srcPath: string, filename: string, isOriginal: boolean): Promise<string> {
    const destPath = this.getFilePath(filename, isOriginal);
    fs.copyFileSync(srcPath, destPath);
    return filename;
  }

  async deleteFile(filename: string, isOriginal: boolean): Promise<void> {
    const destPath = this.getFilePath(filename, isOriginal);
    if (fs.existsSync(destPath)) {
      fs.unlinkSync(destPath);
    }
  }

  async fileExists(filename: string, isOriginal: boolean): Promise<boolean> {
    const destPath = this.getFilePath(filename, isOriginal);
    return fs.existsSync(destPath);
  }
}

export class FFmpegAudioProcessor implements AudioProcessor {
  private ffmpegExe: string;
  private ffprobeExe: string;

  constructor() {
    this.ffmpegExe = (ffmpegPath as any)?.path || (ffmpegPath as unknown as string) || 'ffmpeg';
    this.ffprobeExe = (ffprobeStatic as any)?.path || (ffprobeStatic as unknown as string) || 'ffprobe';
  }

  async inspect(filePath: string): Promise<AudioMetadata> {
    return new Promise((resolve, reject) => {
      const args = [
        '-v', 'quiet',
        '-print_format', 'json',
        '-show_format',
        '-show_streams',
        filePath
      ];
      
      const proc = spawn(this.ffprobeExe, args);
      let stdout = '';
      let stderr = '';

      proc.stdout.on('data', (data) => { stdout += data; });
      proc.stderr.on('data', (data) => { stderr += data; });

      const timeout = setTimeout(() => {
        proc.kill();
        reject(new Error('Inspección ffprobe expiró (TIMEOUT)'));
      }, 5000);

      proc.on('close', (code) => {
        clearTimeout(timeout);
        if (code !== 0) {
          reject(new Error(`ffprobe terminó con código ${code}. Stderr: ${stderr}`));
          return;
        }

        try {
          const parsed = JSON.parse(stdout);
          const audioStream = parsed.streams?.find((s: any) => s.codec_type === 'audio');
          if (!audioStream) {
            reject(new Error('El archivo no contiene ninguna pista de audio.'));
            return;
          }

          const durationMs = Math.round(Number(parsed.format?.duration || audioStream.duration || 0) * 1000);
          const sizeBytes = Number(parsed.format?.size || 0);

          const fileBuffer = fs.readFileSync(filePath);
          const sha256 = crypto.createHash('sha256').update(fileBuffer).digest('hex');

          resolve({
            mimeType: `audio/${audioStream.codec_name || 'unknown'}`,
            sizeBytes,
            durationMs,
            sha256
          });
        } catch (err) {
          reject(err);
        }
      });

      proc.on('error', (err) => {
        clearTimeout(timeout);
        reject(err);
      });
    });
  }

  async convertToOggOpus(srcPath: string, destPath: string): Promise<void> {
    return new Promise((resolve, reject) => {
      const args = [
        '-y',
        '-i', srcPath,
        '-acodec', 'libopus',
        '-b:a', '128k',
        '-ar', '48000',
        '-ac', '2',
        destPath
      ];

      const proc = spawn(this.ffmpegExe, args);
      let stderr = '';

      proc.stderr.on('data', (data) => { stderr += data; });

      const timeout = setTimeout(() => {
        proc.kill();
        reject(new Error('La conversión FFmpeg expiró (TIMEOUT)'));
      }, 15000);

      proc.on('close', (code) => {
        clearTimeout(timeout);
        if (code !== 0) {
          reject(new Error(`FFmpeg terminó con código ${code}. Detalle: ${stderr}`));
        } else {
          resolve();
        }
      });

      proc.on('error', (err) => {
        clearTimeout(timeout);
        reject(err);
      });
    });
  }
}
