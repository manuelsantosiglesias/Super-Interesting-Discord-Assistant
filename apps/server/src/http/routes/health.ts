import { FastifyInstance } from 'fastify';
import { AppContainer } from '../../composition-root/index.js';

export default async function healthRoutes(fastify: FastifyInstance, options: { container: AppContainer }) {
  const { container } = options;

  fastify.get('/health', async (request, reply) => {
    return {
      status: 'OK',
      timestamp: new Date(),
      uptime: process.uptime()
    };
  });

  fastify.get('/ready', async (request, reply) => {
    try {
      await container.db.selectFrom('users').select('id').limit(1).execute();
    } catch (err: any) {
      reply.code(503).send({ status: 'ERROR', database: 'UNAVAILABLE', error: err.message });
      return;
    }

    let discordStatus = 'disabled';
    if (container.config.discord.bot_token) {
      discordStatus = container.discordBot?.readyAt ? 'connected' : 'disconnected';
    }

    return {
      status: 'READY',
      database: 'OK',
      discord: discordStatus,
      timestamp: new Date()
    };
  });
}
