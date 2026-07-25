import { bytes } from '@/lib/bytes';
import { config, reloadSettings } from '@/lib/config';
import { getDatasource } from '@/lib/datasource';
import { prisma } from '@/lib/db';
import { guess } from '@/lib/mimes';
import { statSync } from 'fs';
import { mkdir, readdir, rm } from 'fs/promises';
import { join, parse, resolve } from 'path';

export type ImportDirResult = {
  inserted: number;
  imported: number;
  deleted: number;
  totalSize: number;
  skipped: number;
  files: string[];
  errors: string[];
};

export async function runImportDir(
  directory: string,
  {
    id,
    folder,
    skipDb,
    deleteSource,
  }: {
    id?: string;
    folder?: string;
    skipDb?: boolean;
    deleteSource?: boolean;
  },
): Promise<ImportDirResult> {
  const fullPath = resolve(directory);
  if (!statSync(fullPath).isDirectory()) throw new Error('Not a directory: ' + directory);

  await reloadSettings();

  let userId: string;

  if (id) {
    userId = id;
  } else {
    const user = await prisma.user.findFirst({
      where: { username: 'administrator', role: 'SUPERADMIN' },
    });

    if (!user) {
      const firstSuperAdmin = await prisma.user.findFirst({
        where: {
          role: 'SUPERADMIN',
        },
      });

      if (!firstSuperAdmin) throw new Error('No superadmin found or "administrator" user.');

      userId = firstSuperAdmin.id;
    } else {
      userId = user.id;
    }
  }

  if (folder) {
    const exists = await prisma.folder.findFirst({
      where: {
        id: folder,
        userId,
      },
    });

    if (!exists) throw new Error('Folder not found: ' + folder);
  }

  const dirFiles = await readdir(fullPath);
  const data = [];
  const files = [];
  const errors = [];

  for (let i = 0; i !== dirFiles.length; ++i) {
    const info = parse(dirFiles[i]);
    if (info.base.startsWith('.thumbnail')) continue;

    const filePath = join(fullPath, dirFiles[i]);
    const { size } = statSync(filePath);
    const mime = await guess(info.ext.replace('.', ''));

    data.push({
      name: info.base,
      type: mime,
      size,
      userId,
      ...(folder ? { folderId: folder } : {}),
    });
    files.push(filePath);
  }

  let inserted = 0;

  if (!skipDb && data.length > 0) {
    const result = await prisma.file.createMany({
      data,
    });
    inserted = result.count;
  }

  const totalSize = data.reduce((acc, file) => acc + file.size, 0);
  let imported = 0;
  let deleted = 0;

  if (config.datasource.type === 'local')
    await mkdir(config.datasource.local!.directory, { recursive: true });

  const datasource = getDatasource(config);
  if (!datasource) throw new Error('No datasource configured');

  for (let i = 0; i !== data.length; ++i) {
    if (!data[i]) continue;

    try {
      await datasource.put(data[i].name, files[i], {
        mimetype: data[i].type ?? 'application/octet-stream',
        noDelete: true,
      });
      ++imported;

      if (deleteSource) {
        try {
          await rm(files[i], { force: true });
          ++deleted;
        } catch (err: any) {
          errors.push(`Imported ${data[i].name} but failed to delete source: ${err.message}`);
        }
      }
    } catch (err: any) {
      errors.push(`Failed to upload ${data[i].name}: ${err.message}`);
    }
  }

  return {
    inserted,
    imported,
    deleted,
    totalSize,
    skipped: dirFiles.length - data.length,
    files: data.map((d) => d.name),
    errors,
  };
}

export async function importDir(
  directory: string,
  options: { id?: string; folder?: string; skipDb?: boolean },
) {
  try {
    const result = await runImportDir(directory, options);
    console.log(`Inserted ${result.inserted} files into the database.`);
    console.log(`Imported ${result.imported} files (${bytes(result.totalSize)}).`);
    if (result.errors.length) {
      console.error('Errors:', result.errors.join('\n'));
      process.exit(1);
    }
    process.exit(0);
  } catch (err: any) {
    console.error(err.message);
    process.exit(1);
  }
}
