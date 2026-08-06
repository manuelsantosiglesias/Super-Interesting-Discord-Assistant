import { FastifyInstance } from 'fastify';
import { z } from 'zod';
import * as fs from 'fs';
import * as path from 'path';
import { pipeline } from 'stream/promises';
import { randomUUID } from 'crypto';
import { AppContainer } from '../../composition-root/index.js';
import { AppError } from '@super-assistant/shared-kernel';

const SoundListQuerySchema = z.object({
  search: z.string().optional(),
  active: z.preprocess((val) => val === 'true' || val === '1' ? true : val === 'false' || val === '0' ? false : undefined, z.boolean().optional()),
  page: z.coerce.number().min(1).default(1),
  pageSize: z.coerce.number().min(1).max(100).default(20),
  sort: z.enum(['displayName', 'commandName', 'createdAt', 'durationMs', 'sizeBytes']).default('createdAt'),
  direction: z.enum(['asc', 'desc']).default('desc')
});

const SoundUpdateSchema = z.object({
  displayName: z.string().optional(),
  commandName: z.string().optional(),
  description: z.string().nullable().optional(),
  volume: z.coerce.number().min(0.0).max(2.0).optional(),
  isActive: z.preprocess((val) => val === 'true' || val === '1' || val === true, z.boolean()).optional()
});

const PlayDiscordSchema = z.object({
  guildId: z.string(),
  voiceChannelId: z.string()
});

