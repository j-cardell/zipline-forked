import { useConfig } from '@/components/ConfigProvider';
import { Response } from '@/lib/api/response';
import i18n from '@/lib/i18n';
import { notifications } from '@mantine/notifications';
import { IconFileUpload, IconFileXFilled } from '@tabler/icons-react';
import { uploadPartialFilesCore } from './core';
import { UploadHandlers, UploadHeadersOptions } from './shared';

export async function uploadPartialFiles(
  files: File[],
  {
    setProgress,
    setLoading,
    setFiles,
    options,
    ephemeral,
    config,
    folder,
  }: UploadHandlers &
    UploadHeadersOptions & {
      config: ReturnType<typeof useConfig>;
    },
): Promise<{ files: Response['/api/upload/partial']['files'] } | null> {
  setLoading(true);
  setProgress({ percent: 0, remaining: 0, speed: 0 });

  const totalFiles = files.length;
  let currentFileLabel = '';

  try {
    const { files: uploadedFiles } = await uploadPartialFilesCore(files, {
      options,
      ephemeral,
      folder,
      config: { chunks: { enabled: config.chunks.enabled, size: config.chunks.size } },
      onProgress: setProgress,
      onChunkStart: (file, chunkIndex, totalChunks) => {
        currentFileLabel =
          totalFiles > 1
            ? i18n.t('upload:notifications.partial.titleCount', {
                current: files.indexOf(file) + 1,
                total: totalFiles,
              })
            : i18n.t('upload:notifications.partial.title');

        notifications.show({
          id: 'upload-partial',
          title: currentFileLabel,
          message: file.name,
          loading: true,
          autoClose: false,
        });

        notifications.update({
          id: 'upload-partial',
          title: currentFileLabel,
          message: i18n.t('upload:notifications.partial.chunk', {
            current: chunkIndex + 1,
            total: totalChunks,
          }),
          loading: true,
          autoClose: false,
          color: 'blue',
        });
      },
      onChunkError: (file, error) => {
        notifications.update({
          id: 'upload-partial',
          title: i18n.t('upload:notifications.partial.error.title'),
          message: i18n.t('upload:notifications.partial.error.message', {
            name: file.name,
            error,
          }),
          color: 'red',
          icon: <IconFileXFilled size='1rem' />,
          autoClose: false,
          loading: false,
        });
      },
      onFileComplete: (file, fileIndex, fileUploadedFiles, isLastFile) => {
        setFiles((prev) => prev.filter((f) => f !== file));

        notifications.update({
          id: 'upload-partial',
          title: isLastFile
            ? i18n.t('upload:notifications.partial.complete.title')
            : i18n.t('upload:notifications.partial.offloaded.title'),
          message: isLastFile
            ? i18n.t('upload:notifications.partial.complete.message', { count: fileUploadedFiles.length })
            : i18n.t('upload:notifications.partial.offloaded.message', {
                name: file.name,
                current: fileIndex + 1,
                total: totalFiles,
              }),
          color: 'green',
          icon: <IconFileUpload size='1rem' />,
          autoClose: isLastFile,
          loading: false,
        });

        if (isLastFile) {
          setProgress({ percent: 100, remaining: 0, speed: 0 });
        } else {
          setProgress({ percent: 0, remaining: 0, speed: 0 });
        }
      },
    });

    return { files: uploadedFiles };
  } catch (error) {
    notifications.update({
      id: 'upload-partial',
      title: i18n.t('upload:notifications.partial.error.title'),
      message: i18n.t('upload:notifications.partial.error.message', {
        name: files[0]?.name ?? '',
        error: error instanceof Error ? error.message : i18n.t('upload:errors.unknown'),
      }),
      color: 'red',
      icon: <IconFileXFilled size='1rem' />,
      autoClose: false,
      loading: false,
    });

    setLoading(false);
    setProgress({ percent: 0, remaining: 0, speed: 0 });

    return null;
  } finally {
    setLoading(false);
    setProgress({ percent: 0, remaining: 0, speed: 0 });
  }
}
