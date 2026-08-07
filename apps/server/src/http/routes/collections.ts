import { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { randomUUID } from 'crypto';
import { AppContainer } from '../../composition-root/index.js';
import { AppError } from '@super-assistant/shared-kernel';

const CreateCollectionSchema = z.object({
  name: z.string().min(1).max(120),
  description: z.string().max(500).optional().nullable(),
  icon: z.string().optional().nullable(),
  colorTheme: z.enum(['emerald', 'cyan', 'pink', 'gold', 'red', 'violet', 'blue', 'orange']).default('cyan')
});

const UpdateSlotSchema = z.object({
  soundId: z.string().optional().nullable(),
  customLabel: z.string().max(120).optional().nullable(),
  customImageUrl: z.string().optional().nullable(),
  colorTheme: z.enum(['emerald', 'cyan', 'pink', 'gold', 'red', 'violet', 'blue', 'orange']).default('emerald')
});

const COLOR_THEMES = ['emerald', 'cyan', 'pink', 'gold', 'red', 'violet', 'blue', 'orange'];

const getRandomTheme = (idSeed?: string) => {
  if (idSeed) {
    let hash = 0;
    for (let i = 0; i < idSeed.length; i++) {
      hash = idSeed.charCodeAt(i) + ((hash << 5) - hash);
    }
    return COLOR_THEMES[Math.abs(hash) % COLOR_THEMES.length];
  }
  return COLOR_THEMES[Math.floor(Math.random() * COLOR_THEMES.length)];
};

export default async function collectionRoutes(fastify: FastifyInstance, options: { container: AppContainer }) {
  const { container } = options;

  fastify.addHook('preHandler', fastify.authenticate);

  // 1. Listar todas las colecciones (incluyendo las colecciones virtuales del sistema por defecto)
  fastify.get('/api/collections', async (request, reply) => {
    const userId = request.user!.id.toString();

    // A. Contar favoritos del usuario (máximo 20)
    const favs = await container.db
      .selectFrom('user_favorites as f')
      .innerJoin('sounds as s', 's.id', 'f.sound_id')
      .select(['s.id', 's.display_name'])
      .where('f.user_id', '=', userId)
      .where('s.deleted_at', 'is', null)
      .where('s.is_active', '=', 1)
      .execute();

    // B. Contar top 20 mas reproducidos de la plataforma
    const allSounds = await container.db
      .selectFrom('sounds')
      .select(['id', 'display_name'])
      .where('deleted_at', 'is', null)
      .where('is_active', '=', 1)
      .execute();

    // C. Contar ultimos sonidos añadidos (máximo 20)
    const recentSounds = await container.db
      .selectFrom('sounds')
      .select(['id'])
      .where('deleted_at', 'is', null)
      .where('is_active', '=', 1)
      .orderBy('created_at', 'desc')
      .limit(20)
      .execute();

    const favCount = Math.min(favs.length, 20);
    const top20Count = Math.min(allSounds.length, 20);
    const recentCount = recentSounds.length;

    const systemCollections = [
      {
        id: 'system-favorites',
        name: 'Mis Favoritos',
        description: 'Tus sonidos favoritos más escuchados.',
        icon: '/iconos/star.svg',
        colorTheme: getRandomTheme('sys-fav-' + userId),
        isSystem: true,
        createdBy: 'SYSTEM',
        configuredSlotsCount: favCount,
        totalSlots: 20,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      },
      {
        id: 'system-top20',
        name: 'Top 20 Más Reproducidos',
        description: 'Los 20 sonidos más escuchados de la plataforma.',
        icon: '/iconos/fire.svg',
        colorTheme: getRandomTheme('sys-top-' + allSounds.length),
        isSystem: true,
        createdBy: 'SYSTEM',
        configuredSlotsCount: top20Count,
        totalSlots: 20,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      },
      {
        id: 'system-recent',
        name: 'Últimos Añadidos',
        description: 'Los 20 sonidos más recientemente añadidos.',
        icon: '/iconos/sparkles.svg',
        colorTheme: getRandomTheme('sys-rec-' + recentCount),
        isSystem: true,
        createdBy: 'SYSTEM',
        configuredSlotsCount: recentCount,
        totalSlots: 20,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      }
    ];

    const collections = await container.db
      .selectFrom('sound_collections')
      .selectAll()
      .orderBy('created_at', 'desc')
      .execute();

    const counts = await container.db
      .selectFrom('sound_collection_items')
      .select(['collection_id', (container.db.fn as any).count('id').as('configured_count')])
      .groupBy('collection_id')
      .execute();

    const countMap = new Map<string, number>();
    counts.forEach((c: any) => countMap.set(c.collection_id, Number(c.configured_count)));

    const userCollections = collections.map((col: any) => ({
      id: col.id,
      name: col.name,
      description: col.description,
      icon: col.icon || '/iconos/sparkles.svg',
      colorTheme: col.color_theme || 'cyan',
      isSystem: false,
      createdBy: col.created_by,
      configuredSlotsCount: countMap.get(col.id) || 0,
      totalSlots: 20,
      createdAt: col.created_at,
      updatedAt: col.updated_at
    }));

    return [...systemCollections, ...userCollections];
  });

  // 2. Crear nueva colección (disponible para todos los usuarios)
  fastify.post('/api/collections', async (request, reply) => {
    const body = CreateCollectionSchema.parse(request.body);
    const collectionId = randomUUID();
    const now = new Date();

    await container.db
      .insertInto('sound_collections')
      .values({
        id: collectionId,
        name: body.name,
        description: body.description || null,
        icon: body.icon || '/iconos/sparkles.svg',
        color_theme: body.colorTheme || 'cyan',
        created_by: request.user!.id.toString(),
        created_at: now,
        updated_at: now
      })
      .execute();

    return {
      id: collectionId,
      name: body.name,
      description: body.description || null,
      icon: body.icon || '/iconos/sparkles.svg',
      createdAt: now
    };
  });

  // 3. Obtener detalle de colección + 20 slots de la mesa (disponible para todos los usuarios)
  fastify.get('/api/collections/:id', async (request, reply) => {
    const params = z.object({ id: z.string() }).parse(request.params);
    const userId = request.user!.id.toString();

    // A. Colección del sistema: Mis Favoritos
    if (params.id === 'system-favorites') {
      const favs = await container.db
        .selectFrom('user_favorites as f')
        .innerJoin('sounds as s', 's.id', 'f.sound_id')
        .select([
          's.id as soundId',
          's.display_name as soundDisplayName',
          's.command_name as soundCommandName',
          's.duration_ms as soundDurationMs',
          's.is_active as soundIsActive'
        ])
        .where('f.user_id', '=', userId)
        .where('s.deleted_at', 'is', null)
        .where('s.is_active', '=', 1)
        .execute();

      const favSoundIds = favs.map((f: any) => f.soundId);
      const playCountMap = new Map<string, number>();

      if (favSoundIds.length > 0) {
        const counts = await container.db
          .selectFrom('playback_events')
          .select(['sound_id', (container.db.fn as any).count('id').as('play_count')])
          .where('sound_id', 'in', favSoundIds)
          .groupBy('sound_id')
          .execute();

        counts.forEach((c: any) => {
          if (c.sound_id) playCountMap.set(c.sound_id, Number(c.play_count));
        });
      }

      favs.sort((a: any, b: any) => {
        const countA = playCountMap.get(a.soundId) || 0;
        const countB = playCountMap.get(b.soundId) || 0;
        if (countA !== countB) return countB - countA;
        return a.soundDisplayName.localeCompare(b.soundDisplayName);
      });

      const topFavs = favs.slice(0, 20);

      const slots = Array.from({ length: 20 }, (_, idx) => {
        const s = topFavs[idx];
        return {
          slotIndex: idx,
          itemId: s ? `sys-fav-${s.soundId}` : null,
          soundId: s ? s.soundId : null,
          soundDisplayName: s ? s.soundDisplayName : null,
          soundCommandName: s ? s.soundCommandName : null,
          soundDurationMs: s ? s.soundDurationMs : null,
          soundIsActive: s ? Boolean(s.soundIsActive) : true,
          customLabel: null,
          customImageUrl: null,
          colorTheme: 'gold'
        };
      });

      return {
        id: 'system-favorites',
        name: 'Mis Favoritos',
        description: 'Tus sonidos favoritos más escuchados.',
        icon: '/iconos/star.svg',
        colorTheme: 'gold',
        isSystem: true,
        createdBy: 'SYSTEM',
        configuredSlotsCount: topFavs.length,
        totalSlots: 20,
        slots
      };
    }

    // B. Colección del sistema: Top 20 Más Reproducidos
    if (params.id === 'system-top20') {
      const allSounds = await container.db
        .selectFrom('sounds')
        .select(['id', 'display_name', 'command_name', 'duration_ms', 'is_active'])
        .where('deleted_at', 'is', null)
        .where('is_active', '=', 1)
        .execute();

      const allIds = allSounds.map((s: any) => s.id);
      const playCountMap = new Map<string, number>();

      if (allIds.length > 0) {
        const counts = await container.db
          .selectFrom('playback_events')
          .select(['sound_id', (container.db.fn as any).count('id').as('play_count')])
          .where('sound_id', 'in', allIds)
          .groupBy('sound_id')
          .execute();

        counts.forEach((c: any) => {
          if (c.sound_id) playCountMap.set(c.sound_id, Number(c.play_count));
        });
      }

      allSounds.sort((a: any, b: any) => {
        const countA = playCountMap.get(a.id) || 0;
        const countB = playCountMap.get(b.id) || 0;
        if (countA !== countB) return countB - countA;
        return a.display_name.localeCompare(b.display_name);
      });

      const top20 = allSounds.slice(0, 20);

      const slots = Array.from({ length: 20 }, (_, idx) => {
        const s = top20[idx];
        return {
          slotIndex: idx,
          itemId: s ? `sys-top-${s.id}` : null,
          soundId: s ? s.id : null,
          soundDisplayName: s ? s.display_name : null,
          soundCommandName: s ? s.command_name : null,
          soundDurationMs: s ? s.duration_ms : null,
          soundIsActive: s ? Boolean(s.is_active) : true,
          customLabel: null,
          customImageUrl: null,
          colorTheme: 'pink'
        };
      });

      return {
        id: 'system-top20',
        name: 'Top 20 Más Reproducidos',
        description: 'Los 20 sonidos más escuchados de la plataforma.',
        icon: '/iconos/fire.svg',
        colorTheme: getRandomTheme('sys-top-' + allSounds.length),
        isSystem: true,
        createdBy: 'SYSTEM',
        configuredSlotsCount: top20.length,
        totalSlots: 20,
        slots
      };
    }

    // C. Colección del sistema: Últimos Añadidos
    if (params.id === 'system-recent') {
      const recentSounds = await container.db
        .selectFrom('sounds')
        .select(['id', 'display_name', 'command_name', 'duration_ms', 'is_active'])
        .where('deleted_at', 'is', null)
        .where('is_active', '=', 1)
        .orderBy('created_at', 'desc')
        .limit(20)
        .execute();

      const slots = Array.from({ length: 20 }, (_, idx) => {
        const s = recentSounds[idx];
        return {
          slotIndex: idx,
          itemId: s ? `sys-rec-${s.id}` : null,
          soundId: s ? s.id : null,
          soundDisplayName: s ? s.display_name : null,
          soundCommandName: s ? s.command_name : null,
          soundDurationMs: s ? s.duration_ms : null,
          soundIsActive: s ? Boolean(s.is_active) : true,
          customLabel: null,
          customImageUrl: null,
          colorTheme: 'cyan'
        };
      });

      return {
        id: 'system-recent',
        name: 'Últimos Añadidos',
        description: 'Los 20 sonidos más recientemente añadidos.',
        icon: '/iconos/sparkles.svg',
        colorTheme: getRandomTheme('sys-rec-' + recentSounds.length),
        isSystem: true,
        createdBy: 'SYSTEM',
        configuredSlotsCount: recentSounds.length,
        totalSlots: 20,
        slots
      };
    }

    const col = await container.db
      .selectFrom('sound_collections')
      .selectAll()
      .where('id', '=', params.id)
      .executeTakeFirst();

    if (!col) {
      throw new AppError('NOT_FOUND', 'La colección no existe.');
    }

    // Obtener items/slots guardados con info del sonido asignado
    const rawItems = await container.db
      .selectFrom('sound_collection_items as item')
      .leftJoin('sounds as s', 's.id', 'item.sound_id')
      .select([
        'item.id as itemId',
        'item.slot_index as slotIndex',
        'item.custom_label as customLabel',
        'item.custom_image_url as customImageUrl',
        'item.color_theme as colorTheme',
        's.id as soundId',
        's.display_name as soundDisplayName',
        's.command_name as soundCommandName',
        's.duration_ms as soundDurationMs',
        's.is_active as soundIsActive'
      ])
      .where('item.collection_id', '=', params.id)
      .execute();

    const itemsMap = new Map<number, any>();
    rawItems.forEach((i: any) => itemsMap.set(i.slotIndex, i));

    // Construir la matriz fija de 20 slots (0 a 19)
    const slots = Array.from({ length: 20 }, (_, idx) => {
      const existing = itemsMap.get(idx);
      return {
        slotIndex: idx,
        itemId: existing?.itemId || null,
        soundId: existing?.soundId || null,
        soundDisplayName: existing?.soundDisplayName || null,
        soundCommandName: existing?.soundCommandName || null,
        soundDurationMs: existing?.soundDurationMs || null,
        soundIsActive: existing?.soundIsActive !== undefined ? Boolean(existing.soundIsActive) : true,
        customLabel: existing?.customLabel || null,
        customImageUrl: existing?.customImageUrl || null,
        colorTheme: existing?.colorTheme || 'emerald'
      };
    });

    return {
      id: col.id,
      name: col.name,
      description: col.description,
      createdBy: col.created_by,
      createdAt: col.created_at,
      slots
    };
  });

  // 4. Configurar/Actualizar un slot específico de la mesa (disponible para todos los usuarios)
  fastify.put('/api/collections/:id/slots/:slotIndex', async (request, reply) => {
    const params = z.object({
      id: z.string(),
      slotIndex: z.coerce.number().min(0).max(19)
    }).parse(request.params);

    if (params.id.startsWith('system-')) {
      throw new AppError('AUTH_FORBIDDEN', 'No se pueden modificar las colecciones del sistema.');
    }

    const body = UpdateSlotSchema.parse(request.body);
    const now = new Date();

    // Verificar que exista la colección
    const col = await container.db
      .selectFrom('sound_collections')
      .select('id')
      .where('id', '=', params.id)
      .executeTakeFirst();

    if (!col) {
      throw new AppError('NOT_FOUND', 'La colección no existe.');
    }

    // Comprobar si ya hay un item registrado para este slot
    const existing = await container.db
      .selectFrom('sound_collection_items')
      .select('id')
      .where('collection_id', '=', params.id)
      .where('slot_index', '=', params.slotIndex)
      .executeTakeFirst();

    if (existing) {
      await container.db
        .updateTable('sound_collection_items')
        .set({
          sound_id: body.soundId || null,
          custom_label: body.customLabel || null,
          custom_image_url: body.customImageUrl || null,
          color_theme: body.colorTheme,
          updated_at: now
        })
        .where('id', '=', existing.id)
        .execute();
    } else {
      await container.db
        .insertInto('sound_collection_items')
        .values({
          id: randomUUID(),
          collection_id: params.id,
          sound_id: body.soundId || null,
          slot_index: params.slotIndex,
          custom_label: body.customLabel || null,
          custom_image_url: body.customImageUrl || null,
          color_theme: body.colorTheme,
          created_at: now,
          updated_at: now
        })
        .execute();
    }

    return { success: true };
  });

  // 5. Vaciar un slot (disponible para todos los usuarios)
  fastify.delete('/api/collections/:id/slots/:slotIndex', async (request, reply) => {
    const params = z.object({
      id: z.string(),
      slotIndex: z.coerce.number().min(0).max(19)
    }).parse(request.params);

    if (params.id.startsWith('system-')) {
      throw new AppError('AUTH_FORBIDDEN', 'No se pueden vaciar los botones de las colecciones del sistema.');
    }

    await container.db
      .deleteFrom('sound_collection_items')
      .where('collection_id', '=', params.id)
      .where('slot_index', '=', params.slotIndex)
      .execute();

    return { success: true };
  });

  // 6. Actualizar datos de colección (nombre, descripción, icono)
  fastify.patch('/api/collections/:id', async (request, reply) => {
    const params = z.object({ id: z.string() }).parse(request.params);
    
    if (params.id.startsWith('system-')) {
      throw new AppError('AUTH_FORBIDDEN', 'No se pueden editar las colecciones del sistema.');
    }

    const body = z.object({
      name: z.string().min(1).max(120).optional(),
      description: z.string().max(500).optional().nullable(),
      icon: z.string().optional().nullable(),
      colorTheme: z.enum(['emerald', 'cyan', 'pink', 'gold', 'red', 'violet', 'blue', 'orange']).optional()
    }).parse(request.body);

    const now = new Date();
    const updatePayload: Record<string, any> = { updated_at: now };
    if (body.name !== undefined) updatePayload.name = body.name;
    if (body.description !== undefined) updatePayload.description = body.description;
    if (body.icon !== undefined) updatePayload.icon = body.icon;
    if (body.colorTheme !== undefined) updatePayload.color_theme = body.colorTheme;

    await container.db
      .updateTable('sound_collections')
      .set(updatePayload)
      .where('id', '=', params.id)
      .execute();

    return { success: true };
  });

  // 7. Eliminar colección completa (disponible para todos los usuarios)
  fastify.delete('/api/collections/:id', async (request, reply) => {
    const params = z.object({ id: z.string() }).parse(request.params);

    if (params.id.startsWith('system-')) {
      throw new AppError('AUTH_FORBIDDEN', 'No se pueden eliminar las colecciones del sistema.');
    }

    await container.db
      .deleteFrom('sound_collections')
      .where('id', '=', params.id)
      .execute();

    return { success: true };
  });
}
