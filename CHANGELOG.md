# 📜 Historial de Versiones y Registro de Cambios (Changelog)

Todas las modificaciones notables realizadas en la aplicación **Super Interesting Discord Assistant (SIDA)** quedan documentadas en este archivo estructurado por versiones.

---

## [v0.6.4] - 2026-08-07 🚀 (Versión Actual)
### 🎨 Mejoras en Colecciones del Sistema & Animación Neón
- **Colores Intercalados en Slots de Sistema**: Los 20 casilleros dentro de las colecciones predeterminadas alternan su color neón siguiendo de forma estricta la secuencia de los 8 temas (`emerald`, `cyan`, `pink`, `gold`, `red`, `violet`, `blue`, `orange`).
- **Pulsación Neón Sutil (20s)**: Se suavizó la animación de las tarjetas a un ciclo armónico de 20 segundos con la curva `cubic-bezier(0.4, 0, 0.6, 1)`.
- **Modo Solo Lectura**: Se deshabilitó el *Modo Configuración* y la edición de slots al ingresar a colecciones del sistema (`system-favorites`, `system-top20`, `system-recent`).

## [v0.6.3] - 2026-08-07
### 📂 Organización de Tarjetas por Filas
- **Separación Visual**: División de la vista en dos secciones:
  1. *Colecciones Predeterminadas del Sistema* (fila superior destacada).
  2. *Mis Colecciones Personalizadas* (fila inferior con opciones de edición y eliminación).

## [v0.6.2] - 2026-08-07
### ✨ Tercera Colección del Sistema: Últimos Añadidos
- **Colección `system-recent`**: Se incorporó la tercera colección fija obligatoria que agrupa los **20 sonidos más recientemente añadidos** a la plataforma ordenados por fecha (`created_at` desc).
- **Colores Neón Representativos**:
  - `★ Mis Favoritos`: Dorado (`gold`) con estrella.
  - `🔥 Top 20 Más Reproducidos`: Rosa (`pink`) con fuego.
  - `✨ Últimos Añadidos`: Cian (`cyan`) con destellos.

## [v0.6.1] - 2026-08-07
### ⭐ Colecciones Fijas del Sistema
- **`system-favorites` & `system-top20`**: Creación de las colecciones virtuales del sistema no modificables que calculan dinámicamente los favoritos del usuario y el top 20 más reproducido en tiempo real.

## [v0.6.0] - 2026-08-07
### 💎 Rediseño Clear-Look & Tarjetas Cuadradas (256px x 256px)
- **Formato Cuadrado**: Tarjetas de colección con dimensiones fijas de `256px x 256px`, acabado translúcido de cristal pulido (*Clear Look*) e icono central destacado.
- **Acceso Directo**: Hacer clic en cualquier lugar de la tarjeta abre la mesa de mezclas.
- **Edición de Colecciones**: Botón `✏️` y modal para modificar nombre, descripción e icono distintivo.

---

## [v0.5.0] - 2026-08-06
### 🎨 Colecciones de Sonidos & Selector de Iconos
- Renombrado de "Stream Deck" a **Colecciones de Sonidos**.
- Incorporación de selector de iconos dinámico (`/iconos/`) en la creación de colecciones.
- Soporte para alteración de tabla MySQL `sound_collections` agregando `icon` y `color_theme`.

---

## [v0.4.2] - 2026-08-06
### 📊 Favoritos y Conteo de Reproducciones
- **Ordenación Inteligente por Defecto**: En el Explorador de Sonidos, los favoritos (`★`) aparecen siempre primero, seguidos por el conteo de reproducciones (`▶`) de mayor a menor.
- **Toggle de Favoritos**: Endpoint `POST /api/sounds/:id/favorite` para guardar preferencias por usuario en MySQL.

## [v0.4.1] - 2026-08-06
### 🎵 Optimización de Streaming Native HTTP 206
- Soporte de cabeceras `206 Partial Content` y peticiones `Range` en `GET /api/sounds/:id/audio` para archivos MP3/WAV nativos sin errores 416.
- Silenciado de `AbortError` en React cuando el usuario cambia rápidamente de pista en la web.

## [v0.4.0] - 2026-08-06
### 🔐 Sincronización de Autenticación & Canales de Voz Discord
- Modificación de cookies de sesión a `sameSite: 'lax'` y `secure: false`.
- Persistencia de último servidor y canal seleccionado en modal vía `localStorage`.
- Formateo de nombres de canales de voz incluyendo número de miembros conectados: `🔊 General (3)`.

---

## [v0.3.0] - 2026-08-05
### 🎛️ Consola Pro Soundboard (Mesa 4x5 de 20 Botones)
- **Matriz 4x5**: 20 casillas interactivas con Modos *Reproducción* y *Configuración*.
- **Pantalla Master Out Visualizer**: Ecualizador animado en tiempo real al reproducir sonidos.
- **Personalización LED**: 8 temas de color neón (`emerald`, `cyan`, `pink`, `gold`, `red`, `violet`, `blue`, `orange`).

---

## [v0.2.0] - 2026-08-04
### ⚡ Botón Zap & Explorador de Sonidos
- Botón Zap (`⚡`) de reproducción rápida inmediata al canal de voz de Discord.
- Contadores de uso por sonido respaldados por la tabla `playback_events`.
- Paginación dinámica (10, 20, 50, 100, 250 elementos por página) en la tabla del explorador.

---

## [v0.1.0] - 2026-08-03
### 📥 Botón de Descarga Directa
- Funcionalidad de descarga de archivos de sonido originales desde la tabla del explorador y vista de edición.

---

## [v0.0] - 2026-08-01
### 🏁 Fundación Inicial del Sistema (MVP Base)
- Arquitectura de microservicios en monorepo (Fastify backend, React Vite frontend, Discord.js bot, MySQL database).
- Autenticación JWT basada en cookies y gestión de usuarios/roles.
