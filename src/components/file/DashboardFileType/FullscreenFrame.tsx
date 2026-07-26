import { Box } from '@mantine/core';

export default function FullscreenFrame({
  fullscreen,
  onClick,
  parent,
  children,
}: {
  fullscreen?: boolean;
  onClick?: (e: React.MouseEvent) => void;
  parent?: HTMLElement | null;
  children: React.ReactNode;
}) {
  if (!fullscreen) return <>{children}</>;

  return (
    <Box
      onClick={onClick}
      style={
        parent
          ? {
              width: '100%',
              height: 'auto',
              maxHeight: 'none',
              overflow: 'visible',
            }
          : {
              width: 'min(96vw, calc(100vw - 3rem))',
              maxHeight: 'none',
              overflow: 'visible',
            }
      }
    >
      {children}
    </Box>
  );
}
