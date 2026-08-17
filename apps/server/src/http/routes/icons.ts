import { FastifyInstance } from 'fastify';
import { z } from 'zod';
import * as fs from 'fs';
import * as path from 'path';
import { randomUUID } from 'crypto';
import { AppContainer } from '../../composition-root/index.js';
import { NotFoundError } from '@super-assistant/shared-kernel';

function getRootWorkspaceDir(): string {
  const cwd = process.cwd();
  if (cwd.endsWith(path.join('apps', 'server')) || cwd.endsWith('apps/server') || cwd.endsWith('apps\\server')) {
    return path.resolve(cwd, '..', '..');
  }
  return cwd;
}

export default async function iconRoutes(fastify: FastifyInstance, options: { container: AppContainer }) {
  const { container } = options;
  const rootDir = getRootWorkspaceDir();

  // 0. Servir archivos estáticos de /memes/:filename
  fastify.get('/memes/:filename', async (request, reply) => {
    const params = z.object({ filename: z.string() }).parse(request.params);
    const safeFilename = path.basename(params.filename);

    const possiblePaths = [
      path.join(rootDir, 'apps', 'web', 'public', 'memes', safeFilename),
      path.join(rootDir, 'apps', 'web', 'dist', 'memes', safeFilename),
      path.join(process.cwd(), 'apps', 'web', 'public', 'memes', safeFilename)
    ];

    for (const filePath of possiblePaths) {
      if (fs.existsSync(filePath)) {
        const ext = path.extname(safeFilename).toLowerCase();
        let mimeType = 'image/png';
        if (ext === '.jpg' || ext === '.jpeg') mimeType = 'image/jpeg';
        else if (ext === '.svg') mimeType = 'image/svg+xml';
        else if (ext === '.gif') mimeType = 'image/gif';
        else if (ext === '.webp') mimeType = 'image/webp';

        reply.header('Cache-Control', 'public, max-age=31536000');
        reply.type(mimeType);
        return reply.send(fs.createReadStream(filePath));
      }
    }

    return reply.code(404).send({ error: { code: 'ICON_FILE_NOT_FOUND', message: 'Archivo de icono no encontrado.' } });
  });

  // Autenticación requerida para el resto de endpoints
  fastify.addHook('preHandler', fastify.authenticate);

  // 1. Listar todos los iconos (estándar, memes y personalizados)
  fastify.get('/api/icons', async (request, reply) => {
    const rows = await container.db
      .selectFrom('custom_icons')
      .selectAll()
      .orderBy('is_builtin', 'desc')
      .orderBy('category', 'asc')
      .orderBy('created_at', 'desc')
      .execute();

    return rows.map((r: any) => ({
      id: r.id,
      name: r.name,
      url: r.url,
      category: r.category,
      isBuiltin: Boolean(r.is_builtin),
      createdAt: r.created_at
    }));
  });

  // 2. Subir una nueva imagen de icono
  fastify.post('/api/icons', async (request, reply) => {
    const parts = request.parts();
    let iconName = '';
    let fileBuffer: Buffer | null = null;
    let originalFilename = '';

    for await (const part of parts) {
      if (part.type === 'file') {
        originalFilename = part.filename;
        fileBuffer = await part.toBuffer();
      } else {
        if (part.fieldname === 'name') {
          iconName = String(part.value || '').trim();
        }
      }
    }

    if (!fileBuffer || !originalFilename) {
      reply.code(400).send({ error: { code: 'ICON_MISSING_FILE', message: 'No se ha proporcionado ninguna imagen.' } });
      return;
    }

    const ext = path.extname(originalFilename) || '.png';
    const iconId = randomUUID();
    const targetFilename = `icon-${iconId}${ext}`;

    // Guardar archivo tanto en public/memes como en dist/memes
    const publicMemesDir = path.join(rootDir, 'apps', 'web', 'public', 'memes');
    const distMemesDir = path.join(rootDir, 'apps', 'web', 'dist', 'memes');

    if (!fs.existsSync(publicMemesDir)) fs.mkdirSync(publicMemesDir, { recursive: true });
    if (!fs.existsSync(distMemesDir)) fs.mkdirSync(distMemesDir, { recursive: true });

    fs.writeFileSync(path.join(publicMemesDir, targetFilename), fileBuffer);
    fs.writeFileSync(path.join(distMemesDir, targetFilename), fileBuffer);

    const iconUrl = `/memes/${targetFilename}`;
    const displayName = iconName || path.basename(originalFilename, ext);
    const now = new Date();

    await container.db
      .insertInto('custom_icons')
      .values({
        id: iconId,
        name: displayName,
        url: iconUrl,
        category: 'Custom',
        is_builtin: 0,
        uploaded_by: request.user!.id.toString(),
        created_at: now
      })
      .execute();

    return reply.code(201).send({
      id: iconId,
      name: displayName,
      url: iconUrl,
      category: 'Custom',
      isBuiltin: false,
      createdAt: now
    });
  });

  // 3. Eliminar icono (Permitido para memes e imágenes subidas; Prohibido para predeterminados)
  fastify.delete('/api/icons/:id', async (request, reply) => {
    const params = z.object({ id: z.string() }).parse(request.params);

    const icon = await container.db
      .selectFrom('custom_icons')
      .selectAll()
      .where('id', '=', params.id)
      .executeTakeFirst();

    if (!icon) {
      throw new NotFoundError('ICON_NOT_FOUND', 'El icono no existe.');
    }

    // Regla de negocio: Los iconos predeterminados (is_builtin = 1) no se pueden eliminar
    if (icon.is_builtin === 1 || icon.category === 'Standard') {
      reply.code(403).send({
        error: {
          code: 'ICON_BUILTIN_PROTECTED',
          message: 'Los iconos predeterminados del sistema no se pueden eliminar.'
        }
      });
      return;
    }

    // Eliminar registro de BD
    await container.db
      .deleteFrom('custom_icons')
      .where('id', '=', params.id)
      .execute();

    // Intentar borrar archivo físico
    if (icon.url && icon.url.startsWith('/memes/icon-')) {
      const filename = path.basename(icon.url);
      const publicPath = path.join(rootDir, 'apps', 'web', 'public', 'memes', filename);
      const distPath = path.join(rootDir, 'apps', 'web', 'dist', 'memes', filename);
      if (fs.existsSync(publicPath)) { try { fs.unlinkSync(publicPath); } catch {} }
      if (fs.existsSync(distPath)) { try { fs.unlinkSync(distPath); } catch {} }
    }

    return { success: true, message: 'Icono eliminado correctamente.' };
  });

  // 4. Editar datos de un icono/meme (Protegido para predeterminados)
  fastify.patch('/api/icons/:id', async (request, reply) => {
    const params = z.object({ id: z.string() }).parse(request.params);
    const body = z.object({
      name: z.string().min(1).optional(),
      category: z.string().optional()
    }).parse(request.body);

    const icon = await container.db
      .selectFrom('custom_icons')
      .selectAll()
      .where('id', '=', params.id)
      .executeTakeFirst();

    if (!icon) {
      throw new NotFoundError('ICON_NOT_FOUND', 'El icono o meme no existe.');
    }

    // Regla de negocio: Los iconos predeterminados (is_builtin = 1) no se pueden editar
    if (icon.is_builtin === 1 || icon.category === 'Standard') {
      reply.code(403).send({
        error: {
          code: 'ICON_BUILTIN_PROTECTED',
          message: 'Los iconos predeterminados del sistema no se pueden editar.'
        }
      });
      return;
    }

    const updateData: any = {};
    if (body.name !== undefined) updateData.name = body.name;
    if (body.category !== undefined) updateData.category = body.category;

    if (Object.keys(updateData).length > 0) {
      await container.db
        .updateTable('custom_icons')
        .set(updateData)
        .where('id', '=', params.id)
        .execute();
    }

    return {
      success: true,
      id: icon.id,
      name: body.name || icon.name,
      category: body.category || icon.category
    };
  });
}
