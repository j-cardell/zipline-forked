import { bytes } from '@/lib/bytes';
import { config, reloadSettings } from '@/lib/config';
import { getDatasource } from '@/lib/datasource';
import { db } from '@/lib/db';
import { getOwnedFolder } from '@/lib/db/models/folder';
import { files, users } from '@/lib/db/schema';
import { guess } from '@/lib/mimes';
import { eq } from 'drizzle-orm';
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
    const [candidate] = await db
      .select({ id: users.id, username: users.username, role: users.role })
      .from(users)
      .where(eq(users.username, 'administrator'))
      .limit(1);
    const user = candidate?.role === 'SUPERADMIN' ? candidate : null;

    if (!user) {
      const [firstSuperAdmin] = await db
        .select({ id: users.id, username: users.username, role: users.role })
        .from(users)
        .where(eq(users.role, 'SUPERADMIN'))
        .limit(1);

      if (!firstSuperAdmin) throw new Error('No superadmin found or "administrator" user.');

      userId = firstSuperAdmin.id;
    } else {
      userId = user.id;
    }
  }

  if (folder) {
    const exists = await getOwnedFolder(folder, userId);

    if (!exists) throw new Error('Folder not found: ' + folder);
  }

  const dirents = await readdir(fullPath);
  const filenames = dirents.filter((filename) => !parse(filename).base.startsWith('.thumbnail'));
  const data = [];
  const filePaths = [];
  const errors = [];

  for (let i = 0; i !== filenames.length; ++i) {
    const info = parse(filenames[i]);

    const filePath = join(fullPath, filenames[i]);
    const { size } = statSync(filePath);
    const mime = await guess(info.ext.replace('.', ''));

    data.push({
      name: info.base,
      type: mime,
      size,
      userId,
      ...(folder ? { folderId: folder } : {}),
    });
    filePaths.push(filePath);
  }

  let inserted = 0;
  let created: { id: string }[] = [];

  if (!skipDb && data.length) {
    const insertedFiles = await db.insert(files).values(data).returning({ id: files.id });
    created = insertedFiles;
    inserted = insertedFiles.length;
  }
  console.log(`Inserted ${created.length} files into the database.`);

  const totalSize = data.reduce((acc, file) => acc + file.size, 0);
  let imported = 0;
  let deleted = 0;
  let completed = 0;

  if (config.datasource.type === 'local')
    await mkdir(config.datasource.local!.directory, { recursive: true });

  const datasource = getDatasource(config);
  if (!datasource) throw new Error('No datasource configured');

  for (let i = 0; i !== data.length; ++i) {
    if (!data[i]) continue;

    try {
      const start = process.hrtime();

      await datasource.put(data[i].name, filePaths[i], {
        mimetype: data[i].type ?? 'application/octet-stream',
        noDelete: true,
      });

      const diff = process.hrtime(start);
      const time = diff[0] * 1e9 + diff[1];
      const timeStr = time > 1e9 ? `${(time / 1e9).toFixed(2)}s` : `${(time / 1e6).toFixed(2)}ms`;
      const uploadSpeed = (data[i].size / time) * 1e9;
      const uploadSpeedStr =
        uploadSpeed > 1e9
          ? `${(uploadSpeed / 1e9).toFixed(2)} GB/s`
          : `${(uploadSpeed / 1e6).toFixed(2)} MB/s`;
      completed += data[i].size;

      console.log(
        `Uploaded ${data[i].name} in ${timeStr} (${bytes(data[i].size)}) ${i + 1}/${filenames.length} ${bytes(completed)}/${bytes(totalSize)} ${uploadSpeedStr}`,
      );

      ++imported;

      if (deleteSource) {
        try {
          await rm(filePaths[i], { force: true });
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
    skipped: dirents.length - data.length,
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
