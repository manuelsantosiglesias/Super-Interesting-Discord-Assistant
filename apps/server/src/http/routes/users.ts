import { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { AppContainer } from '../../composition-root/index.js';

const UserCreateSchema = z.object({
  username: z.string(),
  password: z.string(),
  role: z.enum(['ADMIN', 'USER'])
});

const ResetPasswordSchema = z.object({
  newPassword: z.string()
});

const QuerySchema = z.object({
  page: z.coerce.number().min(1).default(1),
  pageSize: z.coerce.number().min(1).max(100).default(20)
});

export default async function userRoutes(fastify: FastifyInstance, options: { container: AppContainer }) {
  const { container } = options;

  fastify.addHook('preHandler', fastify.authenticate);
  fastify.addHook('preHandler', fastify.requireAdmin);

  fastify.get('/api/users', async (request, reply) => {
    const query = QuerySchema.parse(request.query);
    const result = await container.listUsers.execute({
      page: query.page,
      pageSize: query.pageSize
    });

    return {
      items: result.items.map((u) => ({
        id: u.id.toString(),
        username: u.username,
        role: u.role,
        isActive: u.isActive,
        mustChangePassword: u.mustChangePassword,
        failedLoginAttempts: u.failedLoginAttempts,
        lockedUntil: u.lockedUntil,
        lastLoginAt: u.lastLoginAt,
        createdAt: u.createdAt,
        updatedAt: u.updatedAt
      })),
      pagination: result.pagination
    };
  });

  fastify.get('/api/users/:id', async (request, reply) => {
    const params = z.object({ id: z.string() }).parse(request.params);
    const user = await container.db.selectFrom('users').selectAll().where('id', '=', params.id).executeTakeFirst();
    if (!user) {
      reply.code(404).send({ error: { code: 'USER_NOT_FOUND', message: 'Usuario no encontrado.' } });
      return;
    }

    return {
      id: user.id,
      username: user.username,
      role: user.role,
      isActive: Boolean(user.is_active),
      mustChangePassword: Boolean(user.must_change_password),
      lastLoginAt: user.last_login_at,
      createdAt: user.created_at,
      updatedAt: user.updated_at
    };
  });

  fastify.post('/api/users', async (request, reply) => {
    const body = UserCreateSchema.parse(request.body);
    const user = await container.createUser.execute({
      username: body.username,
      password: body.password,
      role: body.role
    });

    await container.writeAuditEvent.execute({
      userId: request.user!.id.toString(),
      action: 'USER_CREATED',
      entityType: 'User',
      entityId: user.id.toString(),
      metadataJson: { username: user.username, role: user.role },
      ipAddress: request.ip
    });

    reply.code(201).send({
      id: user.id.toString(),
      username: user.username,
      role: user.role
    });
  });

  fastify.post('/api/users/:id/disable', async (request, reply) => {
    const params = z.object({ id: z.string() }).parse(request.params);
    
    if (params.id === request.user!.id.toString()) {
      reply.code(400).send({ error: { code: 'USER_CANNOT_DISABLE_SELF', message: 'No puedes desactivar tu propio usuario.' } });
      return;
    }

    await container.disableUser.execute(params.id);

    await container.writeAuditEvent.execute({
      userId: request.user!.id.toString(),
      action: 'USER_DISABLED',
      entityType: 'User',
      entityId: params.id,
      ipAddress: request.ip
    });

    return { success: true };
  });

  fastify.post('/api/users/:id/enable', async (request, reply) => {
    const params = z.object({ id: z.string() }).parse(request.params);
    await container.enableUser.execute(params.id);

    await container.writeAuditEvent.execute({
      userId: request.user!.id.toString(),
      action: 'USER_ENABLED',
      entityType: 'User',
      entityId: params.id,
      ipAddress: request.ip
    });

    return { success: true };
  });

  fastify.post('/api/users/:id/reset-password', async (request, reply) => {
    const params = z.object({ id: z.string() }).parse(request.params);
    const body = ResetPasswordSchema.parse(request.body);

    await container.resetUserPassword.execute({
      userId: params.id,
      newPassword: body.newPassword
    });

    await container.writeAuditEvent.execute({
      userId: request.user!.id.toString(),
      action: 'USER_RESET_PASSWORD',
      entityType: 'User',
      entityId: params.id,
      ipAddress: request.ip
    });

    return { success: true };
  });
}
