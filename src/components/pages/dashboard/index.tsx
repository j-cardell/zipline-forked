import { useConfig } from '@/components/ConfigProvider';
import FolderBookmarksBar from '@/components/folders/FolderBookmarksBar';
import DropUploadOverlay from '@/components/upload/DropUploadOverlay';
import { GridSizeSwitcher } from '@/components/GridTableSwitcher';
import Stat from '@/components/Stat';
import SafeTrans from '@/components/SafeTrans';
import type { Response } from '@/lib/api/response';
import { bytes } from '@/lib/bytes';
import useLogin from '@/lib/client/hooks/useLogin';
import { useSettingsStore } from '@/lib/client/store/settings';
import { isAdministrator } from '@/lib/role';
import {
  ActionIcon,
  Button,
  Group,
  Paper,
  ScrollArea,
  SimpleGrid,
  Skeleton,
  Table,
  Text,
  TextInput,
  Title,
} from '@mantine/core';
import {
  IconDeviceSdCard,
  IconEyeFilled,
  IconFiles,
  IconGraphFilled,
  IconLink,
  IconSearch,
  IconStarFilled,
  IconX,
} from '@tabler/icons-react';
import { lazy, Suspense, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router-dom';
import useSWR from 'swr';
import { type FilesGridViewRef } from '@/components/pages/files/views/FilesGridView';

const ActivityChart = lazy(() => import('./parts/ActivityChart'));
const FilesGridView = lazy(() => import('@/components/pages/files/views/FilesGridView'));

export default function DashboardHome() {
  const { t } = useTranslation('dashboard');
  const { user } = useLogin();
  const { homeShowActivity, homeShowTypes, homeShowRecents } = useSettingsStore((state) => state.settings);
  const { data: stats, isLoading: statsLoading } = useSWR<Response['/api/user/stats']>('/api/user/stats');

  const [search, setSearch] = useState('');
  const [folderId, setFolderId] = useState<string | null>(null);
  const filesRef = useRef<FilesGridViewRef>(null);

  const config = useConfig();

  return (
    <>
      <DropUploadOverlay folderId={folderId} onUploaded={() => filesRef.current?.refresh()} />

      <Title>
        <SafeTrans
          t={t}
          i18nKey='welcome'
          values={{ username: user?.username ?? '' }}
          components={{ b: <b /> }}
        />
      </Title>

      <Skeleton visible={statsLoading} animate>
        <Text size='sm' c='dimmed'>
          <SafeTrans
            t={t}
            i18nKey='filesUploaded'
            values={{ files: statsLoading ? '...' : stats?.filesUploaded }}
            components={{ b: <b /> }}
          />
        </Text>
      </Skeleton>

      {homeShowRecents && (
        <Suspense
          fallback={
            <Paper radius='md' withBorder p='md' mt='lg'>
              <Skeleton height={24} width={180} mb='xs' animate />
              <Skeleton height={260} mt='md' animate />
            </Paper>
          }
        >
          <Group mt='md' mb='xs' wrap='nowrap' style={{ alignItems: 'center' }}>
            <Title order={2}>{t('recents.title')}</Title>
            <Button
              variant='outline'
              size='compact-xs'
              component={Link}
              to='/dashboard/files'
              leftSection={<IconFiles size='1rem' />}
            >
              {t('recents.viewAll')}
            </Button>

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

            <FolderBookmarksBar folderId={folderId} onChange={setFolderId} />

            <GridSizeSwitcher />
          </Group>

          <FilesGridView ref={filesRef} search={search} folderId={folderId ?? undefined} />
        </Suspense>
      )}

      {user?.quota && (user.quota.maxBytes || user.quota.maxFiles) ? (
        <Text size='sm' c='dimmed'>
          {user.quota.filesQuota === 'BY_BYTES' ? (
            <SafeTrans
              t={t}
              i18nKey='quota.bytes'
              values={{ used: statsLoading ? '...' : bytes(stats!.storageUsed), max: user.quota.maxBytes }}
              components={{ b: <b /> }}
            />
          ) : (
            <SafeTrans
              t={t}
              i18nKey='quota.files'
              values={{ files: statsLoading ? '...' : stats?.filesUploaded, max: user.quota.maxFiles }}
              components={{ b: <b /> }}
            />
          )}
        </Text>
      ) : null}
      {user?.quota && user.quota.maxUrls ? (
        <Text size='sm' c='dimmed'>
          <SafeTrans
            t={t}
            i18nKey='quota.urls'
            values={{ urls: statsLoading ? '...' : stats?.urlsCreated, max: user.quota.maxUrls }}
            components={{ b: <b /> }}
          />
        </Text>
      ) : null}

      <Group mt='md' style={{ alignItems: 'center' }}>
        <Title order={2}>{t('stats.title')}</Title>

        {(!config.features?.metrics?.adminOnly || isAdministrator(user?.role)) && (
          <Button
            variant='outline'
            size='compact-xs'
            component={Link}
            to='/dashboard/metrics'
            leftSection={<IconGraphFilled size='1rem' />}
          >
            {t('stats.viewMetrics')}
          </Button>
        )}
      </Group>

      <Text size='sm' c='dimmed' mb='xs'>
        {t('stats.description')}
      </Text>

      {statsLoading ? (
        <SimpleGrid cols={{ base: 1, md: 2, lg: 4 }} spacing={{ base: 'sm', md: 'md' }}>
          {[...Array(8)].map((_, i) => (
            <Skeleton key={i} height={105} />
          ))}
        </SimpleGrid>
      ) : stats ? (
        <SimpleGrid cols={{ base: 1, md: 2, lg: 4 }} spacing={{ base: 'sm', md: 'md' }}>
          <Stat Icon={IconFiles} title={t('stats.filesUploaded')} value={stats!.filesUploaded} />
          <Stat Icon={IconStarFilled} title={t('stats.favoriteFiles')} value={stats!.favoriteFiles} />
          <Stat Icon={IconDeviceSdCard} title={t('stats.storageUsed')} value={bytes(stats!.storageUsed)} />
          <Stat
            Icon={IconDeviceSdCard}
            title={t('stats.avgStorageUsed')}
            value={bytes(stats!.avgStorageUsed)}
          />
          <Stat Icon={IconEyeFilled} title={t('stats.fileViews')} value={stats!.views} />
          <Stat Icon={IconEyeFilled} title={t('stats.avgFileViews')} value={Math.round(stats!.avgViews)} />

          <Stat Icon={IconLink} title={t('stats.linksCreated')} value={stats!.urlsCreated} />
          <Stat Icon={IconLink} title={t('stats.linkViews')} value={Math.round(stats!.urlViews)} />
        </SimpleGrid>
      ) : null}

      {homeShowActivity && (
        <Suspense
          fallback={
            <Paper radius='md' withBorder p='md' mt='lg'>
              <Skeleton height={24} width={180} mb='xs' animate />
              <Skeleton height={260} mt='md' animate />
            </Paper>
          }
        >
          <ActivityChart />
        </Suspense>
      )}

      {statsLoading ? (
        <Paper withBorder my='md'>
          <ScrollArea.Autosize mah={400} type='auto'>
            <Table highlightOnHover>
              <Table.Thead>
                <Table.Tr>
                  <Table.Th>{t('fileTypes.columns.type')}</Table.Th>
                  <Table.Th>{t('fileTypes.columns.count')}</Table.Th>
                </Table.Tr>
              </Table.Thead>
              <Table.Tbody>
                {[...Array(5)].map((_, i) => (
                  <Table.Tr key={i}>
                    <Table.Td>
                      <Skeleton animate>
                        <Text>...</Text>
                      </Skeleton>
                    </Table.Td>
                    <Table.Td>
                      <Skeleton animate>
                        <Text>...</Text>
                      </Skeleton>
                    </Table.Td>
                  </Table.Tr>
                ))}
              </Table.Tbody>
            </Table>
          </ScrollArea.Autosize>
        </Paper>
      ) : stats && Object.keys(stats.sortTypeCount).length !== 0 && homeShowTypes ? (
        <>
          <Title order={3} mt='lg' mb='xs'>
            {t('fileTypes.title')}
          </Title>
          <Paper withBorder my='md'>
            <ScrollArea.Autosize mah={400} type='auto'>
              <Table highlightOnHover>
                <Table.Thead>
                  <Table.Tr>
                    <Table.Th>{t('fileTypes.columns.type')}</Table.Th>
                    <Table.Th>{t('fileTypes.columns.count')}</Table.Th>
                  </Table.Tr>
                </Table.Thead>
                <Table.Tbody>
                  {Object.entries(stats.sortTypeCount)
                    .sort(([, a], [, b]) => b - a)
                    .map(([type, count], i) => (
                      <Table.Tr key={i}>
                        <Table.Td>{type}</Table.Td>
                        <Table.Td>{count}</Table.Td>
                      </Table.Tr>
                    ))}
                </Table.Tbody>
              </Table>
            </ScrollArea.Autosize>
          </Paper>
        </>
      ) : null}
    </>
  );
}
