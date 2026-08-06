# Asistente de Voz y Transcripción (Plan de Futuro)

Este documento detalla el diseño técnico para la futura integración del asistente de voz en el bot. Los contratos y modelos ya están definidos en el paquete `@super-assistant/future-voice-assistant` para asegurar un acoplamiento mínimo cuando se implemente en el futuro.

## 1. Arquitectura y Flujo de Trabajo Futuro

Cuando esta función se active, el flujo de procesamiento de voz se estructurará de la siguiente forma:

```
[Canal de Voz Discord]
          │
          ▼ (Audio Frames en tiempo real)
   [VoiceReceiver] ──► (Buffer por usuario)
          │
          ▼ (Segmento de audio con voz)
 [SpeechToTextService] ──► (Transcripciones)
          │
          ▼
 [ConversationContext]
          │
          ▼
  [CommentGenerator] ──► [TextToSpeechService] ──► [Discord Voice Connection]
 (Genera comentario)      (Sintetiza Opus Ogg)         (Reproduce en canal)
```

---

## 2. Contratos Diseñados

- **`VoiceReceiver`**: Interfaz de entrada para suscribirse a los flujos de audio PCM que provienen de Discord por cada usuario que habla en el canal de voz.
- **`SpeechToTextService`**: Interfaz para convertir fragmentos de audio PCM a transcripciones textuales usando modelos locales (Whisper) o APIs externas.
- **`CommentGenerator`**: Generador de comentarios ingeniosos y chistes basado en la transcripción acumulada del canal y el tema de conversación.
- **`TextToSpeechService`**: Sintetizador de voz para transformar el texto del comentario generado a un stream de audio en formato Ogg Opus reproducible.
- **`VoiceConsentPolicy`**: Política de consentimiento para garantizar que solo se escuche y procese a los usuarios que hayan otorgado su consentimiento explícito en el servidor.

---

## 3. Consideraciones Críticas de Privacidad y Estabilidad

1. **Consentimiento (Opt-In)**: El bot nunca grabará ni procesará audio de usuarios por defecto. Los usuarios deberán dar su consentimiento explícito mediante un comando (ej: `/voz-permitir`) o el bot ignorará sus paquetes de audio en el gateway.
2. **Indicación Visual**: Es obligatorio que el bot muestre que está "escuchando" o "procesando" (por ejemplo, mediante estados de actividad en Discord, mensajes de texto en el canal principal o su indicador de habla en el canal de voz).
3. **Descartado Inmediato de Audio**: No se almacenarán archivos de voz física en disco de forma persistente. El audio PCM en tránsito se procesará en memoria y se purgará de inmediato una vez obtenida la transcripción de texto para cumplir con la normativa de privacidad (ej. RGPD).
4. **Manejo de Inestabilidad**: Las conexiones de voz de Discord a veces pierden paquetes UDP. La implementación de `VoiceReceiver` deberá incluir un gestor de jitter buffer para reordenar los frames PCM de voz antes de enviarlos al transcriptor.
