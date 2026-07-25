import { prisma } from '@/lib/db';
import { userMiddleware } from '@/server/middleware/user';
import typedPlugin from '@/server/typedPlugin';
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
        const shares = await prisma.fileShare.findMany({
          where: {
            file: {
              userId: req.user.id,
            },
          },
          include: {
            file: {
              select: {
                id: true,
                name: true,
                type: true,
                size: true,
                thumbnail: {
                  select: {
                    path: true,
                  },
                },
              },
            },
          },
          orderBy: {
            createdAt: 'desc',
          },
        });

        return { shares };
      },
    );
  },
  { name: PATH },
);