export default async function soundRoutes(fastify: FastifyInstance, options: { container: AppContainer }) {
  const { container } = options;

  fastify.addHook('preHandler', fastify.authenticate);

  // 1. Listar sonidos
  fastify.get('/api/sounds', async (request, reply) => {
    const query = SoundListQuerySchema.parse(request.query);
    const result = await container.listSounds.execute(query);

    return {
      items: result.items.map((s) => ({
        id: s.id.toString(),
        displayName: s.displayName,
        commandName: s.commandName.toValue(),
        description: s.description,
        originalFilename: s.originalFilename,
        storageFilename: s.storageFilename,
        mimeType: s.mimeType,
        sizeBytes: s.sizeBytes,
        durationMs: s.durationMs,
        volume: s.volume,
        isActive: s.isActive,
        uploadedBy: s.uploadedBy,
        createdAt: s.createdAt,
        updatedAt: s.updatedAt
      })),
      pagination: result.pagination
    };
  });

  // 2. Subir sonido (Multipart)
  fastify.post('/api/sounds', async (request, reply) => {
    if (!request.isMultipart()) {
      reply.code(400).send({ error: { code: 'INVALID_MULTIPART', message: 'La petición debe ser multipart/form-data.' } });
      return;
    }

    const parts = request.parts();
    let tempFilePath = '';
    let originalFilename = '';
    const fields: Record<string, any> = {};

    try {
      for await (const part of parts) {
        if (part.type === 'file') {
          if (part.fieldname === 'file') {
            originalFilename = part.filename;
            const tempName = `${randomUUID()}.tmp`;
            tempFilePath = path.join(path.resolve(container.config.app.temp_directory), tempName);
            const writeStream = fs.createWriteStream(tempFilePath);
            await pipeline(part.file, writeStream);
          } else {
            await part.toBuffer();
          }
        } else {
          fields[part.fieldname] = part.value;
        }
      }

      if (!tempFilePath) {
        reply.code(400).send({ error: { code: 'SOUND_MISSING_FILE', message: 'No se ha proporcionado ningún archivo de audio.' } });
        return;
      }

      const displayName = fields.displayName || originalFilename;
      const commandName = fields.commandName || '';
      const description = fields.description || null;
      const volume = fields.volume ? parseFloat(fields.volume) : 1.0;

      const sound = await container.uploadSound.execute({
        tempFilePath,
        originalFilename,
        displayName,
        commandName,
        description,
        volume,
        uploadedBy: request.user!.id.toString()
      });

      // Registrar auditoría
      await container.writeAuditEvent.execute({
        userId: request.user!.id.toString(),
        action: 'SOUND_UPLOADED',
        entityType: 'Sound',
        entityId: sound.id.toString(),
        metadataJson: { displayName: sound.displayName, commandName: sound.commandName.toValue() },
        ipAddress: request.ip
      });

      reply.code(201).send({
        id: sound.id.toString(),
        displayName: sound.displayName,
        commandName: sound.commandName.toValue(),
        sizeBytes: sound.sizeBytes,
        durationMs: sound.durationMs
      });

    } catch (err: any) {
      if (tempFilePath && fs.existsSync(tempFilePath)) {
        try { fs.unlinkSync(tempFilePath); } catch {}
      }
      throw err;
    }
  });

  // 3. Comprobar disponibilidad de comando
  fastify.get('/api/sounds/commands/check', async (request, reply) => {
    const query = z.object({ name: z.string() }).parse(request.query);
    const isAvailable = await container.checkCommandAvailability.execute(query.name);
    return { available: isAvailable };
  });

  // 4. Obtener detalle de sonido
  fastify.get('/api/sounds/:id', async (request, reply) => {
    const params = z.object({ id: z.string() }).parse(request.params);
    const sound = await container.getSound.execute(params.id);
    return {
      id: sound.id.toString(),
      displayName: sound.displayName,
      commandName: sound.commandName.toValue(),
      description: sound.description,
      originalFilename: sound.originalFilename,
      sizeBytes: sound.sizeBytes,
      durationMs: sound.durationMs,
      volume: sound.volume,
      isActive: sound.isActive,
      createdAt: sound.createdAt
    };
  });

  // 5. Editar sonido
  fastify.patch('/api/sounds/:id', async (request, reply) => {
    const params = z.object({ id: z.string() }).parse(request.params);
    const body = SoundUpdateSchema.parse(request.body);

    const sound = await container.updateSound.execute({
      id: params.id,
      displayName: body.displayName,
      commandName: body.commandName,
      description: body.description,
      volume: body.volume,
      isActive: body.isActive
    });

    await container.writeAuditEvent.execute({
      userId: request.user!.id.toString(),
      action: 'SOUND_UPDATED',
      entityType: 'Sound',
      entityId: sound.id.toString(),
      metadataJson: { displayName: sound.displayName, commandName: sound.commandName.toValue() },
      ipAddress: request.ip
    });

    return {
      id: sound.id.toString(),
      displayName: sound.displayName,
      commandName: sound.commandName.toValue(),
      isActive: sound.isActive
    };
  });

  // 6. Eliminar sonido (lógico)
  fastify.delete('/api/sounds/:id', async (request, reply) => {
    const params = z.object({ id: z.string() }).parse(request.params);
    
    await container.deleteSound.execute(params.id, false); // false = borrado lógico

    await container.writeAuditEvent.execute({
      userId: request.user!.id.toString(),
      action: 'SOUND_DELETED',
      entityType: 'Sound',
      entityId: params.id,
      ipAddress: request.ip
    });

    return { success: true };
  });

  // 7. Reproducir en navegador (HTTP Range)
  fastify.get('/api/sounds/:id/audio', async (request, reply) => {
    const params = z.object({ id: z.string() }).parse(request.params);
    const filePath = await container.streamSound.execute(params.id, false);
    
    const sound = await container.getSound.execute(params.id);
    
    // Regla de negocio: los sonidos inactivos solo los puede previsualizar el ADMIN en web
    if (!sound.isActive && request.user!.role !== 'ADMIN') {
      throw new AppError('AUTH_FORBIDDEN', 'No tienes permisos para escuchar este sonido desactivado.');
    }

    const rangeHeader = request.headers.range;
    const stats = fs.statSync(filePath);
    const fileSize = stats.size;

    if (rangeHeader) {
      const parts = rangeHeader.replace(/bytes=/, "").split("-");
      const start = parseInt(parts[0], 10);
      const end = parts[1] ? parseInt(parts[1], 10) : fileSize - 1;

      if (start >= fileSize || end >= fileSize) {
        reply.code(416).header('Content-Range', `bytes */${fileSize}`).send();
        return;
      }

      const chunksize = (end - start) + 1;
      const fileStream = fs.createReadStream(filePath, { start, end });

      reply.code(206).headers({
        'Content-Range': `bytes ${start}-${end}/${fileSize}`,
        'Accept-Ranges': 'bytes',
        'Content-Length': chunksize,
        'Content-Type': 'audio/ogg'
      }).send(fileStream);
    } else {
      const fileStream = fs.createReadStream(filePath);
      reply.code(200).headers({
        'Content-Length': fileSize,
        'Content-Type': 'audio/ogg',
        'Accept-Ranges': 'bytes'
      }).send(fileStream);
    }
  });

  // 8. Reproducir en canal de voz de Discord desde el panel web
  fastify.post('/api/sounds/:id/play-discord', async (request, reply) => {
    const params = z.object({ id: z.string() }).parse(request.params);
    const body = PlayDiscordSchema.parse(request.body);

    await container.playSoundFromWeb.execute({
      soundId: params.id,
      discordGuildId: body.guildId,
      voiceChannelId: body.voiceChannelId,
      webUserId: request.user!.id.toString()
    });

    // Registrar auditoría
    await container.writeAuditEvent.execute({
      userId: request.user!.id.toString(),
      action: 'SOUND_PLAYED_FROM_WEB',
      entityType: 'Sound',
      entityId: params.id,
      metadataJson: { guildId: body.guildId, voiceChannelId: body.voiceChannelId },
      ipAddress: request.ip
    });

    return { success: true };
  });
}
