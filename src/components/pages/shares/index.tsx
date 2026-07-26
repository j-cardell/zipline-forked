import { listUserShares, revokeUserShare, Share } from '@/lib/api/fileShare';
import { bytes } from '@/lib/bytes';
import {
  ActionIcon,
  Avatar,
  Badge,
  Box,
  Button,
  Card,
  Group,
  Loader,
  Menu,
  Select,
  Stack,
  Text,
  TextInput,
  Title,
  Tooltip,
} from '@mantine/core';
import { useClipboard } from '@mantine/hooks';
import { notifications } from '@mantine/notifications';
import {
  IconCopy,
  IconSearch,
  IconSortAscending,
  IconSortDescending,
  IconTrash,
  IconVideo,
  IconX,
} from '@tabler/icons-react';
import { useEffect, useMemo, useState } from 'react';

export default function DashboardShares() {
  const [shares, setShares] = useState<
    (Share & {
      file: { id: string; name: string; type: string; size: number; thumbnail: { path: string } | null };
    })[]
  >([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState('');
  const [sortBy, setSortBy] = useState<'created' | 'name' | 'views' | 'expires'>('created');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');
  const clipboard = useClipboard();

  useEffect(() => {
    listUserShares()
      .then(setShares)
      .catch((err) => notifications.show({ title: 'Error', message: err.message, color: 'red' }))
      .finally(() => setLoading(false));
  }, []);

  const revoke = async (shareId: string) => {
    try {
      await revokeUserShare(shareId);
      setShares((prev) => prev.filter((s) => s.id !== shareId));
      notifications.show({ title: 'Revoked', message: 'Share link revoked', color: 'green' });
    } catch (err: any) {
      notifications.show({ title: 'Error', message: err.message, color: 'red' });
    }
  };

  const copy = (url: string) => {
    clipboard.copy(url);
    notifications.show({ title: 'Copied', message: 'Share link copied', color: 'green' });
  };

  const shareUrl = (token: string, name: string) =>
    `${window.location.origin}/u/${encodeURIComponent(name)}?share=${token}`;

  const thumbnailUrl = (path: string) => `/api/user/files/${path}/raw`;

  const filteredShares = useMemo(() => {
    const term = filter.trim().toLowerCase();
    const list = term
      ? shares.filter(
          (s) =>
            s.file.name.toLowerCase().includes(term) ||
            s.file.type.toLowerCase().includes(term) ||
            s.token.toLowerCase().includes(term),
        )
      : [...shares];

    list.sort((a, b) => {
      let cmp = 0;
      switch (sortBy) {
        case 'created':
          cmp = new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime();
          break;
        case 'name':
          cmp = a.file.name.localeCompare(b.file.name);
          break;
        case 'views':
          cmp = a.views - b.views;
          break;
        case 'expires':
          cmp =
            (a.expiresAt ? new Date(a.expiresAt).getTime() : Infinity) -
            (b.expiresAt ? new Date(b.expiresAt).getTime() : Infinity);
          break;
      }
      return sortOrder === 'asc' ? cmp : -cmp;
    });

    return list;
  }, [shares, filter, sortBy, sortOrder]);

  if (loading) {
    return (
      <Box ta='center' mt='xl'>
        <Loader />
      </Box>
    );
  }

  return (
    <Stack gap='md'>
      <Title>Shares</Title>

      <Group wrap='nowrap'>
        <TextInput
          placeholder='Filter by name, type, or token...'
          value={filter}
          onChange={(e) => setFilter(e.currentTarget.value)}
          leftSection={<IconSearch size='1rem' />}
          rightSection={
            filter ? (
              <ActionIcon variant='subtle' size='xs' onClick={() => setFilter('')}>
                <IconX size='1rem' />
              </ActionIcon>
            ) : null
          }
          style={{ flex: 1 }}
        />

        <Select
          value={sortBy}
          onChange={(val) => setSortBy((val as any) ?? 'created')}
          data={[
            { value: 'created', label: 'Created' },
            { value: 'name', label: 'Name' },
            { value: 'views', label: 'Views' },
            { value: 'expires', label: 'Expires' },
          ]}
          w={140}
        />

        <Tooltip label={sortOrder === 'asc' ? 'Ascending' : 'Descending'}>
          <ActionIcon variant='light' onClick={() => setSortOrder((o) => (o === 'asc' ? 'desc' : 'asc'))}>
            {sortOrder === 'asc' ? <IconSortAscending size='1rem' /> : <IconSortDescending size='1rem' />}
          </ActionIcon>
        </Tooltip>
      </Group>

      {filteredShares.length === 0 ? (
        <Text c='dimmed'>
          {shares.length === 0 ? 'No active share links.' : 'No shares match your filter.'}
        </Text>
      ) : (
        filteredShares.map((share) => {
          const url = shareUrl(share.token, share.file.name);
          const isImage = share.file.type.startsWith('image/');
          const hasThumb = !!share.file.thumbnail?.path;

          return (
            <Card key={share.id} withBorder shadow='sm' padding='sm' radius='md'>
              <Group wrap='nowrap' align='flex-start' gap='md'>
                <Box w={80} h={80} style={{ flexShrink: 0, position: 'relative' }}>
                  {hasThumb || isImage ? (
                    <Avatar
                      src={hasThumb ? thumbnailUrl(share.file.thumbnail!.path) : url}
                      alt={share.file.name}
                      w={80}
                      h={80}
                      radius='md'
                    />
                  ) : (
                    <Box
                      w={80}
                      h={80}
                      bg='dark.6'
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        borderRadius: 8,
                      }}
                    >
                      <IconVideo size='2rem' />
                    </Box>
                  )}
                </Box>

                <Stack gap={4} style={{ flex: 1, minWidth: 0 }}>
                  <Group justify='space-between' wrap='nowrap'>
                    <Text fw={500} truncate style={{ flex: 1 }}>
                      {share.file.name}
                    </Text>
                    <Menu>
                      <Menu.Target>
                        <Button variant='light' size='xs'>
                          Actions
                        </Button>
                      </Menu.Target>
                      <Menu.Dropdown>
                        <Menu.Item leftSection={<IconCopy size='1rem' />} onClick={() => copy(url)}>
                          Copy link
                        </Menu.Item>
                        <Menu.Item
                          color='red'
                          leftSection={<IconTrash size='1rem' />}
                          onClick={() => revoke(share.id)}
                        >
                          Revoke
                        </Menu.Item>
                      </Menu.Dropdown>
                    </Menu>
                  </Group>

                  <Group gap='xs'>
                    <Badge size='sm' variant='light'>
                      {share.file.type}
                    </Badge>
                    <Badge size='sm' variant='light' color='blue'>
                      {bytes(share.file.size)}
                    </Badge>
                    {share.maxViews && (
                      <Badge size='sm' variant='light' color='yellow'>
                        {share.views}/{share.maxViews} views
                      </Badge>
                    )}
                    {share.expiresAt && (
                      <Badge size='sm' variant='light' color='red'>
                        until {new Date(share.expiresAt).toLocaleString()}
                      </Badge>
                    )}
                  </Group>

                  <Group gap='xs' wrap='nowrap'>
                    <TextInputForShares value={url} />

                    <Tooltip label='Copy'>
                      <ActionIcon variant='light' onClick={() => copy(url)}>
                        <IconCopy size='1rem' />
                      </ActionIcon>
                    </Tooltip>

                    <Tooltip label='Revoke'>
                      <ActionIcon color='red' variant='light' onClick={() => revoke(share.id)}>
                        <IconTrash size='1rem' />
                      </ActionIcon>
                    </Tooltip>
                  </Group>
                </Stack>
              </Group>
            </Card>
          );
        })
      )}
    </Stack>
  );
}

function TextInputForShares({ value }: { value: string }) {
  return (
    <Box
      component='input'
      value={value}
      readOnly
      onFocus={(e: React.FocusEvent<HTMLInputElement>) => e.currentTarget.select()}
      style={{
        flex: 1,
        minWidth: 0,
        background: 'var(--mantine-color-dark-6)',
        color: 'var(--mantine-color-text)',
        border: '1px solid var(--mantine-color-dark-4)',
        borderRadius: 4,
        padding: '4px 8px',
        fontSize: '0.85rem',
        fontFamily: 'monospace',
      }}
    />
  );
}
