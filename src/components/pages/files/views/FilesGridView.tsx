import DashboardFile from '@/components/file/DashboardFile';
import { addMultipleToFolder, createZipShare, deleteMultipleFiles } from '@/components/file/actions';
import FolderSelectModal from '@/components/folders/FolderSelectModal';
import { useFileNavStore } from '@/lib/client/store/fileNav';
import {
  Button,
  Center,
  Group,
  Modal,
  Pagination,
  Paper,
  Select,
  Skeleton,
  Stack,
  Text,
  TextInput,
  Title,
} from '@mantine/core';
import { useClipboard, useElementSize } from '@mantine/hooks';
import { modals } from '@mantine/modals';
import { IconFilesOff, IconFileUpload, IconFolder, IconTrash, IconArchive } from '@tabler/icons-react';
import { parseAsInteger, useQueryState } from 'nuqs';
import {
  lazy,
  useCallback,
  useEffect,
  useImperativeHandle,
  useMemo,
  useRef,
  useState,
  forwardRef,
} from 'react';
import { Link } from 'react-router-dom';
import { useShallow } from 'zustand/shallow';
import { useJustifiedLayout } from '@/lib/client/layout/useJustifiedLayout';
import { useApiPagination } from '../useApiPagination';
import { useInfiniteFiles } from '../useInfiniteFiles';
import { useViewStore } from '@/lib/client/store/view';
import { getGridSkeletonHeight } from '@/components/GridTableSwitcher';
import { File } from '@/lib/db/models/file';
import styles from './FilesGridView.module.css';

const DashboardFileModal = lazy(() => import('@/components/file/DashboardFile/DashboardFileModal'));

const PER_PAGE_OPTIONS = [12, 24, 36, 48, 72, 96];

export type FilesGridViewRef = { refresh: () => void };

function defaultAspect(file: File): number {
  const type = file.type.split('/')[0];
  if (type === 'video') return 16 / 9;
  if (type === 'image') return 4 / 3;
  if (type === 'audio') return 1;
  return 1;
}

export default forwardRef<
  FilesGridViewRef,
  {
    id?: string;
    folderId?: string;
    search?: string;
    infinite?: boolean;
  }
