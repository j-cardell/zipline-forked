import Asciinema from '@/components/render/Asciinema';
import Pdf from '@/components/render/Pdf';
import Render from '@/components/render/Render';
import { renderMode } from '@/components/render/renderMode';
import { useSettingsStore } from '@/lib/client/store/settings';
import type { File as DbFile } from '@/lib/db/models/file';
import {
  Box,
  Center,
  Loader,
  LoadingOverlay,
  Image as MantineImage,
  Paper,
  Stack,
  Text,
} from '@mantine/core';
import type { Icon } from '@tabler/icons-react';
import { IconPlayerPlay, IconShieldLockFilled } from '@tabler/icons-react';
import { useEffect, useState } from 'react';
import fileIcon from '../fileIcon';
import FileZoomModal from './FileZoomModal';
import FullscreenFrame from './FullscreenFrame';
import useFileContents from './useFileContent';
import useFileUrls, { isDbFile } from './useFileUrls';

function isClickOnVideoLetterbox(e: React.MouseEvent<HTMLVideoElement>): boolean {
  const video = e.currentTarget;
  if (!video.videoWidth || !video.videoHeight) return false;

  const rect = video.getBoundingClientRect();
  const videoRatio = video.videoWidth / video.videoHeight;
  const boxRatio = rect.width / rect.height;

  let contentWidth: number;
  let contentHeight: number;
  let contentLeft: number;
  let contentTop: number;

  if (videoRatio > boxRatio) {
    contentWidth = rect.width;
    contentHeight = rect.width / videoRatio;
    contentLeft = rect.left;
    contentTop = rect.top + (rect.height - contentHeight) / 2;
  } else {
    contentHeight = rect.height;
    contentWidth = rect.height * videoRatio;
    contentLeft = rect.left + (rect.width - contentWidth) / 2;
    contentTop = rect.top;
  }

  return (
    e.clientX < contentLeft ||
    e.clientX > contentLeft + contentWidth ||
    e.clientY < contentTop ||
    e.clientY > contentTop + contentHeight
  );
}

function isClickOnImageLetterbox(e: React.MouseEvent<HTMLImageElement>): boolean {
  const img = e.currentTarget;
  if (!img.naturalWidth || !img.naturalHeight) return false;

  const rect = img.getBoundingClientRect();
  const imgRatio = img.naturalWidth / img.naturalHeight;
  const boxRatio = rect.width / rect.height;

  let contentWidth: number;
  let contentHeight: number;
  let contentLeft: number;
  let contentTop: number;

  if (imgRatio > boxRatio) {
    contentWidth = rect.width;
    contentHeight = rect.width / imgRatio;
    contentLeft = rect.left;
    contentTop = rect.top + (rect.height - contentHeight) / 2;
  } else {
    contentHeight = rect.height;
    contentWidth = rect.height * imgRatio;
    contentLeft = rect.left + (rect.width - contentWidth) / 2;
    contentTop = rect.top;
  }

  return (
    e.clientX < contentLeft ||
    e.clientX > contentLeft + contentWidth ||
    e.clientY < contentTop ||
    e.clientY > contentTop + contentHeight
  );
}

export function Placeholder({ text, Icon, ...props }: { text: string; Icon: Icon; onClick?: () => void }) {
  return (
    <Center py='xs' style={{ height: '100%', width: '100%', cursor: 'pointer' }} {...props}>
      <Stack align='center'>
        <Icon size='4rem' stroke={2} style={{ filter: 'drop-shadow(0 0 10px rgba(0, 0, 0, 0.9))' }} />
        <Text size='md' ta='center'>
          {text}
        </Text>
      </Stack>
    </Center>
  );
}

function FullscreenSizedMedia({ children }: { children: React.ReactNode }) {
  return (
    <Box
      style={{
        flex: 1,
        alignSelf: 'stretch',
        minHeight: 0,
        width: '100%',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
      }}
    >
      {children}
    </Box>
  );
}

