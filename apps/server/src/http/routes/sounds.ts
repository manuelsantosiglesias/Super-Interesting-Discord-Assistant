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
  pageSize: z.coerce.number().min(1).max(500).default(20),
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
    let filePath: string;
    try {
      filePath = await container.streamSound.execute(params.id, true);
    } catch {
      filePath = await container.streamSound.execute(params.id, false);
    }
    
    const sound = await container.getSound.execute(params.id);
    
    // Regla de negocio: los sonidos inactivos solo los puede previsualizar el ADMIN en web
    if (!sound.isActive && request.user!.role !== 'ADMIN') {
      throw new AppError('AUTH_FORBIDDEN', 'No tienes permisos para escuchar este sonido desactivado.');
    }

    if (!fs.existsSync(filePath)) {
      throw new AppError('NOT_FOUND', 'El archivo físico del sonido no existe.');
    }

    const stats = fs.statSync(filePath);
    const fileSize = stats.size;
    const ext = path.extname(filePath).toLowerCase();

    const contentType = ext === '.mp3' ? 'audio/mpeg' :
      ext === '.wav' ? 'audio/wav' :
      ext === '.m4a' || ext === '.mp4' ? 'audio/mp4' :
      sound.mimeType || 'audio/ogg';

    const rangeHeader = request.headers.range;

    if (rangeHeader) {
      const parts = rangeHeader.replace(/bytes=/, "").split("-");
      const start = parseInt(parts[0], 10) || 0;
      let end = parts[1] ? parseInt(parts[1], 10) : fileSize - 1;

      if (isNaN(end) || end >= fileSize) {
        end = fileSize - 1;
      }

      if (start >= fileSize || start > end) {
        return reply.code(416).headers({
          'Content-Range': `bytes */${fileSize}`,
          'Content-Type': contentType
        }).send();
      }

      const chunksize = (end - start) + 1;
      const fileStream = fs.createReadStream(filePath, { start, end });
      fileStream.on('error', (err) => {
        container.logger.error('Error en stream de audio:', err);
        try { reply.raw.destroy(); } catch {}
      });

      return reply.code(206).headers({
        'Content-Range': `bytes ${start}-${end}/${fileSize}`,
        'Accept-Ranges': 'bytes',
        'Content-Length': chunksize,
        'Content-Type': contentType
      }).send(fileStream);
    } else {
      const fileStream = fs.createReadStream(filePath);
      fileStream.on('error', (err) => {
        container.logger.error('Error en stream completo:', err);
        try { reply.raw.destroy(); } catch {}
      });

      return reply.code(200).headers({
        'Content-Length': fileSize,
        'Content-Type': contentType,
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

  // 9. Reproducción rápida automática (en el canal con más personas o el último usado)
  fastify.post('/api/sounds/:id/quick-play', async (request, reply) => {
    const params = z.object({ id: z.string() }).parse(request.params);
    const client = container.discordBot;

    if (!client || !client.readyAt) {
      reply.code(400).send({ error: { code: 'BOT_NOT_READY', message: 'El bot de Discord no está conectado actualmente.' } });
      return;
    }

    let bestGuildId = '';
    let bestChannelId = '';
    let maxHumanMembers = 0;

    // Recorrer servidores y canales de voz para buscar el canal con más usuarios humanos
    for (const [, guild] of client.guilds.cache) {
      for (const [, channel] of guild.channels.cache) {
        if (channel.isVoiceBased()) {
          const humanCount = channel.members.filter((m: any) => !m.user.bot).size;
          if (humanCount > maxHumanMembers) {
            maxHumanMembers = humanCount;
            bestGuildId = guild.id;
            bestChannelId = channel.id;
          }
        }
      }
    }

    // 2. Si no hay ningún canal con usuarios humanos, buscar el último canal donde se haya reproducido sonido
    if (!bestGuildId || !bestChannelId) {
      const activeQueues = (container as any).queueManager?.getQueues ? (container as any).queueManager.getQueues() : [];
      for (const [guildId, queue] of activeQueues) {
        const currentCh = queue.getCurrentChannel();
        if (currentCh) {
          bestGuildId = guildId;
          bestChannelId = currentCh;
          break;
        }
      }
    }

    if (!bestChannelId) {
      reply.code(400).send({
        error: {
          code: 'NO_ACTIVE_VOICE_CHANNEL',
          message: 'No hay usuarios conectados a canales de voz ni canales activos recientes.'
        }
      });
      return;
    }

    await container.playSoundFromWeb.execute({
      soundId: params.id,
      discordGuildId: bestGuildId,
      voiceChannelId: bestChannelId,
      webUserId: request.user!.id.toString()
    });

    await container.writeAuditEvent.execute({
      userId: request.user!.id.toString(),
      action: 'SOUND_QUICK_PLAYED',
      entityType: 'Sound',
      entityId: params.id,
      metadataJson: { guildId: bestGuildId, voiceChannelId: bestChannelId, membersCount: maxHumanMembers },
      ipAddress: request.ip
    });

    return {
      success: true,
      guildId: bestGuildId,
      voiceChannelId: bestChannelId,
      humanMembers: maxHumanMembers
    };
  });
}
