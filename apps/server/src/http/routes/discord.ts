import { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { AppContainer } from '../../composition-root/index.js';
import { ChannelType } from 'discord.js';

const GuildUpdateSchema = z.object({
  commandPrefix: z.string().min(1).max(20).optional(),
  defaultVolume: z.coerce.number().min(0.0).max(2.0).optional(),
  leaveAfterSeconds: z.coerce.number().min(0).optional(),
  maxQueueSize: z.coerce.number().min(1).max(50).optional(),
  userCooldownSeconds: z.coerce.number().min(0).optional(),
  isEnabled: z.preprocess((val) => val === 'true' || val === '1' || val === true, z.boolean()).optional(),
  allowedTextChannelIds: z.array(z.string()).optional()
});

export default async function discordRoutes(fastify: FastifyInstance, options: { container: AppContainer }) {
  const { container } = options;

  fastify.addHook('preHandler', fastify.authenticate);

  fastify.get('/api/discord/status', async (request, reply) => {
    const client = container.discordBot;
    if (!client) {
      return { connected: false, botName: null, avatar: null, clientId: null };
    }
    return {
      connected: !!client.readyAt,
      botName: client.user?.username || null,
      avatar: client.user?.displayAvatarURL() || null,
      clientId: container.config.discord.application_id || null,
      guildsCount: client.guilds.cache.size
    };
  });

  fastify.get('/api/discord/install-url', async (request, reply) => {
    const url = container.generateInstallUrl.execute();
    return { url };
  });

  fastify.get('/api/discord/guilds', async (request, reply) => {
    const list = await container.listGuilds.execute();
    const client = container.discordBot;

    return list.map((g) => {
      const activeGuild = client?.guilds.cache.get(g.discordGuildId);
      return {
        id: g.id.toString(),
        discordGuildId: g.discordGuildId,
        guildName: activeGuild?.name || g.guildName,
        guildIcon: activeGuild?.iconURL() || null,
        commandPrefix: g.commandPrefix,
        defaultVolume: g.defaultVolume,
        leaveAfterSeconds: g.leaveAfterSeconds,
        isEnabled: g.isEnabled,
        installedAt: g.installedAt
      };
    });
  });

  fastify.get('/api/discord/guilds/:id', async (request, reply) => {
    const params = z.object({ id: z.string() }).parse(request.params);
    const guild = await container.getGuild.execute(params.id);
    const client = container.discordBot;
    const activeGuild = client?.guilds.cache.get(guild.discordGuildId);

    return {
      id: guild.id.toString(),
      discordGuildId: guild.discordGuildId,
      guildName: activeGuild?.name || guild.guildName,
      guildIcon: activeGuild?.iconURL() || null,
      commandPrefix: guild.commandPrefix,
      defaultVolume: guild.defaultVolume,
      leaveAfterSeconds: guild.leaveAfterSeconds,
      maxQueueSize: guild.maxQueueSize,
      userCooldownSeconds: guild.userCooldownSeconds,
      isEnabled: guild.isEnabled,
      allowedTextChannelIds: guild.allowedTextChannelIds
    };
  });

  fastify.patch('/api/discord/guilds/:id', async (request, reply) => {
    const params = z.object({ id: z.string() }).parse(request.params);
    const body = GuildUpdateSchema.parse(request.body);

    const guild = await container.updateGuildConfiguration.execute(params.id, {
      commandPrefix: body.commandPrefix,
      defaultVolume: body.defaultVolume,
      leaveAfterSeconds: body.leaveAfterSeconds,
      maxQueueSize: body.maxQueueSize,
      userCooldownSeconds: body.userCooldownSeconds,
      isEnabled: body.isEnabled,
      allowedTextChannelIds: body.allowedTextChannelIds
    });

    await container.writeAuditEvent.execute({
      userId: request.user!.id.toString(),
      action: 'GUILD_CONFIGURATION_UPDATED',
      entityType: 'Guild',
      entityId: guild.id.toString(),
      metadataJson: body,
      ipAddress: request.ip
    });

    return { success: true };
  });

  fastify.get('/api/discord/guilds/:id/channels', async (request, reply) => {
    const params = z.object({ id: z.string() }).parse(request.params);
    const guild = await container.getGuild.execute(params.id);
    const client = container.discordBot;
    
    if (!client || !client.readyAt) {
      return { textChannels: [], voiceChannels: [] };
    }

    const activeGuild = client.guilds.cache.get(guild.discordGuildId);
    if (!activeGuild) {
      return { textChannels: [], voiceChannels: [] };
    }

    const textChannels = activeGuild.channels.cache
      .filter((c: any) => c.type === ChannelType.GuildText)
      .map((c: any) => ({ id: c.id, name: c.name }));

    const voiceChannels = activeGuild.channels.cache
      .filter((c: any) => c.type === ChannelType.GuildVoice || c.type === ChannelType.GuildStageVoice)
      .map((c: any) => ({
        id: c.id,
        name: c.name,
        userCount: c.members?.filter((m: any) => !m.user.bot).size || 0
      }));

    return { textChannels, voiceChannels };
  });

  fastify.post('/api/discord/register-commands', async (request, reply) => {
    const { registerSlashCommands } = await import('@super-assistant/discord-integration');
    const simpleLogger = {
      info: (msg: string) => container.logger.info(msg),
      error: (msg: string, err: any) => container.logger.error(msg, err)
    };
    
    await registerSlashCommands(container.config, simpleLogger);

    await container.writeAuditEvent.execute({
      userId: request.user!.id.toString(),
      action: 'DISCORD_COMMANDS_REGISTERED',
      ipAddress: request.ip
    });

    return { success: true };
  });

  fastify.post('/api/discord/reconnect', async (request, reply) => {
    const client = container.discordBot;
    if (!client) {
      reply.code(400).send({ error: { code: 'DISCORD_NOT_CONFIGURED', message: 'Discord no está configurado.' } });
      return;
    }

    try {
      client.destroy();
      await client.login(container.config.discord.bot_token);
      
      await container.writeAuditEvent.execute({
        userId: request.user!.id.toString(),
        action: 'DISCORD_BOT_RECONNECTED',
        ipAddress: request.ip
      });

      return { success: true };
    } catch (err: any) {
      reply.code(500).send({ error: { code: 'DISCORD_RECONNECT_FAILED', message: err.message } });
    }
  });
}
