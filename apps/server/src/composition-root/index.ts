import { loadConfig, Config } from '@super-assistant/config';
import { SystemClock } from '@super-assistant/shared-kernel';
import { 
  KyselyUserRepository, 
  KyselySessionRepository, 
  Argon2PasswordHasher,
  LoginUser,
  LogoutUser,
  GetCurrentUser,
  CreateUser,
  ListUsers,
  EnableUser,
  DisableUser,
  ChangePassword,
  ResetUserPassword,
  CleanupExpiredSessions
} from '@super-assistant/identity';
import { 
  KyselySoundRepository, 
  LocalAudioStorage, 
  FFmpegAudioProcessor,
  UploadSound,
  ListSounds,
  GetSound,
  UpdateSound,
  DeleteSound,
  StreamSound,
  CheckCommandAvailability,
  ResolveSoundByCommand
} from '@super-assistant/soundboard';
import { 
  KyselyGuildConfigurationRepository,
  RegisterGuild,
  MarkGuildDisconnected,
  ListGuilds,
  GetGuild,
  UpdateGuildConfiguration
} from '@super-assistant/guild-management';
import { 
  KyselyPlaybackEventRepository,
  PlaybackQueueManager,
  GenerateInstallUrl,
  PlaySoundFromWeb,
  HandlePrefixSoundCommand,
  HandleSlashSoundCommand,
  createDiscordBot
} from '@super-assistant/discord-integration';
import { 
  KyselyAuditLogRepository,
  WriteAuditEvent,
  ListAuditEvents
} from '@super-assistant/audit';
import { getDbConnection } from '../db/connection.js';
import pino from 'pino';
import * as path from 'path';

export interface AppContainer {
  config: Config;
  clock: SystemClock;
  logger: any;
  
  // Use cases
  loginUser: LoginUser;
  logoutUser: LogoutUser;
  getCurrentUser: GetCurrentUser;
  createUser: CreateUser;
  listUsers: ListUsers;
  enableUser: EnableUser;
  disableUser: DisableUser;
  changePassword: ChangePassword;
  resetUserPassword: ResetUserPassword;
  cleanupExpiredSessions: CleanupExpiredSessions;

  uploadSound: UploadSound;
  listSounds: ListSounds;
  getSound: GetSound;
  updateSound: UpdateSound;
  deleteSound: DeleteSound;
  streamSound: StreamSound;
  checkCommandAvailability: CheckCommandAvailability;
  resolveSoundByCommand: ResolveSoundByCommand;

  registerGuild: RegisterGuild;
  markGuildDisconnected: MarkGuildDisconnected;
  listGuilds: ListGuilds;
  getGuild: GetGuild;
  updateGuildConfiguration: UpdateGuildConfiguration;

  generateInstallUrl: GenerateInstallUrl;
  playSoundFromWeb: PlaySoundFromWeb;
  handlePrefix: HandlePrefixSoundCommand;
  handleSlash: HandleSlashSoundCommand;

  writeAuditEvent: WriteAuditEvent;
  listAuditEvents: ListAuditEvents;

  // Infrastructure
  queueManager: PlaybackQueueManager;
  discordBot: any;
  db: any;
}

let containerInstance: AppContainer | null = null;

