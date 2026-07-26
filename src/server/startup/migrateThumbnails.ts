import { datasource } from '@/lib/datasource';
import { LocalDatasource } from '@/lib/datasource/Local';
import { prisma } from '@/lib/db';
import { log } from '@/lib/logger';
import { mkdir, readdir, rename, rm } from 'fs/promises';
import { join } from 'path';

const logger = log('server').c('migrate-thumbnails');

export async function migrateThumbnailsToSubfolder() {
  if (datasource.name !== 'local') return;

  const local = datasource as LocalDatasource;
  const uploadsDir = local.dir;
  const thumbsDir = local.thumbnailsDir;

  await mkdir(thumbsDir, { recursive: true });

  const entries = await readdir(uploadsDir, { withFileTypes: true });
  const flatThumbs = entries.filter((e) => e.isFile() && e.name.startsWith('.thumbnail.'));

  if (flatThumbs.length === 0) {
    logger.debug('no flat thumbnails to migrate');
    return;
  }

  logger.info(`found ${flatThumbs.length} flat thumbnail(s) to migrate`);

  for (const entry of flatThumbs) {
    const oldPath = join(uploadsDir, entry.name);
    const newPath = join(thumbsDir, entry.name);

    try {
      await rename(oldPath, newPath);
      logger.debug('moved thumbnail to .thumbnails folder', { file: entry.name });
    } catch (err: any) {
      if (err.code === 'EEXIST') {
        logger.warn('thumbnail already exists in subfolder, removing old', { file: entry.name });
        try {
          await rm(oldPath);
        } catch (rmErr: any) {
          logger.error('failed to remove old flat thumbnail', { file: entry.name, error: rmErr.message });
        }
      } else {
        logger.error('failed to move thumbnail', { file: entry.name, error: err.message });
      }
    }
  }

  // DB paths remain flat (.thumbnail.<id>.<format>); LocalDatasource resolves them to .thumbnails/.
  const dbThumbnails = await prisma.thumbnail.findMany({
    select: { id: true, path: true },
  });
  const normalizedPaths = dbThumbnails.filter((t) => t.path.startsWith('.thumbnails/'));

  for (const thumb of normalizedPaths) {
    const flatPath = thumb.path.replace('.thumbnails/', '');
    await prisma.thumbnail.update({
      where: { id: thumb.id },
      data: { path: flatPath },
    });
    logger.debug('normalized thumbnail path', { id: thumb.id, from: thumb.path, to: flatPath });
  }

  logger.info('thumbnail migration complete');
}
