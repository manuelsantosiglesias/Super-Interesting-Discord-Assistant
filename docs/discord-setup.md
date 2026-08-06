# Configuración de la Aplicación de Discord

Para conectar el bot a los servidores de voz y texto, es necesario crear una aplicación de Discord y obtener las credenciales correspondientes.

## 1. Crear la Aplicación en Discord Developer Portal

1. Dirígete a la consola de desarrolladores: [Discord Developer Portal](https://discord.com/developers/applications).
2. Haz clic en **New Application** en la parte superior derecha.
3. Elige un nombre para tu bot y haz clic en **Create**.

---

## 2. Configurar el Bot de Discord

1. Ve a la sección **Bot** en el menú de navegación de la izquierda.
2. Haz clic en **Add Bot** para inicializar el cliente del bot.
3. **Obtener el Bot Token**: Haz clic en **Reset Token** para generar un nuevo token de acceso. Cópialo y guárdalo de forma segura. Lo necesitarás en `config.ini` como `bot_token`.
4. **Privileged Gateway Intents**: Desplázate hacia abajo hasta la sección de Intents y activa las siguientes casillas:
   - **MESSAGE CONTENT INTENT** (Obligatorio para permitir comandos con prefijo como `-sbdb risa`).
   - **GUILD MEMBERS INTENT** (Recomendado para resolución de miembros y estados de voz).

---

## 3. Obtener el Application ID y Public Key

1. Ve a la sección **General Information** en el menú izquierdo.
2. Copia el **Application ID** (lo necesitarás en `config.ini` como `application_id`).
3. Copia la **Public Key** (lo necesitarás en `config.ini` como `public_key`).

---

## 4. Permisos Requeridos e Instalación (OAuth2 Link)

El asistente no requiere permisos de Administrador. Para instalarlo de forma segura en los servidores, el panel web genera una URL de instalación con los siguientes permisos mínimos:

- **Scopes**:
  - `bot` (Para conectar al bot de Discord).
  - `applications.commands` (Para habilitar y registrar comandos slash `/sbdb`).
- **Permisos de Texto**:
  - `View Channels` (Para leer canales).
  - `Send Messages` (Para responder comandos).
  - `Read Message History` (Para evaluar contexto).
  - `Use Application Commands` (Para aceptar comandos de barra).
- **Permisos de Voz**:
  - `Connect` (Para unirse a canales de voz).
  - `Speak` (Para reproducir sonidos).

La URL generada automáticamente por la app será:
`https://discord.com/oauth2/authorize?client_id=<application_id>&permissions=3213312&scope=bot%20applications.commands`