export function buildContainer(customLogger?: any): AppContainer {
  if (containerInstance) return containerInstance;

  const config = loadConfig();
  const db = getDbConnection();
  const clock = new SystemClock();
  
  const logger = customLogger || pino({
    level: config.app.environment === 'production' ? 'info' : 'debug',
    transport: config.app.environment !== 'production' ? {
      target: 'pino-pretty',
      options: { colorize: true }
    } : undefined
  });

  // Repositories
  const userRepo = new KyselyUserRepository(db as any);
  const sessionRepo = new KyselySessionRepository(db as any);
  const soundRepo = new KyselySoundRepository(db as any);
  const guildRepo = new KyselyGuildConfigurationRepository(db as any);
  const playbackEventRepo = new KyselyPlaybackEventRepository(db as any);
  const auditRepo = new KyselyAuditLogRepository(db as any);

  // Core Services
  const hasher = new Argon2PasswordHasher();
  const audioProcessor = new FFmpegAudioProcessor();
  const audioStorage = new LocalAudioStorage(
    path.resolve(config.app.upload_directory),
    path.resolve(config.app.originals_directory)
  );

  const queueManager = new PlaybackQueueManager(
    soundRepo,
    guildRepo,
    playbackEventRepo,
    path.resolve(config.app.upload_directory)
  );

  // Use Cases
  const loginUser = new LoginUser(userRepo, sessionRepo, hasher, clock, config);
  const logoutUser = new LogoutUser(sessionRepo);
  const getCurrentUser = new GetCurrentUser(sessionRepo, userRepo, clock, config);
  const createUser = new CreateUser(userRepo, hasher, config);
  const listUsers = new ListUsers(userRepo);
  const enableUser = new EnableUser(userRepo);
  const disableUser = new DisableUser(userRepo, sessionRepo);
  const changePassword = new ChangePassword(userRepo, sessionRepo, hasher, config);
  const resetUserPassword = new ResetUserPassword(userRepo, sessionRepo, hasher, config);
  const cleanupExpiredSessions = new CleanupExpiredSessions(sessionRepo, clock);

  const uploadSound = new UploadSound(soundRepo, audioProcessor, audioStorage, config);
  const listSounds = new ListSounds(soundRepo);
  const getSound = new GetSound(soundRepo);
  const updateSound = new UpdateSound(soundRepo);
  const deleteSound = new DeleteSound(soundRepo, audioStorage);
  const streamSound = new StreamSound(soundRepo, audioStorage);
  const checkCommandAvailability = new CheckCommandAvailability(soundRepo);
  const resolveSoundByCommand = new ResolveSoundByCommand(soundRepo);

  const registerGuild = new RegisterGuild(guildRepo, config);
  const markGuildDisconnected = new MarkGuildDisconnected(guildRepo);
  const listGuilds = new ListGuilds(guildRepo);
  const getGuild = new GetGuild(guildRepo);
  const updateGuildConfiguration = new UpdateGuildConfiguration(guildRepo);

  const generateInstallUrl = new GenerateInstallUrl(config);
  const playSoundFromWeb = new PlaySoundFromWeb(soundRepo, guildRepo, queueManager);
  
  const handlePrefix = new HandlePrefixSoundCommand(
    guildRepo,
    soundRepo,
    queueManager,
    resolveSoundByCommand
  );
  
  const handleSlash = new HandleSlashSoundCommand(
    guildRepo,
    soundRepo,
    queueManager,
    resolveSoundByCommand
  );

  const writeAuditEvent = new WriteAuditEvent(auditRepo);
  const listAuditEvents = new ListAuditEvents(auditRepo);

  // Instanciar bot de Discord
  let discordBot: any = null;
  if (config.discord.bot_token) {
    discordBot = createDiscordBot({
      config,
      registerGuild,
      markGuildDisconnected,
      handlePrefix,
      handleSlash,
      soundRepo,
      queueManager,
      logger
    });
  } else {
    logger.warn('Token del bot de Discord no configurado. El bot de Discord no se iniciará.');
  }

  containerInstance = {
    config,
    clock,
    logger,
    
    loginUser,
    logoutUser,
    getCurrentUser,
    createUser,
    listUsers,
    enableUser,
    disableUser,
    changePassword,
    resetUserPassword,
    cleanupExpiredSessions,

    uploadSound,
    listSounds,
    getSound,
    updateSound,
    deleteSound,
    streamSound,
    checkCommandAvailability,
    resolveSoundByCommand,

    registerGuild,
    markGuildDisconnected,
    listGuilds,
    getGuild,
    updateGuildConfiguration,

    generateInstallUrl,
    playSoundFromWeb,
    handlePrefix,
    handleSlash,

    writeAuditEvent,
    listAuditEvents,

    queueManager,
    discordBot,
    db
  };

  return containerInstance;
}
