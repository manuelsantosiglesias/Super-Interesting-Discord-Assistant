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

export default async function collectionRoutes(fastify: FastifyInstance, options: { container: AppContainer }) {
  const { container } = options;

  fastify.addHook('preHandler', fastify.authenticate);

  // 1. Listar todas las colecciones (disponible para todos los usuarios)
  fastify.get('/api/collections', async (request, reply) => {
    const collections = await container.db
      .selectFrom('sound_collections')
      .selectAll()
      .orderBy('created_at', 'desc')
      .execute();

    // Contar slots configurados por colección
    const counts = await container.db
      .selectFrom('sound_collection_items')
      .select(['collection_id', (container.db.fn as any).count('id').as('configured_count')])
      .groupBy('collection_id')
      .execute();

    const countMap = new Map<string, number>();
    counts.forEach((c: any) => countMap.set(c.collection_id, Number(c.configured_count)));

    return collections.map((col: any) => ({
      id: col.id,
      name: col.name,
      description: col.description,
      icon: col.icon || '/iconos/sparkles.svg',
      colorTheme: col.color_theme || 'cyan',
      createdBy: col.created_by,
      configuredSlotsCount: countMap.get(col.id) || 0,
      totalSlots: 20,
      createdAt: col.created_at,
      updatedAt: col.updated_at
    }));
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
    await container.db
      .deleteFrom('sound_collections')
      .where('id', '=', params.id)
      .execute();

    return { success: true };
  });
}
