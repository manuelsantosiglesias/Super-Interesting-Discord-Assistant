# Diseño de Base de Datos (MySQL 8)

El sistema utiliza **MySQL 8** con codificación `utf8mb4` y colación `utf8mb4_unicode_ci` para soportar emojis y caracteres de servidores de Discord. Las consultas y migraciones se gestionan con **Kysely**.

## 1. Esquema de Tablas

### 1.1. `users`
Almacena las cuentas de administrador y usuario del panel web.
- `id` CHAR(36) PK: Identificador UUIDv4.
- `username` VARCHAR(80) UNIQUE: Nombre de usuario normalizado.
- `password_hash` VARCHAR(255): Hash Argon2id.
- `role` ENUM('ADMIN', 'USER'): Control de acceso basado en roles.
- `is_active` TINYINT: Habilitado (1) o deshabilitado (0).
- `must_change_password` TINYINT: Si es 1, obliga a cambiar contraseña al entrar.
- `failed_login_attempts` INT: Intentos fallidos acumulados.
- `locked_until` DATETIME: Bloqueo temporal por intentos fallidos.
- `last_login_at` DATETIME: Última sesión establecida.
- Índices: `idx_users_is_active` en `is_active`.

### 1.2. `user_sessions`
Sesiones de servidor (en base de datos).
- `id` CHAR(64) PK: Token de sesión SHA-256 seguro.
- `user_id` CHAR(36) FK -> `users.id` (ON DELETE CASCADE).
- `expires_at` DATETIME.
- `created_at` DATETIME.
- `last_seen_at` DATETIME: Control de inactividad de sesión.
- `ip_hash` VARCHAR(128): Dirección IP cifrada con SHA-256.
- `user_agent` VARCHAR(500).

### 1.3. `sounds`
Metadatos de sonidos disponibles en la soundboard.
- `id` CHAR(36) PK.
- `display_name` VARCHAR(120).
- `command_name` VARCHAR(64) UNIQUE: Nombre único de comando en minúsculas.
- `description` VARCHAR(500).
- `original_filename` VARCHAR(255).
- `storage_filename` VARCHAR(255) UNIQUE: Nombre físico generado UUID.ogg.
- `original_storage_filename` VARCHAR(255): Nombre del archivo original.
- `mime_type` VARCHAR(100): Tipo MIME del archivo.
- `normalized_format` VARCHAR(20): Siempre "ogg".
- `size_bytes` BIGINT: Tamaño del audio normalizado.
- `duration_ms` INT: Duración del audio en milisegundos.
- `sha256` CHAR(64): Hash SHA-256 del audio procesado.
- `volume` DECIMAL(4,3): Multiplicador de volumen (0.000 a 2.000).
- `is_active` TINYINT: Si es 0, no se puede reproducir en Discord.
- `uploaded_by` CHAR(36) FK -> `users.id`.
- `deleted_at` DATETIME NULL: Borrado lógico.

### 1.4. `discord_guilds`
Configuración de cada servidor de Discord.
- `id` CHAR(36) PK.
- `discord_guild_id` VARCHAR(32) UNIQUE: ID real del servidor de Discord.
- `guild_name` VARCHAR(150).
- `command_prefix` VARCHAR(20): Prefijo de comandos (ej: `-sbdb`).
- `default_volume` DECIMAL(4,3): Volumen del bot en el servidor.
- `leave_after_seconds` INT: Desconexión por inactividad.
- `max_queue_size` INT: Cola de reproducción máxima.
- `user_cooldown_seconds` INT: Cooldown de comandos por usuario.
- `is_enabled` TINYINT: Si es 0, el bot ignora el servidor.

### 1.5. `guild_allowed_channels`
Canales de texto permitidos por servidor (si la lista está vacía, se permiten todos).
- `guild_id` CHAR(36) FK -> `discord_guilds.id` (ON DELETE CASCADE).
- `discord_channel_id` VARCHAR(32).
- PK compuesta: `(guild_id, discord_channel_id)`.

### 1.6. `playback_events`
Registro histórico de reproducciones de audio.
- `id` CHAR(36) PK.
- `sound_id` CHAR(36) FK -> `sounds.id` (ON DELETE SET NULL).
- `guild_id` CHAR(36) FK -> `discord_guilds.id` (ON DELETE SET NULL).
- `requested_by_discord_user_id` VARCHAR(32).
- `requested_by_web_user_id` CHAR(36) FK -> `users.id` (ON DELETE SET NULL).
- `text_channel_id` VARCHAR(32).
- `voice_channel_id` VARCHAR(32).
- `source` ENUM('DISCORD_PREFIX', 'DISCORD_SLASH', 'WEB').
- `status` ENUM('QUEUED', 'PLAYING', 'COMPLETED', 'FAILED', 'REJECTED').
- `error_code` VARCHAR(80).
- `error_message` VARCHAR(500).

### 1.7. `audit_log`
Registro de auditoría estructurado para administradores.
- `id` BIGINT AUTO_INCREMENT PK.
- `user_id` CHAR(36) FK -> `users.id` (ON DELETE SET NULL).
- `action` VARCHAR(100): Acción realizada.
- `entity_type` VARCHAR(100).
- `entity_id` VARCHAR(100).
- `metadata_json` JSON: Detalles adicionales.
- `ip_hash` VARCHAR(128).
- `created_at` DATETIME.

---

## 2. Inicialización e Idempotencia

El script de instalación `npm run setup` crea la base de datos si no existe mediante directivas seguras y ejecuta las migraciones de Kysely. Si la base de datos ya está creada, el script aplica únicamente las migraciones pendientes sin destruir datos existentes.
