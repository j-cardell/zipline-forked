import { useConfig } from '@/components/ConfigProvider';
import FolderSelectModal from '@/components/folders/FolderSelectModal';
import { bytes } from '@/lib/bytes';
import { useUploadOptionsStore } from '@/lib/client/store/uploadOptions';
import { uploadFiles } from '@/lib/client/upload/files';
import { uploadPartialFiles } from '@/lib/client/upload/partial';
import { UploadProgress } from '@/lib/client/upload/useProgress';
import { Box, Center, Stack, Text, Title } from '@mantine/core';
import { useClipboard } from '@mantine/hooks';
import { modals } from '@mantine/modals';
import { IconUpload } from '@tabler/icons-react';
import { useCallback, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useShallow } from 'zustand/shallow';
import { useSWRConfig } from 'swr';

function promptForFolder(): Promise<string | undefined | null> {
  return new Promise((resolve) => {
    const id = modals.open({
      title: 'Select folder',
      size: 'lg',
      centered: true,
      children: (
        <FolderSelectModal
          onSelect={(folderId) => {
            resolve(folderId);
            modals.close(id);
          }}
          onCancel={() => {
            resolve(null);
            modals.close(id);
          }}
        />
      ),
      onClose: () => resolve(null),
    });
  });
}

export default function DropUploadOverlay({
  folderId,
  onUploaded,
}: {
  folderId?: string | null;
  onUploaded?: () => void;
}) {
  const { t } = useTranslation('upload');
  const config = useConfig();
  const clipboard = useClipboard();
  const { mutate } = useSWRConfig();
  const [options, ephemeral, clearEphemeral] = useUploadOptionsStore(
    useShallow((state) => [state.options, state.ephemeral, state.clearEphemeral]),
  );

  const [dragging, setDragging] = useState(false);
  const [_counter, setCounter] = useState(0);
  const [progress, setProgress] = useState<UploadProgress>({ percent: 0, remaining: 0, speed: 0 });
  const [loading, setLoading] = useState(false);
  const [_files, setFiles] = useState<File[]>([]);

  const doUpload = useCallback(
    async (droppedFiles: File[], targetFolder: string | null | undefined) => {
      const folder = targetFolder ?? undefined;

      const maxBytes = config.chunks.enabled && bytes(config.chunks.max);
      const partialUploads: File[] = maxBytes ? droppedFiles.filter((file) => file.size >= maxBytes) : [];
      const normalUploads: File[] = maxBytes
        ? droppedFiles.filter((file) => file.size < maxBytes)
        : droppedFiles;

      try {
        if (normalUploads.length > 0) {
          await uploadFiles(normalUploads, {
            setFiles,
            setLoading,
            setProgress,
            clipboard,
            clearEphemeral,
            options,
            ephemeral,
            folder,
          });
        }

        if (partialUploads.length > 0) {
          await uploadPartialFiles(partialUploads, {
            setFiles,
            setLoading,
            setProgress,
            options,
            ephemeral,
            config,
            folder,
          });
        }

        onUploaded?.();
      } finally {
        mutate(() => true, undefined, { revalidate: true });
      }
    },
    [config, clipboard, clearEphemeral, ephemeral, mutate, onUploaded, options],
  );

  useEffect(() => {
    const handleDragEnter = (e: DragEvent) => {
      e.preventDefault();
      setCounter((c) => c + 1);
      if (e.dataTransfer?.types.includes('Files')) setDragging(true);
    };

    const handleDragOver = (e: DragEvent) => {
      e.preventDefault();
      if (e.dataTransfer) e.dataTransfer.dropEffect = 'copy';
    };

    const handleDragLeave = (e: DragEvent) => {
      e.preventDefault();
      setCounter((c) => {
        const next = c - 1;
        if (next <= 0) setDragging(false);
        return next;
      });
    };

    const handleDrop = async (e: DragEvent) => {
      e.preventDefault();
      setDragging(false);
      setCounter(0);

      const droppedFiles = Array.from(e.dataTransfer?.files ?? []);
      if (droppedFiles.length === 0) return;

      const targetFolder = folderId === null ? await promptForFolder() : folderId;
      if (targetFolder === null) return;

      await doUpload(droppedFiles, targetFolder);
    };

    const handlePaste = async (e: ClipboardEvent) => {
      const items = Array.from(e.clipboardData?.items ?? []);
      const files = items
        .filter((item) => item.kind === 'file')
        .map((item) => item.getAsFile())
        .filter((file): file is File => file !== null);

      if (files.length === 0) return;

      e.preventDefault();
      const targetFolder = folderId === null ? await promptForFolder() : folderId;
      if (targetFolder === null) return;

      await doUpload(files, targetFolder);
    };

    window.addEventListener('dragenter', handleDragEnter);
    window.addEventListener('dragover', handleDragOver);
    window.addEventListener('dragleave', handleDragLeave);
    window.addEventListener('drop', handleDrop);
    window.addEventListener('paste', handlePaste);

    return () => {
      window.removeEventListener('dragenter', handleDragEnter);
      window.removeEventListener('dragover', handleDragOver);
      window.removeEventListener('dragleave', handleDragLeave);
      window.removeEventListener('drop', handleDrop);
      window.removeEventListener('paste', handlePaste);
    };
  }, [doUpload, folderId]);

  if (!dragging) return null;

  return (
    <Box
      pos='fixed'
      inset={0}
      style={{
        zIndex: 1000,
        background: 'rgba(0, 0, 0, 0.5)',
        backdropFilter: 'blur(2px)',
      }}
      onDragOver={(e) => e.preventDefault()}
      onDragLeave={(e) => {
        if (
          !e.relatedTarget ||
          !(e.relatedTarget instanceof Node) ||
          !e.currentTarget.contains(e.relatedTarget)
        ) {
          setDragging(false);
          setCounter(0);
        }
      }}
    >
      <Center h='100%'>
        <Stack align='center'>
          <IconUpload size='4rem' />
          <Title order={2}>{t('dropOverlay.dropToUpload')}</Title>
          {loading && (
            <Text size='sm' c='dimmed'>
              {progress.percent}%
            </Text>
          )}
          <Text size='sm' c='dimmed'>
            {folderId ? t('dropOverlay.toFolder') : t('dropOverlay.chooseAfterDrop')}
          </Text>
        </Stack>
      </Center>
    </Box>
  );
}
