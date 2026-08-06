#!/usr/bin/env bash
# ======================================================================
# SCRIPT DE INSTALACIÓN DE DEPENDENCIAS PARA DEBIAN 11
# PROYECTO: SUPER INTERESTING DISCORD ASSISTANT
# ======================================================================

set -e

# Colores para salida en terminal
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # Sin color

echo -e "${YELLOW}======================================================================${NC}"
echo -e "${YELLOW}      SUPER INTERESTING DISCORD ASSISTANT - INSTALADOR DEBIAN 11       ${NC}"
echo -e "${YELLOW}======================================================================${NC}\n"

# 1. Verificar permisos de root o sudo
if [ "$EUID" -ne 0 ]; then
  echo -e "${RED}[ERROR] Este script debe ser ejecutado con permisos de root o usando sudo.${NC}"
  exit 1
fi

echo -e "${GREEN}[1/5] Actualizando repositorios del sistema...${NC}"
apt-get update && apt-get upgrade -y

echo -e "${GREEN}[2/5] Instalar herramientas básicas necesarias...${NC}"
apt-get install -y curl gnupg ca-certificates build-essential

# 2. Configurar e instalar Node.js 22 (LTS) de NodeSource
echo -e "${GREEN}[3/5] Configurando repositorio oficial e instalando Node.js v22 (LTS)...${NC}"
mkdir -p /etc/apt/keyrings
curl -fsSL https://deb.nodesource.com/gpgkey/nodesource-repo.gpg.key | gpg --dearmor -o /etc/apt/keyrings/nodesource.gpg

echo "deb [signed-by=/etc/apt/keyrings/nodesource.gpg] https://deb.nodesource.com/node_22.x nodistro main" | tee /etc/apt/sources.list.d/nodesource.list

apt-get update
apt-get install -y nodejs

# Verificar versión de node
NODE_VERSION=$(node -v)
echo -e "${GREEN}[OK] Node.js instalado correctamente (${NODE_VERSION})${NC}"

# 3. Instalar FFmpeg y FFprobe
echo -e "${GREEN}[4/5] Instalando FFmpeg y FFprobe desde el gestor de paquetes (apt)...${NC}"
apt-get install -y ffmpeg

# Verificar ffmpeg
if command -v ffmpeg >/dev/null 2>&1; then
  FFMPEG_VERSION=$(ffmpeg -version | head -n 1)
  echo -e "${GREEN}[OK] FFmpeg instalado correctamente (${FFMPEG_VERSION})${NC}"
else
  echo -e "${RED}[ERROR] Falló la instalación de FFmpeg.${NC}"
  exit 1
fi

# 4. Preguntar si se desea instalar MariaDB/MySQL Server local
echo -e "${YELLOW}¿Deseas instalar el servidor de base de datos MariaDB (MySQL compatible) localmente en esta máquina? (s/n)${NC}"
read -r -p "[s/N]: " INSTALL_DB

if [[ "$INSTALL_DB" =~ ^[sS]$ || "$INSTALL_DB" =~ ^[sS][iI]$ ]]; then
  echo -e "${GREEN}[5/5] Instalando MariaDB Server...${NC}"
  apt-get install -y mariadb-server
  
  echo -e "${GREEN}[5/5] Iniciando y habilitando servicio MariaDB...${NC}"
  systemctl start mariadb
  systemctl enable mariadb
  
  echo -e "${GREEN}[OK] MariaDB Server instalado y corriendo.${NC}"
  echo -e "${YELLOW}[CONSEJO] Recuerda ejecutar 'mysql_secure_installation' para configurar contraseñas seguras.${NC}"
else
  echo -e "${GREEN}[5/5] Omitiendo la instalación de MariaDB Server local.${NC}"
  echo -e "${YELLOW}[INFO] Asegúrate de tener una base de datos MySQL 8 o MariaDB externa disponible.${NC}"
fi

# 5. Configurar permisos básicos en carpeta de datos si existe
PROJECT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
echo -e "${GREEN}Configurando carpetas de datos del proyecto en ${PROJECT_DIR}...${NC}"
mkdir -p "${PROJECT_DIR}/data/sounds"
mkdir -p "${PROJECT_DIR}/data/originals"
mkdir -p "${PROJECT_DIR}/data/temp"
chmod -R 775 "${PROJECT_DIR}/data"

echo -e "\n${GREEN}======================================================================${NC}"
echo -e "${GREEN}       INSTALACIÓN DE DEPENDENCIAS DEL SISTEMA COMPLETADA             ${NC}"
echo -e "${GREEN}======================================================================${NC}"
echo -e "Pasos siguientes sugeridos:"
echo -e "  1. Configura el archivo: config/config.ini (basado en config.example.ini)"
echo -e "  2. Instala dependencias npm del monorepo: ${YELLOW}npm install${NC}"
echo -e "  3. Configura base de datos y comandos:    ${YELLOW}npm run setup${NC}"
echo -e "  4. Levanta el servidor en producción:     ${YELLOW}npm run build && npm start${NC}"
echo -e "======================================================================\n"
