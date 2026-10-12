import { Response } from '@/lib/api/response';
import { bytes } from '@/lib/bytes';
import i18n from '@/lib/i18n';
import { applyUploadHeaders, handleUploadResponse, UploadHeadersOptions } from './shared';
import { UploadProgress } from './useProgress';

const FILES_PER_REQUEST = 500;

function progressTracker() {
  const alpha = 0.2;
  let lastLoaded = 0;
  let lastTime = Date.now();
  let resSpeed = 0;

  return (loaded: number, total: number): UploadProgress => {
    const now = Date.now();
    const timeDiff = (now - lastTime) / 1000;

    if (timeDiff > 0) {
      const loadedDiff = loaded - lastLoaded;
      const speed = loadedDiff / timeDiff;
      resSpeed = resSpeed === 0 ? speed : speed * alpha + resSpeed * (1 - alpha);
      lastLoaded = loaded;
      lastTime = now;
    }

    const percent = Math.round((loaded / total) * 100);
    const remainingBytes = total - loaded;
    const remaining = resSpeed > 0 ? remainingBytes / resSpeed : 0;

    return { percent, speed: resSpeed, remaining };
  };
}

type UploadFilesCoreOptions = UploadHeadersOptions & {
  onProgress?: (progress: UploadProgress) => void;
};

export async function uploadFilesCore(
  files: File[],
  { options, ephemeral, folder, onProgress }: UploadFilesCoreOptions,
): Promise<{ files: Response['/api/upload']['files'] }> {
  const aggBytes = files.reduce((acc, file) => acc + file.size, 0);
  const tracker = progressTracker();
  let lastUpdate = 0;

  const uploadBatch = async (batchFiles: File[], completedBytes: number) =>
    new Promise<Response['/api/upload']>((resolve, reject) => {
      const body = new FormData();
      const batchBytes = batchFiles.reduce((acc, file) => acc + file.size, 0);

      for (const file of batchFiles) body.append('file', file);

      const req = new XMLHttpRequest();

      req.upload.addEventListener('progress', (e) => {
        if (!e.lengthComputable) return;
        const loaded = completedBytes + Math.min(batchBytes, e.loaded);
        const stats = tracker(loaded, aggBytes);
        const now = Date.now();
        if (now - lastUpdate > 250 || e.loaded === e.total) {
          onProgress?.(stats);
          lastUpdate = now;
        }
      });

      req.addEventListener(
        'load',
        () => {
          const { data: res, error } = handleUploadResponse<Response['/api/upload']>(req);
          if (error || !res) return reject(new Error(error?.error ?? i18n.t('upload:errors.unknown')));
          resolve(res);
        },
        false,
      );

      req.addEventListener('error', () => reject(new Error(i18n.t('upload:errors.network'))));

      req.open('POST', '/api/upload');
      applyUploadHeaders(req, { options, ephemeral, folder });
      req.send(body);
    });

  let completedBytes = 0;
  const uploadedFiles: Response['/api/upload']['files'] = [];

  for (let start = 0, batchIndex = 0; start < files.length; start += FILES_PER_REQUEST, batchIndex++) {
    const batchFiles = files.slice(start, start + FILES_PER_REQUEST);
    const batchBytes = batchFiles.reduce((acc, file) => acc + file.size, 0);
    const res = await uploadBatch(batchFiles, completedBytes);
    uploadedFiles.push(...res.files);
    completedBytes += batchBytes;
    onProgress?.(tracker(completedBytes, aggBytes));
  }

  return { files: uploadedFiles };
}

function partialProgressTracker(size: number) {
  const alpha = 0.2;
  let totalBytes = 0;
  let resSpeed = 0;
  const startTime = Date.now();

  return {
    update: (loaded: number): UploadProgress => {
      const now = Date.now();
      const lastLoaded = totalBytes + loaded;
      const timeDiff = (now - startTime) / 1000;

      if (timeDiff > 0) {
        const speed = lastLoaded / timeDiff;
        resSpeed = resSpeed === 0 ? speed : speed * alpha + resSpeed * (1 - alpha);
      }

      const percent = Math.round((lastLoaded / size) * 100);
      const remainingBytes = size - lastLoaded;
      const remaining = resSpeed > 0 ? remainingBytes / resSpeed : 0;

      return {
        percent: Math.min(percent, 99),
        speed: resSpeed,
        remaining: Math.max(remaining, 0),
      };
    },

    finish: (chunkSize: number) => {
      totalBytes += chunkSize;
    },
  };
}

