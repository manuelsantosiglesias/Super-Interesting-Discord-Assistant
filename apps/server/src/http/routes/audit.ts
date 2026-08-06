import { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { AppContainer } from '../../composition-root/index.js';

const AuditQuerySchema = z.object({
  userId: z.string().optional(),
  action: z.string().optional(),
  entityType: z.string().optional(),
  from: z.preprocess((val) => val ? new Date(String(val)) : undefined, z.date().optional()),
  to: z.preprocess((val) => val ? new Date(String(val)) : undefined, z.date().optional()),
  page: z.coerce.number().min(1).default(1),
  pageSize: z.coerce.number().min(1).max(100).default(20)
});

export default async function auditRoutes(fastify: FastifyInstance, options: { container: AppContainer }) {
  const { container } = options;

  fastify.addHook('preHandler', fastify.authenticate);
  fastify.addHook('preHandler', fastify.requireAdmin);

  fastify.get('/api/audit-log', async (request, reply) => {
    const query = AuditQuerySchema.parse(request.query);
    const result = await container.listAuditEvents.execute(query);

    return {
      items: result.items.map((e) => ({
        id: e.id,
        userId: e.userId,
        action: e.action,
        entityType: e.entityType,
        entityId: e.entityId,
        metadataJson: e.metadataJson,
        createdAt: e.createdAt
      })),
      pagination: result.pagination
    };
  });
}
