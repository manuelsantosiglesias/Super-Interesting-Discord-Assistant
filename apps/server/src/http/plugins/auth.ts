import { FastifyPluginAsync } from 'fastify';
import fp from 'fastify-plugin';
import { AppContainer } from '../../composition-root/index.js';
import { User } from '@super-assistant/identity';

declare module 'fastify' {
  interface FastifyRequest {
    user?: User;
    sessionId?: string;
  }
  interface FastifyInstance {
    authenticate: (request: any, reply: any) => Promise<void>;
    requireAdmin: (request: any, reply: any) => Promise<void>;
  }
}

const authPlugin: FastifyPluginAsync<{ container: AppContainer }> = async (fastify, options) => {
  const { container } = options;

  fastify.decorate('authenticate', async (request, reply) => {
    const sessionCookieName = 'super_interesting_discord_assistant_session';
    const sessionId = request.cookies[sessionCookieName];

    if (!sessionId) {
      reply.code(401).send({
        error: {
          code: 'AUTH_SESSION_EXPIRED',
          message: 'No se inició sesión o la sesión ha expirado.'
        }
      });
      return;
    }

    try {
      const ip = request.ip;
      const user = await container.getCurrentUser.execute(sessionId, ip);
      
      request.user = user;
      request.sessionId = sessionId;
    } catch (err: any) {
      reply.clearCookie(sessionCookieName, { path: '/' });
      reply.code(401).send({
        error: {
          code: err.code || 'AUTH_UNAUTHORIZED',
          message: err.message || 'No autorizado.'
        }
      });
    }
  });

  fastify.decorate('requireAdmin', async (request, reply) => {
    if (!request.user || request.user.role !== 'ADMIN') {
      reply.code(403).send({
        error: {
          code: 'AUTH_FORBIDDEN',
          message: 'No tienes permisos para realizar esta acción.'
        }
      });
    }
  });
};

export default fp(authPlugin);
