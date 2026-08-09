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
  pageSize: z.coerce.number().min(1).max(2000).default(20),
  sort: z.enum(['displayName', 'commandName', 'createdAt', 'durationMs', 'sizeBytes', 'playCount']).default('playCount'),
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

  // 1. Listar sonidos (con conteo de reproducciones y estado favorito)
  fastify.get('/api/sounds', async (request, reply) => {
    const query = SoundListQuerySchema.parse(request.query);
    const result = await container.listSounds.execute({
      ...query,
      sort: (query.sort === 'playCount' ? 'createdAt' : query.sort) as any
    });

    const soundIds = result.items.map((s) => s.id.toString());
    const playCountMap = new Map<string, number>();
    const favoriteSet = new Set<string>();

    if (soundIds.length > 0) {
      const counts = await container.db
        .selectFrom('playback_events')
        .select(['sound_id', (container.db.fn as any).count('id').as('play_count')])
        .where('sound_id', 'in', soundIds)
        .groupBy('sound_id')
        .execute();

      counts.forEach((c: any) => {
        if (c.sound_id) playCountMap.set(c.sound_id, Number(c.play_count));
      });

      if (request.user) {
        const favs = await container.db
          .selectFrom('user_favorites')
          .select('sound_id')
          .where('user_id', '=', request.user.id.toString())
          .where('sound_id', 'in', soundIds)
          .execute();

        favs.forEach((f: any) => favoriteSet.add(f.sound_id));
      }
    }

    let sortedItems = result.items.map((s) => ({
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
      updatedAt: s.updatedAt,
      playCount: playCountMap.get(s.id.toString()) || 0,
      isFavorite: favoriteSet.has(s.id.toString())
    }));

    // Regla: Favoritos primero siempre, y luego por la columna elegida (por defecto reproducciones desc)
    sortedItems.sort((a, b) => {
      // 1. Prioridad Favoritos
      if (a.isFavorite && !b.isFavorite) return -1;
      if (!a.isFavorite && b.isFavorite) return 1;

      // 2. Criterio de columna seleccionada
      const sortKey = query.sort as keyof typeof a;
      let valA: any = a[sortKey] ?? 0;
      let valB: any = b[sortKey] ?? 0;

      if (typeof valA === 'string') {
        valA = valA.toLowerCase();
        valB = (valB || '').toString().toLowerCase();
      } else if (valA instanceof Date) {
        valA = new Date(valA).getTime();
        valB = new Date(valB).getTime();
      }

      if (valA < valB) return query.direction === 'asc' ? -1 : 1;
      if (valA > valB) return query.direction === 'asc' ? 1 : -1;
      return 0;
    });

    return {
      items: sortedItems,
      pagination: result.pagination
    };
  });

  // Alternar favorito para el usuario autenticado
  fastify.post('/api/sounds/:id/favorite', async (request, reply) => {
    const params = z.object({ id: z.string() }).parse(request.params);
    const userId = request.user!.id.toString();

    const existing = await container.db
      .selectFrom('user_favorites')
      .select('sound_id')
      .where('user_id', '=', userId)
      .where('sound_id', '=', params.id)
      .executeTakeFirst();

    if (existing) {
      await container.db
        .deleteFrom('user_favorites')
        .where('user_id', '=', userId)
        .where('sound_id', '=', params.id)
        .execute();
      return { isFavorite: false };
    } else {
      await container.db
        .insertInto('user_favorites')
        .values({
          user_id: userId,
          sound_id: params.id,
          created_at: new Date()
        })
        .execute();
      return { isFavorite: true };
    }
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

  // 9. Reproducción rápida automática (respeta servidor indicado, y busca el canal con personas en dicho servidor si el indicado está vacío)
  fastify.post('/api/sounds/:id/quick-play', async (request, reply) => {
    const params = z.object({ id: z.string() }).parse(request.params);
    const body = z.object({
      guildId: z.string().optional(),
      voiceChannelId: z.string().optional()
    }).optional().parse(request.body || {});

    const client = container.discordBot;

    if (!client || !client.readyAt) {
      reply.code(400).send({ error: { code: 'BOT_NOT_READY', message: 'El bot de Discord no está conectado actualmente.' } });
      return;
    }

    const botClientId = client.user?.id;
    const getChannelHumanCount = (g: any, chId: string): number => {
      if (!chId || !g || !g.voiceStates) return 0;
      let count = 0;
      for (const [memberId, vs] of g.voiceStates.cache) {
        if (vs.channelId === chId) {
          if (botClientId && memberId === botClientId) continue;
          if (vs.member?.user?.bot === true) continue;
          count++;
        }
      }
      return count;
    };

    // A. DETERMINAR SERVIDOR INDICADO (GUILD)
    // 1. Servidor indicado en el body / localStorage
    let targetGuildId = body?.guildId || '';

    // 2. Si no fue indicado, buscar servidor donde el bot tenga cola activa
    if (!targetGuildId) {
      const activeQueues = container.queueManager?.getQueues ? container.queueManager.getQueues() : null;
      if (activeQueues) {
        for (const [gId, queue] of activeQueues) {
          if (queue.getCurrentChannel()) {
            targetGuildId = gId;
            break;
          }
        }
      }
    }

    // 3. Si no hay servidor activo, buscar el servidor con más personas en voz
    if (!targetGuildId) {
      let maxGuildHumans = 0;
      for (const [, g] of client.guilds.cache) {
        let countInGuild = 0;
        for (const [, ch] of g.channels.cache) {
          if (ch.isVoiceBased()) {
            countInGuild += getChannelHumanCount(g, ch.id);
          }
        }
        if (countInGuild > maxGuildHumans) {
          maxGuildHumans = countInGuild;
          targetGuildId = g.id;
        }
      }
    }

    // 4. Fallback: primer servidor en la caché del bot
    if (!targetGuildId && client.guilds.cache.size > 0) {
      targetGuildId = client.guilds.cache.first()!.id;
    }

    const guild = client.guilds.cache.get(targetGuildId);
    if (!guild) {
      reply.code(400).send({ error: { code: 'GUILD_NOT_FOUND', message: 'No se encontró el servidor de Discord indicado.' } });
      return;
    }

    // B. DETERMINAR CANAL DE VOZ DENTRO DEL SERVIDOR INDICADO
    let targetChannelId = body?.voiceChannelId || '';

    const indicatedHumanCount = targetChannelId ? getChannelHumanCount(guild, targetChannelId) : 0;

    // Regla de negocio:
    // Si el canal indicado tiene personas (indicatedHumanCount > 0), reproducir en él.
    // Si el canal indicado está VACÍO (indicatedHumanCount === 0) o no fue especificado, buscar en ESTE servidor el canal con MÁS personas.
    if (!targetChannelId || indicatedHumanCount === 0) {
      let bestChannelInGuild = '';
      let maxHumansInGuild = 0;

      for (const [, ch] of guild.channels.cache) {
        if (ch.isVoiceBased()) {
          const count = getChannelHumanCount(guild, ch.id);
          if (count > maxHumansInGuild) {
            maxHumansInGuild = count;
            bestChannelInGuild = ch.id;
          }
        }
      }

      if (bestChannelInGuild && maxHumansInGuild > 0) {
        targetChannelId = bestChannelInGuild;
      } else if (!targetChannelId) {
        // Fallback si todos los canales del servidor están vacíos
        const activeQueues = container.queueManager?.getQueues ? container.queueManager.getQueues() : null;
        const currentQueue = activeQueues?.get(targetGuildId);
        const currentCh = currentQueue?.getCurrentChannel();

        if (currentCh) {
          targetChannelId = currentCh;
        } else {
          for (const [, ch] of guild.channels.cache) {
            if (ch.isVoiceBased()) {
              targetChannelId = ch.id;
              break;
            }
          }
        }
      }
    }

    if (!targetChannelId) {
      reply.code(400).send({
        error: {
          code: 'NO_ACTIVE_VOICE_CHANNEL',
          message: 'No se encontró ningún canal de voz disponible en el servidor indicado.'
        }
      });
      return;
    }

    await container.playSoundFromWeb.execute({
      soundId: params.id,
      discordGuildId: targetGuildId,
      voiceChannelId: targetChannelId,
      webUserId: request.user!.id.toString()
    });

    await container.writeAuditEvent.execute({
      userId: request.user!.id.toString(),
      action: 'SOUND_QUICK_PLAYED',
      entityType: 'Sound',
      entityId: params.id,
      metadataJson: { guildId: targetGuildId, voiceChannelId: targetChannelId },
      ipAddress: request.ip
    });

    return {
      success: true,
      guildId: targetGuildId,
      voiceChannelId: targetChannelId
    };
  });
}
