import { ApiError } from '@/lib/api/errors';
import { db } from '@/lib/db';
import { files, fileShares, users } from '@/lib/db/schema';
import { log } from '@/lib/logger';
import { canInteract } from '@/lib/role';
import { userMiddleware } from '@/server/middleware/user';
import typedPlugin from '@/server/typedPlugin';
import { eq, or } from 'drizzle-orm';
import z from 'zod';

const logger = log('api').c('user').c('files').c('[id]').c('share');

export const PATH = '/api/user/files/:id/share/:shareId';
export default typedPlugin(
  async (server) => {
    server.delete(
      PATH,
      {
        schema: {
          description: 'Revoke a share link for a file owned by the authenticated user.',
          params: z.object({ id: z.string(), shareId: z.string() }),
          response: {
            200: z.object({ success: z.boolean() }),
          },
          tags: ['auth'],
        },
        preHandler: [userMiddleware],
      },
      async (req, res) => {
        const [file] = await db
          .select()
          .from(files)
          .leftJoin(users, eq(users.id, files.userId))
          .where(or(eq(files.id, req.params.id), eq(files.name, req.params.id)))
          .limit(1);

        if (!file) throw new ApiError(4000);
        if (file.File.userId !== req.user.id && !canInteract(req.user.role, file.User?.role ?? 'USER'))
          throw new ApiError(4000);

        const [share] = await db
          .select()
          .from(fileShares)
          .where(eq(fileShares.id, req.params.shareId))
          .limit(1);

        if (!share || share.fileId !== file.File.id) throw new ApiError(4000);

        await db.delete(fileShares).where(eq(fileShares.id, share.id));

        logger.info(`${req.user.username} revoked share ${share.id} for file ${file.File.name}`, {
          file: file.File.id,
        });

        return res.send({ success: true });
      },
    );
  },
  { name: PATH },
);
