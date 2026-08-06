/**
 * NOTA DE ARQUITECTURA: FUTURA ESCUCHA DE CONVERSACIONES Y ASISTENTE DE VOZ
 * 
 * Este módulo contiene las definiciones, contratos e interfaces necesarias para preparar
 * el sistema para la futura escucha de conversaciones de voz, transcripción en tiempo real,
 * e interacción por Text-to-Speech (TTS).
 * 
 * Consideraciones para la futura implementación:
 * 1. La recepción de audio en Discord por WebRTC/Voice Gateway puede ser inestable y requiere
 *    gestionar buffers de audio por usuario (debido a la llegada de frames fuera de orden).
 * 2. Se requerirá el consentimiento explícito de los participantes del canal de voz para
 *    cumplir con normativas de privacidad (RGPD / leyes locales).
 * 3. Debe existir una indicación visual clara en Discord (ej: responder en canal de texto)
 *    cuando el bot comience o termine de escuchar.
 * 4. Debe definirse una política estricta de retención de audio: descartar inmediatamente
 *    los datos tras transcribir o tras el procesamiento del contexto.
 * 5. La grabación y procesamiento deben estar desactivadas por defecto (Opt-In).
 */

export type DiscordGuildId = string;
export type DiscordChannelId = string;

export interface VoiceAudioFrame {
  userId: string;
  sequence: number;
  timestamp: number;
  pcmBuffer: Buffer;
}

export interface AudioSegment {
  guildId: DiscordGuildId;
  channelId: DiscordChannelId;
  userId: string;
  pcmData: Buffer;
  startTime: Date;
  endTime: Date;
}

export interface Transcript {
  userId: string;
  text: string;
  confidence: number;
  timestamp: Date;
}

export interface ConversationContext {
  guildId: DiscordGuildId;
  channelId: DiscordChannelId;
  recentTranscripts: Transcript[];
  summary: string;
}

export interface GeneratedComment {
  text: string;
  confidence: number;
  topic: string;
  createdAt: Date;
}

export type ConsentState = 'GRANTED' | 'DENIED' | 'PENDING';

export interface ConversationSession {
  sessionId: string;
  guildId: DiscordGuildId;
  channelId: DiscordChannelId;
  startedAt: Date;
  activeUsers: string[];
}

export interface VoiceReceiver {
  subscribe(
    guildId: DiscordGuildId,
    channelId: DiscordChannelId
  ): AsyncIterable<VoiceAudioFrame>;

  disconnect(guildId: DiscordGuildId): Promise<void>;
}

export interface SpeechToTextService {
  transcribe(audio: AudioSegment): Promise<Transcript>;
}

export interface CommentGenerator {
  generate(context: ConversationContext): Promise<GeneratedComment | null>;
}

export interface TextToSpeechService {
  synthesize(text: string): Promise<Buffer>; // Retorna buffer de audio sintetizado
}

export interface VoiceConsentPolicy {
  canListen(session: ConversationSession): Promise<boolean>;
}

export interface GeneratedCommentPolicy {
  shouldComment(comment: GeneratedComment, context: ConversationContext): Promise<boolean>;
}
