import { 
  Client, 
  GatewayIntentBits, 
  Events, 
  REST, 
  Routes, 
  PermissionsBitField,
  ChatInputCommandInteraction
} from 'discord.js';
import { Config } from '@super-assistant/config';
import { RegisterGuild, MarkGuildDisconnected } from '@super-assistant/guild-management';
import { SoundRepository } from '@super-assistant/soundboard';
import { HandlePrefixSoundCommand, HandleSlashSoundCommand } from '../application/index.js';
import { PlaybackQueueManager } from './voice-queue.js';

export interface BotClientDeps {
  config: Config;
  registerGuild: RegisterGuild;
  markGuildDisconnected: MarkGuildDisconnected;
  handlePrefix: HandlePrefixSoundCommand;
  handleSlash: HandleSlashSoundCommand;
  soundRepo: SoundRepository;
  queueManager: PlaybackQueueManager;
  logger: {
    info: (msg: string, details?: any) => void;
    error: (msg: string, details?: any) => void;
  };
}

export function createDiscordBot(deps: BotClientDeps): Client {
  const client = new Client({
    intents: [
      GatewayIntentBits.Guilds,
      GatewayIntentBits.GuildVoiceStates,
      GatewayIntentBits.GuildMembers,
      GatewayIntentBits.GuildMessages,
      GatewayIntentBits.MessageContent
    ]
  });

  // Guardar instancia en global para acceder desde la cola de voz
  (global as any).discordClient = client;

  client.on(Events.ClientReady, () => {
    deps.logger.info(`Bot conectado como ${client.user?.tag}`);
    
    // Opcional: Registrar comandos al arrancar si está configurado
    if (deps.config.discord.register_slash_commands_on_start) {
      registerSlashCommands(deps.config, deps.logger).catch((err) => {
        deps.logger.error('Error al autoregistrar comandos slash al arranque', err);
      });
    }
  });

  // Evento: Al ser invitado a un servidor
  client.on(Events.GuildCreate, async (guild) => {
    deps.logger.info(`Bot añadido al servidor: ${guild.name} (${guild.id})`);
    try {
      await deps.registerGuild.execute({
        discordGuildId: guild.id,
        guildName: guild.name
      });
    } catch (err) {
      deps.logger.error(`Error al registrar servidor ${guild.id}`, err);
    }
  });

  // Evento: Al ser expulsado de un servidor
  client.on(Events.GuildDelete, async (guild) => {
    deps.logger.info(`Bot expulsado del servidor: ${guild.name} (${guild.id})`);
    try {
      await deps.markGuildDisconnected.execute(guild.id);
      // Limpiar colas activas
      deps.queueManager.getOrCreateQueue(guild.id).disconnect();
    } catch (err) {
      deps.logger.error(`Error al marcar servidor desactivado ${guild.id}`, err);
    }
  });

  // Evento: Mensaje escrito (Prefix commands)
  client.on(Events.MessageCreate, async (message) => {
    if (message.author.bot || !message.guild) return;

    const userChannel = message.member?.voice.channelId || null;
    
    // Determinar permisos del bot en el canal de voz del usuario
    let botHasPermissions = false;
    if (userChannel) {
      const channel = message.guild.channels.cache.get(userChannel);
      if (channel && channel.isVoiceBased()) {
        const perms = channel.permissionsFor(client.user!);
        botHasPermissions = !!perms?.has([
          PermissionsBitField.Flags.Connect,
          PermissionsBitField.Flags.Speak
        ]);
      }
    }

    try {
      const result = await deps.handlePrefix.execute({
        discordGuildId: message.guild.id,
        textChannelId: message.channelId,
        authorId: message.author.id,
        authorIsBot: false,
        content: message.content,
        userVoiceChannelId: userChannel,
        botHasVoicePermissions: botHasPermissions
      });

      if (result) {
        await message.reply(result.reply);
      }
    } catch (err: any) {
      deps.logger.error('Error al manejar comando de prefijo', err);
    }
  });

  // Evento: Interacción (Slash commands + Autocomplete)
  client.on(Events.InteractionCreate, async (interaction) => {
    if (interaction.isChatInputCommand()) {
      if (interaction.commandName !== 'sbdb') return;

      const soundCommand = interaction.options.getString('sonido', true);
      const userChannel = (interaction.member as any)?.voice?.channelId || null;
      
      let botHasPermissions = false;
      if (userChannel && interaction.guild) {
        const channel = interaction.guild.channels.cache.get(userChannel);
        if (channel && channel.isVoiceBased()) {
          const perms = channel.permissionsFor(client.user!);
          botHasPermissions = !!perms?.has([
            PermissionsBitField.Flags.Connect,
            PermissionsBitField.Flags.Speak
          ]);
        }
      }

      await interaction.deferReply();

      try {
        const result = await deps.handleSlash.execute({
          discordGuildId: interaction.guildId!,
          textChannelId: interaction.channelId,
          authorId: interaction.user.id,
          commandName: soundCommand,
          userVoiceChannelId: userChannel,
          botHasVoicePermissions: botHasPermissions
        });

        await interaction.editReply(result.reply);
      } catch (err: any) {
        deps.logger.error('Error al manejar comando slash', err);
        await interaction.editReply('Ocurrió un error al procesar el sonido.');
      }
    }

    // Autocompletado de comandos de sonidos
    if (interaction.isAutocomplete()) {
      if (interaction.commandName !== 'sbdb') return;

      try {
        const focusedValue = interaction.options.getFocused();
        const activeSounds = await deps.soundRepo.list({
          search: focusedValue || undefined,
          active: true,
          page: 1,
          pageSize: 25
        });

        await interaction.respond(
          activeSounds.items.map((s) => ({
            name: `${s.displayName} (${s.commandName.toValue()})`,
            value: s.commandName.toValue()
          }))
        );
      } catch (err) {
        // Enviar respuesta vacía si falla la consulta
        await interaction.respond([]).catch(() => {});
      }
    }
  });

  return client;
}

export async function registerSlashCommands(
  config: Config,
  logger: { info: (msg: string) => void; error: (msg: string, err: any) => void }
): Promise<void> {
  const token = config.discord.bot_token;
  const clientId = config.discord.application_id;

  if (!token || !clientId) {
    logger.info('Token de bot o Application ID de Discord no configurados. Saltando registro de comandos slash.');
    return;
  }

  const commands = [
    {
      name: 'sbdb',
      description: 'Reproduce un sonido en tu canal de voz',
      options: [
        {
          name: 'sonido',
          description: 'El nombre del comando del sonido',
          type: 3, // String
          required: true,
          autocomplete: true
        }
      ]
    }
  ];

  const rest = new REST({ version: '10' }).setToken(token);

  try {
    logger.info('Iniciando el registro de comandos slash (global)...');
    await rest.put(
      Routes.applicationCommands(clientId),
      { body: commands }
    );
    logger.info('Comandos slash registrados exitosamente.');
  } catch (error) {
    logger.error('Error al registrar comandos slash', error);
    throw error;
  }
}
