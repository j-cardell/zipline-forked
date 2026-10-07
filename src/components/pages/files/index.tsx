import GridTableSwitcher, { GridSizeSwitcher } from '@/components/GridTableSwitcher';
import FolderBookmarksBar from '@/components/folders/FolderBookmarksBar';
import DropUploadOverlay from '@/components/upload/DropUploadOverlay';
import { useViewStore } from '@/lib/client/store/view';
import { ActionIcon, Group, Menu, TextInput, Title, Tooltip } from '@mantine/core';
import {
  IconDots,
  IconFileDots,
  IconFileUpload,
  IconGridPatternFilled,
  IconSearch,
  IconTableOptions,
  IconTags,
  IconX,
} from '@tabler/icons-react';
import { parseAsBoolean, useQueryStates } from 'nuqs';
import { useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router-dom';
import PendingFilesModal from './PendingFilesModal';
import TagsModal from './tags/TagsModal';
import FavoriteFiles from './views/FavoriteFiles';
import Files, { type FilesGridViewRef } from './views/FilesGridView';
import FileTable from './views/FilesTableView';

export type DashboardFilesModals = {
  table: boolean;
  idSearch: boolean;
  tags: boolean;
  pending: boolean;
};

export function useModals() {
  return useQueryStates({
    table: parseAsBoolean.withDefault(false),
    idSearch: parseAsBoolean.withDefault(false),
    tags: parseAsBoolean.withDefault(false),
    pending: parseAsBoolean.withDefault(false),
  });
}

export type DashboardFilesModalsUpdate = ReturnType<typeof useModals>[1];

export default function DashboardFiles() {
  const { t } = useTranslation('files');
  const view = useViewStore((state) => state.files);

  const [modals, setModals] = useModals();
  const [search, setSearch] = useState('');
  const [folderId, setFolderId] = useState<string | null>(null);
  const filesRef = useRef<FilesGridViewRef>(null);

  return (
    <>
      <TagsModal modals={modals} setModals={setModals} />
      <PendingFilesModal modals={modals} setModals={setModals} />
      <DropUploadOverlay folderId={folderId} onUploaded={() => filesRef.current?.refresh()} />

      <Group wrap='nowrap'>
        <Title>{t('page.title')}</Title>

        <Tooltip label={t('page.uploadTooltip')}>
          <Link to='/dashboard/upload/file'>
            <ActionIcon variant='outline'>
              <IconFileUpload size='1rem' />
            </ActionIcon>
          </Link>
        </Tooltip>

        {view === 'grid' && (
          <TextInput
            placeholder={t('search.placeholder')}
            value={search}
            onChange={(e) => setSearch(e.currentTarget.value)}
            leftSection={<IconSearch size='1rem' />}
            rightSection={
              search ? (
                <ActionIcon variant='subtle' size='xs' onClick={() => setSearch('')}>
                  <IconX size='1rem' />
                </ActionIcon>
              ) : null
            }
            size='sm'
            w={260}
            variant='filled'
          />
        )}

        {view === 'grid' && <FolderBookmarksBar folderId={folderId} onChange={setFolderId} />}

        <Menu>
          <Menu.Target>
            <Tooltip label={t('page.moreActions')}>
              <ActionIcon variant='outline'>
                <IconDots size='1rem' />
              </ActionIcon>
            </Tooltip>
          </Menu.Target>
          <Menu.Dropdown>
            <Menu.Item
              leftSection={<IconTags size='1rem' />}
              onClick={() => setModals({ tags: !modals.tags })}
            >
              {t('page.menu.manageTags')}
            </Menu.Item>
            <Menu.Item
              leftSection={<IconFileDots size='1rem' />}
              onClick={() => setModals({ pending: !modals.pending })}
            >
              {t('page.menu.viewPending')}
            </Menu.Item>
            {view === 'table' && (
              <>
                <Menu.Label>{t('page.menu.tableOptions')}</Menu.Label>
                <Menu.Item
                  leftSection={<IconGridPatternFilled size='1rem' />}
                  onClick={() => setModals({ idSearch: !modals.idSearch })}
                >
                  {t('page.menu.searchById')}
                </Menu.Item>
                <Menu.Item
                  leftSection={<IconTableOptions size='1rem' />}
                  onClick={() => setModals({ table: !modals.table })}
                >
                  {t('page.menu.tableOptions')}
                </Menu.Item>
              </>
            )}
          </Menu.Dropdown>
        </Menu>

        {view === 'grid' && <GridSizeSwitcher />}
        <GridTableSwitcher type='files' />
      </Group>

      {view === 'grid' ? (
        <>
          <FavoriteFiles />

          <Files ref={filesRef} search={search} folderId={folderId ?? undefined} infinite />
        </>
      ) : (
        <FileTable modals={modals} setModals={setModals} />
      )}
    </>
  );
}
