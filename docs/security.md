# Políticas de Seguridad e Implementación

El proyecto sigue estándares modernos de seguridad para proteger tanto la API HTTP del panel web como la integración con los servidores de Discord.

## 1. Autenticación y Gestión de Sesiones

- **Almacenamiento de Sesiones**: Las sesiones se gestionan en base de datos (`user_sessions`) y no mediante tokens JWT. Esto permite la invalidación inmediata de sesiones al desactivar usuarios, cambiar contraseñas o ante un cierre de sesión manual.
- **Transmisión Segura**: Las cookies de sesión (`super_interesting_discord_assistant_session`) usan las directivas:
  - `HttpOnly`: Previene que scripts maliciosos de terceros accedan al token (protección contra XSS).
  - `SameSite=Strict`: Mitiga ataques CSRF (falsificación de peticiones en sitios cruzados).
  - `Secure`: Se activa automáticamente en entornos de producción con HTTPS.
- **Bloqueo de Cuentas**: Ante más de 5 intentos fallidos (configurable), la cuenta se bloquea temporalmente por 15 minutos para prevenir ataques de fuerza bruta.

---

## 2. Cifrado y Criptografía

- **Hasheo de Contraseñas**: Se utiliza **Argon2id** (mediante la librería `argon2` nativa) con parámetros optimizados de fábrica. Las contraseñas nunca se guardan en texto plano ni se envían de vuelta en la API.
- **Privacidad de IPs**: Las direcciones IP de los logins se registran hasheadas con SHA-256 en la tabla `audit_log` y `user_sessions`, asegurando que no se guarden datos personales identificativos directamente en base de datos.

---

## 3. Seguridad de Archivos y Procesamiento de Audio

- **Path Traversal**: Las rutas físicas en disco están totalmente desacopladas de los nombres de archivo originales. Al subir un audio, se genera un UUID aleatorio que actúa como nombre de archivo en disco (ej. `data/sounds/{uuid}.ogg`). Nunca se ejecutan nombres de archivo provenientes de peticiones HTTP en el sistema de archivos.
- **Inyección de Comandos Shell**: Al invocar a **FFmpeg** y **FFprobe** para procesar los audios, se utiliza `child_process.spawn` enviando un array de argumentos sanitizado en lugar de concatenar cadenas en `exec`. Esto anula la posibilidad de inyecciones de comandos en la consola del servidor Debian.
- **Timeouts de Procesos**: Cada conversión de audio tiene un temporizador (timeout) de 15 segundos que liquida el subproceso hijo si excede el tiempo de procesamiento, evitando ataques de denegación de servicio (DoS) por archivos de audio manipulados.

---

## 4. Protección de API y Logs

- **Rate Limiting**: Se aplica rate limit por IP a través de `@fastify/rate-limit` en todas las rutas, con reglas más estrictas para subida de audio y logins.
- **Helmet**: `@fastify/helmet` inyecta cabeceras HTTP estándar de seguridad para prevenir secuestros de click y scripting malicioso.
- **Redacción de Logs (Logs Redaction)**: Pino logger se configura para ocultar contraseñas, tokens de bot y secretos de sesión antes de escribirlos en los logs.
