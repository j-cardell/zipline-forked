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
  const thumbsDir = join(uploadsDir, '.thumbnails');

  await mkdir(thumbsDir, { recursive: true });

  const entries = await readdir(uploadsDir, { withFileTypes: true });
  const flatThumbs = entries.filter((e) => e.isFile() && e.name.startsWith('.thumbnail.'));

  if (flatThumbs.length === 0) return;

  logger.info(`found ${flatThumbs.length} flat thumbnail(s) to migrate`);

  const dbThumbnails = await prisma.thumbnail.findMany({
    select: { id: true, path: true },
  });
  const dbPaths = new Map(dbThumbnails.map((t) => [t.path, t.id]));

  for (const entry of flatThumbs) {
    const oldPath = join(uploadsDir, entry.name);
    const newPath = join(thumbsDir, entry.name);
    const newDbPath = join('.thumbnails', entry.name);

    try {
      await rename(oldPath, newPath);
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
        continue;
      }
    }

    const dbId = dbPaths.get(entry.name);
    if (dbId) {
      await prisma.thumbnail.update({
        where: { id: dbId },
        data: { path: newDbPath },
      });
    }
  }

  logger.info('thumbnail migration complete');
}
