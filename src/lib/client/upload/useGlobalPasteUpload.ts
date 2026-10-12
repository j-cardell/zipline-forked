import { bytes } from '@/lib/bytes';
import { SafeConfig } from '@/lib/config/safe';
import { UploadOptionsStore } from '@/lib/client/store/uploadOptions';
import { uploadFilesCore, uploadPartialFilesCore } from '@/lib/client/upload/core';
import { useCallback, useEffect, useRef } from 'react';
import { useLocation } from 'react-router-dom';

function isTextField(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false;
  const tag = target.tagName.toLowerCase();
  return tag === 'input' || tag === 'textarea' || target.isContentEditable;
}

function isAllowedPath(path: string): boolean {
  return (
    path.startsWith('/dashboard') && !path.startsWith('/dashboard/admin') && path !== '/dashboard/settings'
  );
}

function filesFromClipboard(data: DataTransfer): File[] {
  const files: File[] = [];

  for (const item of Array.from(data.items)) {
    const file = item.getAsFile();
    if (file) files.push(file);
  }

  if (files.length > 0) return files;

  const text = data.getData('text/plain');
  if (!text) return [];

  return [new File([text], 'pasted-snippet.txt', { type: 'text/plain' })];
}

function partitionByChunkSize(files: File[], chunkLimit: number): { normals: File[]; partials: File[] } {
  return {
    normals: files.filter((file) => file.size < chunkLimit),
    partials: files.filter((file) => file.size >= chunkLimit),
  };
}

export function useGlobalPasteUpload({
  config,
  options,
  ephemeral,
}: {
  config: SafeConfig;
  options: UploadOptionsStore['options'];
  ephemeral: UploadOptionsStore['ephemeral'];
}) {
  const location = useLocation();
  const uploadingRef = useRef(false);

  const handlePaste = useCallback(
    async (e: ClipboardEvent) => {
      if (!isAllowedPath(location.pathname)) return;
      if (!e.clipboardData) return;
      if (isTextField(e.target)) return;

      const files = filesFromClipboard(e.clipboardData);
      if (files.length === 0) return;

      e.preventDefault();
      if (uploadingRef.current) return;
      uploadingRef.current = true;

      let normals = files;
      let partials: File[] = [];
      if (config.chunks.enabled) {
        ({ normals, partials } = partitionByChunkSize(files, bytes(config.chunks.max)));
      }

      try {
        if (normals.length > 0) {
          await uploadFilesCore(normals, {
            options,
            ephemeral,
            onProgress: () => {},
          });
        }

        if (partials.length > 0) {
          await uploadPartialFilesCore(partials, {
            options,
            ephemeral,
            config: { chunks: { enabled: config.chunks.enabled, size: config.chunks.size } },
            onProgress: () => {},
          });
        }
      } finally {
        uploadingRef.current = false;
      }
    },
    [config, ephemeral, location.pathname, options],
  );

  useEffect(() => {
    document.addEventListener('paste', handlePaste);
    return () => document.removeEventListener('paste', handlePaste);
  }, [handlePaste]);
}
