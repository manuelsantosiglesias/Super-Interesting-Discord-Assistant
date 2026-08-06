# Arquitectura del Sistema: Monolito Modular DDD + Hexagonal

Este proyecto se ha diseñado bajo los principios de **Domain-Driven Design (DDD)** y **Arquitectura Hexagonal (Ports & Adapters)**. Se organiza como un **Monolito Modular** estructurado en el monorepo a través de paquetes TypeScript desacoplados.

## 1. Contextos Delimitados (Bounded Contexts)

El monolito se compone de los siguientes módulos autocontenidos:

- **`identity`**: Responsable de la gestión de usuarios, roles (ADMIN/USER), inicio y cierre de sesión, bloqueos temporales de cuentas por intentos fallidos y ciclo de vida de sesiones guardadas en base de datos.
- **`soundboard`**: Responsable de la subida de sonidos, validación de sintaxis de comandos, normalización técnica con FFmpeg a formato Ogg Opus y almacenamiento local.
- **`guild-management`**: Responsable de la persistencia de configuraciones de servidores de Discord y la restricción de comandos por canales de texto.
- **`discord-integration`**: Responsable del bot de Discord, eventos, comandos slash con autocompletado dinámico, comandos con prefijo y el gestor de colas de reproducción por servidor.
- **`audit`**: Responsable de escribir y consultar eventos de auditoría inmutables (login correcto/fallido, subidas, borrados, cambios de volumen, etc.).
- **`future-voice-assistant`**: Módulo desacoplado de soporte para futuras integraciones de transcripción (STT) y voz sintética (TTS).

---

## 2. Capas de la Arquitectura Hexagonal

Dentro de cada módulo, se respeta estrictamente la separación de capas:

```
[Cliente Discord / Panel Web] (Input Adapters)
               │
               ▼
   [Casos de Uso / Aplicación] (Application Services)
               │
               ▼
       [Modelo de Dominio] (Entities & Value Objects)
               │
               ▼
[MySQL / FFmpeg / File System] (Output Adapters)
```

1. **Dominio (Domain)**:
   - Contiene las entidades puras (ej: `User`, `Sound`, `GuildConfiguration`), Value Objects (`SoundCommandName`) y los contratos/puertos de salida (`UserRepository`, `AudioProcessor`).
   - Esta capa no tiene ninguna dependencia externa (no importa Fastify, mysql2, ni discord.js).
2. **Aplicación (Application)**:
   - Implementa los Casos de Uso (ej: `UploadSound`, `LoginUser`).
   - Depende únicamente de las abstracciones del Dominio (Puertos), permitiendo la inyección de dependencias.
3. **Infraestructura (Infrastructure)**:
   - Implementa los adaptadores de salida concretos (ej: repositorios Kysely MySQL, hasher Argon2id, procesador mediante ejecutables FFmpeg).
4. **Interfaces de Entrada (Entry Points)**:
   - Adaptadores que reciben peticiones de agentes externos (ej: controladores Fastify de la API REST o eventos recibidos del Gateway de Discord.js).

---

## 3. Inversión de Dependencias (DI) y Composition Root

Para asegurar el desacoplamiento, la inicialización de todas las dependencias se gestiona en un punto único localizado en:

[apps/server/src/composition-root/index.ts](file:///C:/Users/G713/.gemini/antigravity/scratch/super-interesting-discord-assistant/apps/server/src/composition-root/index.ts)

El servidor Fastify y el bot de Discord solo acceden a los casos de uso resueltos por esta factoría inyectable, garantizando la facilidad de pruebas mediante mocks y fakes en entornos de prueba.
