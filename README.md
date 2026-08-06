# Super Interesting Discord Assistant

Un bot de Discord robusto diseñado bajo arquitectura limpia, que cuenta con un panel de administración web privado para gestionar sonidos de la soundboard y disparar reproducciones remotas en servidores de voz de Discord.

El proyecto está estructurado como un **Monolito Modular** utilizando **Domain-Driven Design (DDD)** y **Arquitectura Hexagonal (Ports & Adapters)** con **npm workspaces**.

---

## 🚀 Requisitos del Sistema

Para ejecutar este proyecto en local o en producción (**Debian 11**), asegúrate de tener instalado:

1. **Node.js**: Versión 22.0.0 LTS o superior.
2. **NPM**: Incluido con Node.js.
3. **MySQL**: Servidor de base de datos MySQL 8 o MariaDB.
4. **FFmpeg / FFprobe**: Binarios instalados en el sistema (el script setup los buscará o usará los estáticos de npm como fallback).

---

## 🛠️ Instalación y Configuración Rápida

### 1. Clonar el repositorio y configurar dependencias
Clona el repositorio en tu servidor Debian 11 o máquina local y ejecuta:

```bash
# Si estás en Debian 11, puedes instalar las dependencias básicas del sistema con:
sudo bash scripts/install-debian-deps.sh

# Instalar dependencias del monorepo
npm install
```

### 2. Configurar el archivo INI
Copia el archivo de ejemplo para configurar tus claves de base de datos y credenciales de Discord:

```bash
cp config/config.example.ini config/config.ini
```

Abre `config/config.ini` con tu editor (ej. `nano config/config.ini`) y rellena los datos críticos:
- Claves de base de datos MySQL/MariaDB (`user`, `password`, `database`).
- Credenciales del bot de Discord (`application_id`, `bot_token`, `public_key`).
- Genera un `session_secret` largo de al menos 32 caracteres.

### 3. Ejecutar el Setup de la Aplicación
El setup creará automáticamente la base de datos MySQL si no existe, ejecutará todas las migraciones, creará las carpetas locales de audio y te guiará de forma interactiva para crear el primer usuario administrador del panel:

```bash
npm run setup
```

---

## 💻 Comandos NPM Disponibles

- `npm run dev`: Levanta simultáneamente el servidor backend en Fastify (puerto 3000) y la web React en Vite (puerto 5173).
- `npm run dev:server`: Levanta solo el backend Fastify.
- `npm run dev:web`: Levanta solo la web React.
- `npm run build`: Compila los subproyectos del monorepo.
- `npm run start`: Arranca el servidor compilado en producción.
- `npm run db:create`: Crea la base de datos.
- `npm run db:migrate`: Ejecuta migraciones pendientes.
- `npm run db:rollback`: Revierte la última migración.
- `npm run db:status`: Muestra el estado actual de las migraciones.
- `npm run admin:create`: Crea interactivamente un nuevo administrador.
- `npm run discord:register`: Registra los comandos slash globales del bot.
- `npm run test`: Ejecuta la suite de pruebas unitarias e integración.
- `npm run clean`: Limpia carpetas de compilación y dependencias.

---

## ⚙️ Configuración del Bot de Discord

1. Crea una aplicación en [Discord Developer Portal](https://discord.com/developers/applications).
2. Ve a la pestaña **Bot**, haz clic en **Reset Token** y copia el token en tu `config.ini`.
3. Activa los **Privileged Gateway Intents**:
   - **MESSAGE CONTENT INTENT** (Obligatorio para comandos con prefijo como `-sbdb`).
   - **GUILD MEMBERS INTENT** (Recomendado).
4. El panel web generará de forma automática tu enlace OAuth2 de invitación en la pestaña **Bot de Discord**, solicitando únicamente permisos de lectura de canales y conexión/habla en canales de voz (sin permisos de Administrador).

---

## 🔊 Uso del Bot en Discord

### Comando con prefijo
El prefijo por defecto es `-sbdb`. Puedes invocar cualquier sonido activo indicando su nombre de comando:
```
-sbdb risa-malvada
-sbdb aplausos
```

### Comandos Slash (Comandos de barra)
Puedes escribir `/sbdb` en tu chat de Discord, y se desplegará la opción con autocompletado en tiempo real de todos los sonidos activos y listos para reproducir en el canal de voz actual:
```
/sbdb sonido:risa-malvada
```

*Nota: Para reproducir sonidos en Discord, debes estar conectado previamente a un canal de voz del servidor.*

---

## 📂 Estructura y Documentación

Para profundizar en el diseño del sistema, consulta los archivos en la carpeta `docs/`:

- [Arquitectura DDD y Hexagonal](file:///C:/Users/G713/.gemini/antigravity/scratch/super-interesting-discord-assistant/docs/architecture.md)
- [Diseño y Esquemas de Base de Datos](file:///C:/Users/G713/.gemini/antigravity/scratch/super-interesting-discord-assistant/docs/database.md)
- [Pasos de Configuración de Discord](file:///C:/Users/G713/.gemini/antigravity/scratch/super-interesting-discord-assistant/docs/discord-setup.md)
- [Políticas y Auditoría de Seguridad](file:///C:/Users/G713/.gemini/antigravity/scratch/super-interesting-discord-assistant/docs/security.md)
- [Procesamiento y Conversión de Audio](file:///C:/Users/G713/.gemini/antigravity/scratch/super-interesting-discord-assistant/docs/audio-processing.md)
- [Roadmap del Asistente de Voz y TTS](file:///C:/Users/G713/.gemini/antigravity/scratch/super-interesting-discord-assistant/docs/future-voice-assistant.md)
