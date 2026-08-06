import { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { AppContainer } from '../../composition-root/index.js';

const LoginSchema = z.object({
  username: z.string(),
  password: z.string()
});

const ChangePasswordSchema = z.object({
  currentPassword: z.string(),
  newPassword: z.string()
});

export default async function authRoutes(fastify: FastifyInstance, options: { container: AppContainer }) {
  const { container } = options;

  fastify.post('/api/auth/login', async (request, reply) => {
    const body = LoginSchema.parse(request.body);
    
    try {
      const { session, user } = await container.loginUser.execute({
        username: body.username,
        password: body.password,
        ipAddress: request.ip,
        userAgent: request.headers['user-agent'] || null
      });

      await container.writeAuditEvent.execute({
        userId: user.id.toString(),
        action: 'USER_LOGIN_SUCCESS',
        ipAddress: request.ip,
        metadataJson: { userAgent: request.headers['user-agent'] || null }
      });

      const sessionCookieName = 'super_interesting_discord_assistant_session';
      reply.setCookie(sessionCookieName, session.id.toString(), {
        path: '/',
        httpOnly: true,
        sameSite: 'strict',
        secure: container.config.security.secure_cookies,
        maxAge: container.config.security.session_duration_hours * 60 * 60
      });

      return {
        id: user.id.toString(),
        username: user.username,
        role: user.role,
        mustChangePassword: user.mustChangePassword
      };
    } catch (err: any) {
      let userId: string | null = null;
      try {
        const u = await container.db.selectFrom('users').select('id').where('username', '=', body.username.trim().toLowerCase()).executeTakeFirst();
        userId = u?.id || null;
      } catch {}

      await container.writeAuditEvent.execute({
        userId,
        action: 'USER_LOGIN_FAILED',
        ipAddress: request.ip,
        metadataJson: { 
          username: body.username, 
          reason: err.message || 'Credenciales inválidas' 
        }
      });

      throw err;
    }
  });

  fastify.post('/api/auth/logout', { preHandler: [fastify.authenticate] }, async (request, reply) => {
    await container.logoutUser.execute(request.sessionId!);
    
    await container.writeAuditEvent.execute({
      userId: request.user!.id.toString(),
      action: 'USER_LOGOUT',
      ipAddress: request.ip
    });

    reply.clearCookie('super_interesting_discord_assistant_session', { path: '/' });
    return { success: true };
  });

  fastify.get('/api/auth/me', { preHandler: [fastify.authenticate] }, async (request, reply) => {
    const user = request.user!;
    return {
      id: user.id.toString(),
      username: user.username,
      role: user.role,
      mustChangePassword: user.mustChangePassword
    };
  });

  fastify.post('/api/auth/change-password', { preHandler: [fastify.authenticate] }, async (request, reply) => {
    const body = ChangePasswordSchema.parse(request.body);
    const user = request.user!;

    await container.changePassword.execute({
      userId: user.id.toString(),
      currentPassword: body.currentPassword,
      newPassword: body.newPassword
    });

    await container.writeAuditEvent.execute({
      userId: user.id.toString(),
      action: 'USER_CHANGE_PASSWORD',
      ipAddress: request.ip
    });

    reply.clearCookie('super_interesting_discord_assistant_session', { path: '/' });
    return { success: true };
  });
}