type UploadPartialFilesCoreOptions = UploadHeadersOptions & {
  config: { chunks: { enabled: boolean; size: string } };
  onProgress?: (progress: UploadProgress) => void;
  onChunkStart?: (file: File, chunkIndex: number, totalChunks: number) => void;
  onChunkError?: (file: File, error: string) => void;
  onFileComplete?: (
    file: File,
    fileIndex: number,
    uploadedFiles: Response['/api/upload/partial']['files'],
    isLastFile: boolean,
  ) => void;
};

export async function uploadPartialFilesCore(
  files: File[],
  {
    options,
    ephemeral,
    folder,
    config,
    onProgress,
    onChunkStart,
    onChunkError,
    onFileComplete,
  }: UploadPartialFilesCoreOptions,
): Promise<{ files: Response['/api/upload/partial']['files'] }> {
  const chunkSize = bytes(config.chunks.size);
  const uploadedFiles: Response['/api/upload/partial']['files'] = [];

  for (let i = 0; i < files.length; i++) {
    const file = files[i];
    const tracker = partialProgressTracker(file.size);
    let lastUpdate = 0;

    const nChunks = Math.ceil(file.size / chunkSize);
    const chunks = Array.from({ length: nChunks }, (_, j) => {
      const start = j * chunkSize;
      const end = Math.min(start + chunkSize, file.size);
      return {
        blob: file.slice(start, end),
        start,
        end: end - 1,
      };
    });

    let ready = true;
    let token: string | undefined;
    let failed = false;

    for (let j = 0; j < chunks.length; j++) {
      while (!ready && !failed) {
        await new Promise((resolve) => setTimeout(resolve, 100));
      }

      if (failed) break;

      onChunkStart?.(file, j, chunks.length);

      const body = new FormData();
      body.append('file', chunks[j].blob);

      const req = new XMLHttpRequest();

      req.upload.addEventListener('progress', (e) => {
        if (!e.lengthComputable) return;
        const stats = tracker.update(e.loaded);
        const now = Date.now();
        if (now - lastUpdate > 250) {
          onProgress?.(stats);
          lastUpdate = now;
        }
      });

      req.addEventListener(
        'load',
        () => {
          const { data: res, error } = handleUploadResponse<Response['/api/upload/partial']>(req);

          if (error || !res) {
            failed = true;
            onChunkError?.(file, error?.error ?? i18n.t('upload:errors.unknown'));
            onProgress?.({ percent: 0, remaining: 0, speed: 0 });
            return;
          }

          token = res.partialToken;

          if (j === chunks.length - 1) {
            uploadedFiles.push(...res.files);
            const isLastFile = i === files.length - 1;
            onFileComplete?.(file, i, res.files, isLastFile);

            if (isLastFile) {
              onProgress?.({ percent: 100, remaining: 0, speed: 0 });
              setTimeout(() => onProgress?.({ percent: 0, remaining: 0, speed: 0 }), 1000);
            } else {
              onProgress?.({ percent: 0, remaining: 0, speed: 0 });
            }
          }

          tracker.finish(chunks[j].blob.size);
          ready = true;
        },
        false,
      );

      req.open('POST', '/api/upload/partial');
      applyUploadHeaders(req, { options, ephemeral, folder });

      token && req.setRequestHeader('x-zipline-p-token', token);
      req.setRequestHeader('x-zipline-p-filename', encodeURIComponent(file.name));
      req.setRequestHeader('x-zipline-p-lastchunk', j === chunks.length - 1 ? 'true' : 'false');
      req.setRequestHeader('x-zipline-p-content-type', file.type);
      req.setRequestHeader('x-zipline-p-content-length', file.size.toString());
      req.setRequestHeader('content-range', `bytes ${chunks[j].start}-${chunks[j].end}/${file.size}`);

      req.send(body);
      ready = false;
    }

    while (!ready && !failed) {
      await new Promise((resolve) => setTimeout(resolve, 100));
    }

    if (failed) throw new Error(i18n.t('upload:errors.unknown'));
  }

  return { files: uploadedFiles };
}