>(function Files({ id, folderId, search, infinite }, ref) {
  const gridSize = useViewStore((state) => state.filesGridSize);
  const [page, setPage] = useQueryState('page', parseAsInteger.withDefault(1));
  const [perpage, setPerpage] = useQueryState('perpage', parseAsInteger.withDefault(24));

  const paginationQuery = useApiPagination({
    page,
    perpage,
    id,
    folderId,
    ...(search?.trim() && {
      search: {
        field: 'name',
        query: search.trim(),
      },
    }),
  });

  const infiniteQuery = useInfiniteFiles({
    perpage,
    id,
    folderId,
    ...(search?.trim() && {
      search: {
        field: 'name',
        query: search.trim(),
      },
    }),
  });

  const refresh = useCallback(() => {
    if (infinite) {
      infiniteQuery.mutate();
    } else {
      paginationQuery.mutate();
    }
  }, [infinite, infiniteQuery, paginationQuery]);

  useImperativeHandle(ref, () => ({
    refresh,
  }));

  useEffect(() => {
    if (infinite) {
      infiniteQuery.reset();
    } else {
      setPage(1);
    }
  }, [search, folderId, perpage, infinite, setPage]);

  const data = infinite ? infiniteQuery.data : ((paginationQuery.data?.page as File[] | undefined) ?? []);
  const isLoading = infinite ? infiniteQuery.isLoading : paginationQuery.isLoading;
  const totalRecords = infinite ? infiniteQuery.totalRecords : (paginationQuery.data?.total ?? 0);
  const cachedPages = infinite ? infiniteQuery.totalPages : (paginationQuery.data?.pages ?? 1);

  const [current, setCurrent, setFiles] = useFileNavStore(
    useShallow((state) => [state.current, state.setCurrent, state.setFiles]),
  );

  const from = infinite ? 1 : (page - 1) * perpage + 1;
  const to = infinite ? data.length : Math.min(page * perpage, paginationQuery.data?.total ?? 0);

  const currentFile = current ? (data.find((file) => file.id === current) ?? null) : null;
  const ids = useMemo(() => data.map((file) => file.id), [data]);

  useEffect(() => {
    setFiles(ids);
  }, [ids]);

  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [zipModalOpen, setZipModalOpen] = useState(false);
  const [zipName, setZipName] = useState('archive.zip');
  const clipboard = useClipboard();

  const selectedFiles = useMemo(() => data.filter((file) => selectedIds.has(file.id)), [data, selectedIds]);

  const handleSelect = useCallback(
    (fileId: string) => {
      setSelectedIds((prev) => {
        const next = new Set(prev);
        if (next.has(fileId)) next.delete(fileId);
        else next.add(fileId);
        return next;
      });
    },
    [setSelectedIds],
  );

  const handleClear = useCallback(() => setSelectedIds(new Set()), []);

  const handleSetPage = useCallback(
    (value: number) => {
      setSelectedIds(new Set());
      setPage(value);
    },
    [setPage],
  );

  const handleSetPerpage = useCallback(
    (value: number) => {
      setSelectedIds(new Set());
      setPerpage(value);
    },
    [setPerpage],
  );

  const handleMove = useCallback(() => {
    const modalId = modals.open({
      title: 'Move to folder',
      size: 'lg',
      centered: true,
      children: (
        <FolderSelectModal
          allowNoFolder={false}
          confirmLabel='Move'
          onSelect={async (folderId) => {
            if (folderId === undefined) return;
            await addMultipleToFolder(selectedFiles, folderId);
            modals.close(modalId);
            handleClear();
            refresh();
          }}
          onCancel={() => modals.close(modalId)}
        />
      ),
      onClose: () => modals.close(modalId),
    });
  }, [selectedFiles, handleClear, refresh]);

  const handleDelete = useCallback(async () => {
    await deleteMultipleFiles(selectedFiles);
    handleClear();
    refresh();
  }, [selectedFiles, handleClear, refresh]);

  const handleZip = useCallback(async () => {
    const name = zipName.trim() || 'archive.zip';
    const url = await createZipShare(selectedFiles, name.endsWith('.zip') ? name : `${name}.zip`);
    if (url) {
      clipboard.copy(url);
      setZipModalOpen(false);
      handleClear();
      refresh();
    }
  }, [selectedFiles, zipName, clipboard, handleClear, refresh]);

  const skeletonHeight = getGridSkeletonHeight(gridSize);
  const itemCount = perpage;
  const loadMoreRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!infinite || !loadMoreRef.current) return;
    if (!('IntersectionObserver' in window)) return;

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0]?.isIntersecting && infiniteQuery.hasMore && !infiniteQuery.isLoadingMore) {
          infiniteQuery.loadMore();
        }
      },
      { rootMargin: '400px' },
    );

    observer.observe(loadMoreRef.current);
    return () => observer.disconnect();
  }, [infinite, infiniteQuery.hasMore, infiniteQuery.isLoadingMore, infiniteQuery.loadMore]);

  const [sizes, setSizes] = useState<Record<string, { width: number; height: number }>>({});
  const { ref: containerRef, width: containerWidth } = useElementSize();

  const layoutItems = useMemo(
    () =>
      data.map((file) => {
        const known = sizes[file.id];
        const ratio = known ? known.width / known.height : defaultAspect(file);
        return { id: file.id, width: ratio, height: 1, originalRatio: ratio };
      }),
    [data, sizes],
  );

  const targetRowHeight = gridSize === 'large' ? 320 : gridSize === 'compact' ? 140 : 220;
  const gap = gridSize === 'compact' ? 4 : 8;
  const rows = useJustifiedLayout(layoutItems, containerWidth, targetRowHeight, gap);

  const fileById = useMemo(() => {
    const map = new Map<string, File>();
    for (const file of data) map.set(file.id, file);
    return map;
  }, [data]);

  const onImageLoad = useCallback(
    (e: React.SyntheticEvent<HTMLImageElement>, fileId: string) => {
      const img = e.currentTarget;
      if (img.naturalWidth && img.naturalHeight) {
        setSizes((prev) => ({
          ...prev,
          [fileId]: { width: img.naturalWidth, height: img.naturalHeight },
        }));
      }
    },
    [setSizes],
  );

  return (
    <>
      <DashboardFileModal
        open={!!currentFile}
        setOpen={(open) => {
          if (!open) setCurrent(null);
        }}
        file={currentFile}
        user={id}
        sequenced
        onDelete={refresh}
      />

      {selectedIds.size > 0 && (
        <Paper withBorder p='sm' mb='md'>
          <Group justify='space-between' align='center' wrap='nowrap'>
            <Text size='sm' fw={600}>
              {selectedIds.size} selected
            </Text>
            <Group gap='xs'>
              <Button
                size='compact-sm'
                variant='light'
                leftSection={<IconFolder size='1rem' />}
                onClick={handleMove}
              >
                Move
              </Button>
              <Button
                size='compact-sm'
                variant='light'
                color='red'
                leftSection={<IconTrash size='1rem' />}
                onClick={handleDelete}
              >
                Delete
              </Button>
              <Button
                size='compact-sm'
                variant='light'
                color='teal'
                leftSection={<IconArchive size='1rem' />}
                onClick={() => setZipModalOpen(true)}
              >
                Zip & Share
              </Button>
              <Button size='compact-sm' variant='subtle' onClick={handleClear}>
                Clear
              </Button>
            </Group>
          </Group>
        </Paper>
      )}

      <Modal opened={zipModalOpen} onClose={() => setZipModalOpen(false)} title='Zip & share' centered>
        <Stack>
          <Text size='sm' c='dimmed'>
            Create a zip archive from {selectedIds.size} selected file(s) and generate a shareable link. Saved
            to the &ldquo;zip shares&rdquo; folder.
          </Text>
          <TextInput
            label='Zip file name'
            description='Will be saved as a regular .zip file.'
            value={zipName}
            onChange={(e) => setZipName(e.currentTarget.value)}
            placeholder='my-files.zip'
          />
          <Group justify='right' mt='md'>
            <Button variant='default' onClick={() => setZipModalOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleZip} leftSection={<IconArchive size='1rem' />}>
              Create & copy link
            </Button>
          </Group>
        </Stack>
      </Modal>

      {isLoading ? (
        <div className={styles.skeletonGrid}>
          {[...Array(itemCount)].map((_, i) => (
            <Skeleton key={i} height={skeletonHeight} radius='md' animate />
          ))}
        </div>
      ) : data.length > 0 ? (
        <>
          <div className={styles.hiddenMeasure}>
            {data.map((file) => {
              const src = file.thumbnail?.path
                ? `/api/user/files/${file.thumbnail.path}/raw`
                : `/api/user/files/${file.id}/raw`;
              return <img key={file.id} src={src} alt='' onLoad={(e) => onImageLoad(e, file.id)} />;
            })}
          </div>
          <div ref={containerRef} className={styles.justifiedGrid}>
            {rows.map((row, rowIndex) => (
              <div
                key={rowIndex}
                className={styles.justifiedRow}
                style={{
                  height: row.rowHeight,
                  gap,
                }}
              >
                {row.items.map((item) => {
                  const file = fileById.get(item.id);
                  if (!file) return null;
                  return (
                    <div
                      key={file.id}
                      className={styles.justifiedItem}
                      style={{
                        flex: `${item.originalRatio} 1 0%`,
                        minWidth: 0,
                        height: row.rowHeight,
                      }}
                    >
                      <DashboardFile
                        file={file}
                        id={id}
                        onOpen={(fileId) => setCurrent(fileId)}
                        onDelete={refresh}
                        selected={selectedIds.has(file.id)}
                        onSelect={(e) => {
                          e?.preventDefault?.();
                          handleSelect(file.id);
                        }}
                        compact={gridSize === 'compact'}
                        fill
                      />
                    </div>
                  );
                })}
              </div>
            ))}
          </div>
        </>
      ) : (
        <Paper withBorder p='sm' className={styles.empty}>
          <Center>
            <Stack>
              <Group>
                <IconFilesOff size='2rem' />
                <Title order={2}>No files found</Title>
              </Group>
              {!id && (
                <Button
                  variant='outline'
                  size='compact-sm'
                  leftSection={<IconFileUpload size='1rem' />}
                  component={Link}
                  to='/dashboard/upload/file'
                >
                  Upload a file
                </Button>
              )}
            </Stack>
          </Center>
        </Paper>
      )}

      {infinite ? (
        <div ref={loadMoreRef} style={{ minHeight: 1 }}>
          <Group justify='space-between' align='center' mt='md'>
            <Text size='sm'>{`${data.length} / ${totalRecords} files`}</Text>

            {infiniteQuery.isLoadingMore ? (
              <Text size='sm' c='dimmed'>
                Loading more...
              </Text>
            ) : infiniteQuery.hasMore ? (
              <Text size='sm' c='dimmed'>
                Scroll to load more
              </Text>
            ) : (
              <Text size='sm' c='dimmed'>
                All files loaded
              </Text>
            )}
          </Group>
        </div>
      ) : (
        <Group justify='space-between' align='center' mt='md'>
          <Text size='sm'>{`${from} - ${to} / ${totalRecords} files`}</Text>

          <Group gap='sm'>
            <Select
              value={perpage.toString()}
              data={PER_PAGE_OPTIONS.map((val) => ({ value: val.toString(), label: `${val}` }))}
              onChange={(value) => {
                handleSetPerpage(Number(value));
                handleSetPage(1);
              }}
              w={80}
              size='xs'
              variant='filled'
            />

            <Pagination
              value={page}
              onChange={handleSetPage}
              total={cachedPages}
              size='sm'
              withControls
              withEdges
            />
          </Group>
        </Group>
      )}
    </>
  );
});
