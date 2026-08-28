import { db } from '@/lib/db';
import { files, fileShares, thumbnails } from '@/lib/db/schema';
import { userMiddleware } from '@/server/middleware/user';
import typedPlugin from '@/server/typedPlugin';
import { desc, eq } from 'drizzle-orm';
import z from 'zod';

export type ApiUserSharesResponse = {
  shares: {
    id: string;
    token: string;
    expiresAt: string | null;
    maxViews: number | null;
    views: number;
    createdAt: string;
    file: {
      id: string;
      name: string;
      type: string;
      size: number;
      thumbnail: { path: string } | null;
    };
  }[];
};

export const PATH = '/api/user/shares';
export default typedPlugin(
  async (server) => {
    server.get(
      PATH,
      {
        schema: {
          description: 'List all active share links for files owned by the authenticated user.',
          response: {
            200: z.object({
              shares: z.array(
                z.object({
                  id: z.string(),
                  token: z.string(),
                  expiresAt: z.union([z.string(), z.date()]).nullable(),
                  maxViews: z.number().nullable(),
                  views: z.number(),
                  createdAt: z.union([z.string(), z.date()]),
                  file: z.object({
                    id: z.string(),
                    name: z.string(),
                    type: z.string(),
                    size: z.number(),
                    thumbnail: z.object({ path: z.string() }).nullable(),
                  }),
                }),
              ),
            }),
          },
          tags: ['auth'],
        },
        preHandler: [userMiddleware],
      },
      async (req) => {
        const rows = await db
          .select({
            share: {
              id: fileShares.id,
              token: fileShares.token,
              expiresAt: fileShares.expiresAt,
              maxViews: fileShares.maxViews,
              views: fileShares.views,
              createdAt: fileShares.createdAt,
            },
            file: {
              id: files.id,
              name: files.name,
              type: files.type,
              size: files.size,
              thumbnailPath: thumbnails.path,
            },
          })
          .from(fileShares)
          .innerJoin(files, eq(files.id, fileShares.fileId))
          .leftJoin(thumbnails, eq(thumbnails.fileId, files.id))
          .where(eq(files.userId, req.user.id))
          .orderBy(desc(fileShares.createdAt));

        const shares = rows.map((row) => ({
          ...row.share,
          file: {
            id: row.file.id,
            name: row.file.name,
            type: row.file.type,
            size: row.file.size,
            thumbnail: row.file.thumbnailPath ? { path: row.file.thumbnailPath } : null,
          },
        }));

        return { shares };
      },
    );
  },
  { name: PATH },
);
