import Fastify from 'fastify';
import { randomUUID } from 'crypto';
import cookie from '@fastify/cookie';
import helmet from '@fastify/helmet';
import multipart from '@fastify/multipart';
import rateLimit from '@fastify/rate-limit';
import swagger from '@fastify/swagger';
import swaggerUi from '@fastify/swagger-ui';
import { buildContainer } from './composition-root/index.js';
import { closeDbConnection } from './db/connection.js';
import authPlugin from './http/plugins/auth.js';
import healthRoutes from './http/routes/health.js';
import authRoutes from './http/routes/auth.js';
import userRoutes from './http/routes/users.js';
import soundRoutes from './http/routes/sounds.js';
import discordRoutes from './http/routes/discord.js';
import auditRoutes from './http/routes/audit.js';
import collectionRoutes from './http/routes/collections.js';
import { AppError } from '@super-assistant/shared-kernel';

async function startServer() {
  const container = buildContainer();
  const config = container.config;
  const logger = container.logger;

  const fastify = Fastify({
    logger: false, // Usamos pino a nivel de aplicación manualmente o inyectado
    disableRequestLogging: true
  });

  // 1. Configurar Cabeceras de Seguridad (Helmet)
  await fastify.register(helmet, {
    contentSecurityPolicy: config.app.environment === 'production',
    crossOriginEmbedderPolicy: config.app.environment === 'production'
  });

  // 2. Configurar Cookies
  await fastify.register(cookie);

  // 3. Configurar Rate Limit
  await fastify.register(rateLimit, {
    max: 100,
    timeWindow: '1 minute',
    errorResponseBuilder: (req, context) => ({
      error: {
        code: 'RATE_LIMIT_EXCEEDED',
        message: 'Demasiadas peticiones realizadas. Inténtalo de nuevo más tarde.',
        timeWindow: context.after
      }
    })
  });

  // 4. Configurar Multipart (Subida de audios en streaming)
  const maxSizeBytes = config.app.max_audio_size_mb * 1024 * 1024;
  await fastify.register(multipart, {
    limits: {
      files: 1,
      fileSize: maxSizeBytes
    }
  });

  // 5. Configurar Swagger (Documentación OpenAPI) en /docs
  if (config.app.environment !== 'production') {
    await fastify.register(swagger, {
      swagger: {
        info: {
          title: 'Super Interesting Discord Assistant API',
          description: 'Documentación del panel de gestión de sonidos y del bot de Discord',
          version: '1.0.0'
        },
        host: `${config.app.host}:${config.app.port}`,
        schemes: ['http'],
        consumes: ['application/json', 'multipart/form-data'],
        produces: ['application/json']
      }
    });

    await fastify.register(swaggerUi, {
      routePrefix: '/docs',
      uiConfig: {
        docExpansion: 'list',
        deepLinking: false
      }
    });
  }

  // 6. Registrar Plugin de Autenticación
  await fastify.register(authPlugin, { container });

  // 7. Configurar Gestor de Errores Global
  fastify.setErrorHandler((error, request, reply) => {
    const requestId = request.id;
    logger.error('Error detectado en petición HTTP:', { err: error, requestId });

    if (error instanceof AppError) {
      reply.code(error.statusCode).send({
        error: {
          code: error.code,
          message: error.message,
          requestId
        }
      });
      return;
    }

    if (error.validation) {
      reply.code(400).send({
        error: {
          code: 'VALIDATION_ERROR',
          message: error.message,
          requestId
        }
      });
      return;
    }

    const isProd = config.app.environment === 'production';
    reply.code(error.statusCode || 500).send({
      error: {
        code: 'INTERNAL_ERROR',
        message: isProd ? 'Ocurrió un error interno del servidor.' : error.message,
        requestId
      }
    });
  });

  // 8. Inyectar RequestId en logs
  fastify.addHook('onRequest', async (request, reply) => {
    // Generar o propagar requestId
    const requestId = request.headers['x-request-id'] || randomUUID();
    request.id = String(requestId);
    reply.header('x-request-id', requestId);
    
    logger.info(`HTTP ${request.method} ${request.url} - Iniciado`, { requestId, ip: request.ip });
  });

  fastify.addHook('onResponse', async (request, reply) => {
    logger.info(`HTTP ${request.method} ${request.url} - Finalizado - Status: ${reply.statusCode} - ${reply.elapsedTime.toFixed(2)}ms`, {
      requestId: request.id
    });
  });

  // 9. Registrar Rutas
  await fastify.register(healthRoutes, { container });
  await fastify.register(authRoutes, { container });
  await fastify.register(userRoutes, { container });
  await fastify.register(soundRoutes, { container });
  await fastify.register(discordRoutes, { container });
  await fastify.register(auditRoutes, { container });
  await fastify.register(collectionRoutes, { container });

  // 10. Conectar Bot de Discord
  if (container.discordBot) {
    try {
      logger.info('Conectando cliente del bot de Discord...');
      await container.discordBot.login(config.discord.bot_token);
    } catch (err) {
      logger.error('Error al arrancar el bot de Discord. Continuando ejecución de API.', err);
    }
  }

  // 11. Escuchar peticiones HTTP
  try {
    await fastify.listen({ port: config.app.port, host: config.app.host });
    logger.info(`Servidor API HTTP escuchando en http://${config.app.host}:${config.app.port}`);
    if (config.app.environment !== 'production') {
      logger.info(`Documentación Swagger disponible en http://${config.app.host}:${config.app.port}/docs`);
    }
  } catch (err) {
    logger.error('Error al iniciar el servidor Fastify:', err);
    process.exit(1);
  }

  // 12. Manejo de Graceful Shutdown (Apagado Controlado)
  const shutdown = async (signal: string) => {
    logger.info(`Se ha recibido señal ${signal}. Iniciando apagado ordenado...`);
    
    // Detener Fastify
    try {
      logger.info('Cerrando servidor HTTP...');
      await fastify.close();
      logger.info('Servidor HTTP cerrado.');
    } catch (err) {
      logger.error('Error al cerrar Fastify:', err);
    }

    // Apagar colas de audio de Discord
    try {
      logger.info('Deteniendo y limpiando colas de reproducción de Discord...');
      container.queueManager.shutdown();
    } catch (err) {
      logger.error('Error al detener colas de voz:', err);
    }

    // Detener cliente de Discord
    if (container.discordBot) {
      try {
        logger.info('Desconectando bot de Discord...');
        container.discordBot.destroy();
        logger.info('Bot de Discord desconectado.');
      } catch (err) {
        logger.error('Error al desconectar bot de Discord:', err);
      }
    }

    // Cerrar base de datos
    try {
      logger.info('Cerrando pool de conexiones MySQL...');
      await closeDbConnection();
      logger.info('Pool MySQL cerrado.');
    } catch (err) {
      logger.error('Error al cerrar pool MySQL:', err);
    }

    logger.info('Apagado completado de forma segura.');
    process.exit(0);
  };

  process.on('SIGINT', () => shutdown('SIGINT'));
  process.on('SIGTERM', () => shutdown('SIGTERM'));

  process.on('uncaughtException', (err) => {
    logger.error('Excepción no capturada (uncaughtException):', err);
    shutdown('UNCAUGHT_EXCEPTION');
  });

  process.on('unhandledRejection', (reason, promise) => {
    logger.error('Promesa no capturada (unhandledRejection):', { reason, promise });
    shutdown('UNHANDLED_REJECTION');
  });
}

startServer();