export default function DashboardFileType({
  file,
  show,
  token,
  share,
  code,
  allowZoom,
  fullscreen,
  scrollParent,
  compact,
  fill,
}: {
  file: DbFile | File;
  show?: boolean;
  token?: string | null;
  share?: string | null;
  code?: boolean;
  allowZoom?: boolean;
  fullscreen?: boolean;
  scrollParent?: HTMLElement | null;
  compact?: boolean;
  fill?: boolean;
}) {
  const disableMediaPreview = useSettingsStore((state) => state.settings.disableMediaPreview);
  const mediaAutoMuted = useSettingsStore((state) => state.settings.mediaAutoMuted);

  const { fileUrl, thumbnailUrl, viewUrl } = useFileUrls({ file, token, share });
  const db = isDbFile(file) ? file : null;

  const extension = file.name.split('.').pop() || '';
  const renderIn = renderMode(extension);
  const type = code ? 'text' : file.type.split('/')[0];

  const fileContent = useFileContents({ enabled: type === 'text', file, fileUrl });
  const [zoomOpen, setZoomOpen] = useState(false);

  useEffect(() => {
    if (zoomOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = 'auto';
    }

    return () => {
      document.body.style.overflow = 'auto';
    };
  }, [zoomOpen]);

  if (disableMediaPreview && !show) {
    return <Placeholder text={`Click to view file ${file.name}`} Icon={fileIcon(file.type)} />;
  }

  if (db?.password === true && !show) {
    return <Placeholder text={`Click to view protected ${file.name}`} Icon={IconShieldLockFilled} />;
  }

  if (db?.password === true && show) {
    return (
      <Paper withBorder p='xs' style={{ cursor: 'pointer' }}>
        <Placeholder
          text={`Click to view protected ${file.name}`}
          Icon={IconShieldLockFilled}
          onClick={() => window.open(viewUrl!)}
        />
      </Paper>
    );
  }

  const isAsciicast = file.type === 'application/x-asciicast' || file.name.endsWith('.cast');

  if (type === 'video') {
    if (!fileUrl) return <Loader />;

    if (!show) {
      if (thumbnailUrl) {
        return (
          <Box pos='relative' style={fill ? { width: '100%', height: '100%' } : undefined}>
            <MantineImage
              src={thumbnailUrl}
              alt={file.name || 'Video thumbnail'}
              fit={fill ? 'cover' : 'contain'}
              style={fill ? { width: '100%', height: '100%' } : { width: '100%' }}
            />
            <Center pos='absolute' inset={0}>
              <IconPlayerPlay
                size={compact ? '2rem' : '4rem'}
                stroke={3}
                style={{ filter: 'drop-shadow(0 0 10px rgba(0, 0, 0, 0.9))' }}
              />
            </Center>
          </Box>
        );
      }

      return <Placeholder text={`Click to play video ${file.name}`} Icon={fileIcon(file.type)} />;
    }

    const video = (
      <video
        onClick={(e) => {
          if (!isClickOnVideoLetterbox(e)) {
            e.stopPropagation();
          }
        }}
        width={fullscreen ? undefined : '100%'}
        autoPlay
        muted={mediaAutoMuted}
        controls
        src={fileUrl}
        style={{
          cursor: 'pointer',
          objectFit: 'contain',
          ...(fullscreen
            ? { maxWidth: '100%', maxHeight: '100%', width: 'auto', height: 'auto' }
            : { maxWidth: '85vw', maxHeight: '85vh', width: '100%' }),
        }}
      />
    );

    return fullscreen ? <FullscreenSizedMedia>{video}</FullscreenSizedMedia> : video;
  }

  if (type === 'image') {
    if (!fileUrl) return <Loader />;

    if (!show) {
      return (
        <MantineImage
          fit={fill ? 'cover' : 'contain'}
          src={fileUrl}
          alt={file.name || 'Image'}
          style={fill ? { width: '100%', height: '100%' } : { width: '100%' }}
        />
      );
    }

    const image = (
      <MantineImage
        onClick={(e) => {
          if (!isClickOnImageLetterbox(e as unknown as React.MouseEvent<HTMLImageElement>)) {
            e.stopPropagation();
          }
          allowZoom && setZoomOpen(true);
        }}
        src={fileUrl}
        alt={file.name || 'Image'}
        fit='contain'
        style={{
          cursor: allowZoom ? 'zoom-in' : 'default',
          objectFit: 'contain',
          display: 'block',
          ...(fullscreen
            ? { maxWidth: '100%', maxHeight: '100%', width: 'auto', height: 'auto' }
            : { maxWidth: '70vw', maxHeight: '70vw' }),
        }}
      />
    );

    return (
      <>
        {fullscreen ? <FullscreenSizedMedia>{image}</FullscreenSizedMedia> : <Center>{image}</Center>}
        {allowZoom && zoomOpen && (
          <FileZoomModal setOpen={setZoomOpen}>
            <MantineImage
              src={fileUrl}
              alt={file.name || 'Image'}
              style={{
                maxWidth: '95vw',
                maxHeight: '95vh',
                objectFit: 'contain',
                cursor: 'zoom-out',
                width: 'auto',
              }}
              onClick={(e) => {
                if (!isClickOnImageLetterbox(e as unknown as React.MouseEvent<HTMLImageElement>)) {
                  e.stopPropagation();
                }
                setZoomOpen(false);
              }}
            />
          </FileZoomModal>
        )}
      </>
    );
  }

  if (type === 'audio') {
    if (!fileUrl) return <Loader />;
    return show ? (
      <audio
        onClick={(e) => e.stopPropagation()}
        autoPlay
        muted={mediaAutoMuted}
        controls
        style={{ width: '100%' }}
        src={fileUrl}
      />
    ) : (
      <Placeholder text={`Click to play audio ${file.name}`} Icon={fileIcon(file.type)} />
    );
  }

  if (type === 'text') {
    if (!show) return <Placeholder text={`Click to view text ${file.name}`} Icon={fileIcon(file.type)} />;

    if (fileContent.trim() === '') {
      return (
        <LoadingOverlay
          visible={fileContent.trim() === ''}
          loaderProps={{
            children: (
              <>
                <Center>
                  <Loader />
                </Center>
                <Text ta='center' mt='xs' c='dimmed'>
                  Loading file...
                </Text>
              </>
            ),
          }}
        />
      );
    }

    return show ? (
      <FullscreenFrame fullscreen={fullscreen} onClick={(e: any) => fullscreen && e.stopPropagation()}>
        <Render
          mode={renderIn}
          language={extension}
          code={fileContent}
          noClamp={fullscreen}
          scrollParent={scrollParent}
        />
      </FullscreenFrame>
    ) : (
      <Placeholder text={`Click to view text ${file.name}`} Icon={fileIcon(file.type)} />
    );
  }

  if (isAsciicast) {
    if (!fileUrl) return <Loader />;
    return show ? (
      <FullscreenFrame fullscreen={fullscreen} onClick={(e: any) => fullscreen && e.stopPropagation()}>
        <Asciinema src={fileUrl} />
      </FullscreenFrame>
    ) : (
      <Placeholder
        text={`Click to download asciinema cast ${file.name}`}
        Icon={fileIcon('application/x-asciicast')}
      />
    );
  }

  if (file.type === 'application/pdf') {
    if (!fileUrl) return <Loader />;
    return show ? (
      fullscreen ? (
        <Box
          onClick={(e) => e.stopPropagation()}
          style={{ height: 'calc(100vh - 7.5rem)', width: 'min(96vw, calc(100vw - 3rem))' }}
        >
          <Pdf src={fileUrl} />
        </Box>
      ) : (
        <Pdf src={fileUrl} />
      )
    ) : (
      <Placeholder text={`Click to view PDF ${file.name}`} Icon={fileIcon(file.type)} />
    );
  }

  if (!show) return <Placeholder text={`Click to view file ${file.name}`} Icon={fileIcon(file.type)} />;

  return (
    <Paper withBorder p='xs' style={{ cursor: 'pointer' }}>
      <Placeholder
        onClick={() => window.open(fileUrl)}
        text={`Click to view file ${file.name} in a new tab`}
        Icon={fileIcon(file.type)}
      />
    </Paper>
  );
}
