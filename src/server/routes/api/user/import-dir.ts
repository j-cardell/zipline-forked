import { runImportDir } from '@/ctl/commands/import-dir';
import { config } from '@/lib/config';
import { userMiddleware } from '@/server/middleware/user';
import typedPlugin from '@/server/typedPlugin';
import z from 'zod';

export type ApiUserImportDirResponse = {
  directory: string;
  inserted: number;
  imported: number;
  totalSize: number;
  skipped: number;
  files: string[];
  errors: string[];
};

export const PATH = '/api/user/import-dir';
export default typedPlugin(
  async (server) => {
    server.post(
      PATH,
      {
        schema: {
          description: 'Import files from a directory on the server filesystem into Zipline.',
          body: z.object({
            directory: z.string().optional(),
            folder: z.string().optional(),
          }),
          response: {
            200: z.object({
              directory: z.string(),
              inserted: z.number(),
              imported: z.number(),
              totalSize: z.number(),
              skipped: z.number(),
              files: z.array(z.string()),
              errors: z.array(z.string()),
            }),
          },
          tags: ['auth'],
        },
        preHandler: [userMiddleware],
      },
      async (req, res) => {
        const defaultDir = `${config.datasource.type === 'local' ? config.datasource.local!.directory : '/tmp'}/_manual_uploads`;
        const directory = req.body.directory ?? defaultDir;

        const result = await runImportDir(directory, {
          id: req.user.id,
          folder: req.body.folder,
        });

        return res.send({
          directory,
          ...result,
        });
      },
    );
  },
  { name: PATH },
);
