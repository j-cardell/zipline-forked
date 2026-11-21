import { useUserStore } from '@/lib/client/store/user';
import type { FilePreview } from '@/lib/db/models/file';
import { formatRootUrl } from '@/lib/url';
import { useMemo } from 'react';

export function isDbFile(file: FilePreview | File): file is FilePreview {
  return typeof globalThis.File !== 'undefined' ? !(file instanceof globalThis.File) : 'thumbnail' in file;
}

export default function useFileUrls({
  file,
  token,
  share,
}: {
  file: FilePreview | File;
  token?: string | null;
  share?: string | null;
}): {
  fileUrl: string;
  thumbnailUrl: string | null;
  viewUrl: string | null;
} {
  const user = useUserStore((state) => state.user);

  const blobUrl = useMemo(() => (isDbFile(file) ? null : URL.createObjectURL(file as File)), [file]);

  return useMemo(() => {
    if (!isDbFile(file)) return { fileUrl: blobUrl ?? '', thumbnailUrl: null, viewUrl: null };

    const thumb = file.thumbnail?.path;
    const thumbnailUrl = thumb
      ? user
        ? formatRootUrl(`/api/user/files/${encodeURIComponent(thumb)}`, 'raw', { token, share })
        : formatRootUrl('/raw', thumb, { token, share })
      : null;

    return {
      fileUrl: user
        ? formatRootUrl(`/api/user/files/${file.id}`, 'raw', { token, share })
        : formatRootUrl('/raw', file.name!, { token, share }),
      viewUrl: formatRootUrl('/view', file.name!, { token, share }),
      thumbnailUrl,
    };
  }, [token, share, blobUrl, file, user]);
}
