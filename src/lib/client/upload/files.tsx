import { Response } from '@/lib/api/response';
import i18n from '@/lib/i18n';
import { notifications } from '@mantine/notifications';
import { IconFileUpload, IconFileXFilled } from '@tabler/icons-react';
import { uploadFilesCore } from './core';
import { showUploadModal, UploadContextHandlers, UploadHeadersOptions } from './shared';

export async function uploadFiles(
  files: File[],
  {
    setProgress,
    setLoading,
    setFiles,
    clipboard,
    clearEphemeral,
    options,
    ephemeral,
    folder,
    partials,
  }: UploadContextHandlers & UploadHeadersOptions,
): Promise<{ files: Response['/api/upload']['files'] } | null> {
  setLoading(true);
  setProgress({ percent: 0, remaining: 0, speed: 0 });

  const partialCount = partials || 0;
  const batches = Math.ceil(files.length / 500);

  notifications.show({
    id: 'upload',
    title: i18n.t('upload:notifications.preparing.title', { count: files.length }),
    message:
      batches > 1
        ? i18n.t('upload:notifications.preparing.messageBatches', { count: files.length, batches })
        : i18n.t('upload:notifications.preparing.message', { count: files.length }),
    loading: true,
    autoClose: false,
  });

  try {
    const { files: uploadedFiles } = await uploadFilesCore(files, {
      options,
      ephemeral,
      folder,
      onProgress: setProgress,
    });

    notifications.update({
      id: 'upload',
      title:
        partialCount > 0
          ? i18n.t('upload:notifications.complete.titlePartial')
          : i18n.t('upload:notifications.complete.title'),
      message:
        partialCount > 0
          ? i18n.t('upload:notifications.complete.messagePartial', {
              uploaded: i18n.t('upload:notifications.complete.message', { count: files.length }),
              starting: i18n.t('upload:notifications.complete.startingPartials', { count: partialCount }),
            })
          : i18n.t('upload:notifications.complete.message', { count: files.length }),
      color: 'green',
      icon: <IconFileUpload size='1rem' />,
      autoClose: true,
      loading: false,
    });

    setFiles((prev) => prev.filter((file) => !files.includes(file)));

    if (partialCount === 0) {
      showUploadModal(uploadedFiles, {
        clipboard,
        clearEphemeral,
        showCopyAll: true,
      });
    }

    return { files: uploadedFiles };
  } catch (error) {
    notifications.update({
      id: 'upload',
      title: i18n.t('upload:notifications.error.title'),
      message: error instanceof Error ? error.message : i18n.t('upload:errors.unknown'),
      color: 'red',
      icon: <IconFileXFilled size='1rem' />,
      autoClose: true,
      loading: false,
    });

    setLoading(false);
    setProgress({ percent: 0, remaining: 0, speed: 0 });

    return null;
  } finally {
    if (!partials) {
      setLoading(false);
      setProgress({ percent: 0, remaining: 0, speed: 0 });
    }
  }
}
