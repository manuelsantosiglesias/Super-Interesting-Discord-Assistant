# Procesamiento y Normalización de Audio

Para asegurar que todos los audios se reproduzcan correctamente en Discord (canales de voz WebRTC) y previsualizaciones del navegador, el sistema procesa los archivos entrantes siguiendo reglas estrictas de conversión.

## 1. Formato de Salida Normalizado

Cada archivo de audio subido desde el panel se procesa con **FFmpeg** y se convierte al formato estándar de Discord:

- **Contenedor**: OGG (`.ogg`)
- **Códec de Audio**: Opus (`libopus`)
- **Frecuencia de Muestreo**: 48,000 Hz (48 kHz)
- **Canales**: 2 (Estéreo)
- **Bitrate**: 128 kbps

Este formato es idóneo para evitar que el bot o el cliente de Discord tengan que transcodificar el audio al transmitir, lo que reduce drásticamente el consumo de CPU y memoria en el servidor Debian de producción.

---

## 2. Flujo de Validación de Archivos Subidos

Al subir un archivo en multipart, se ejecuta el siguiente pipeline:

1. **Guardado Temporal**: Se escribe el flujo (stream) a `data/temp/{uuid}.tmp`.
2. **Inspección ffprobe**: Se ejecuta `ffprobe` para verificar:
   - Que contenga una pista de audio válida.
   - La duración exacta (debe ser menor a 60 segundos por defecto).
   - Que no sea un archivo corrupto.
3. **Conversión FFmpeg**: Se ejecuta la conversión con argumentos estructurados.
4. **Persistencia y Hash**: Se calcula el hash SHA-256 sobre el archivo final y se guarda en `data/sounds/{uuid}.ogg`. Si `preserve_originals` está activo, el original se mueve a `data/originals/{uuid}.ext`.
5. **Limpieza**: Se eliminan todos los archivos temporales de `data/temp` creados en el proceso.

---

## 3. Tarea de Mantenimiento y Limpieza (`npm run storage:cleanup`)

El sistema cuenta con un comando automatizado para purgar archivos huérfanos del almacenamiento físico en disco:

```bash
npm run storage:cleanup
```

Esta tarea busca en el disco archivos de audio que no correspondan a ningún registro activo de la tabla `sounds` en la base de datos (por ejemplo, remanentes de borrados fallidos o interrupciones en subidas) y los elimina de forma segura.
