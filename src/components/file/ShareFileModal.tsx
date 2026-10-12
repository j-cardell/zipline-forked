import { Share, createFileShare, listFileShares, revokeFileShare } from '@/lib/api/fileShare';
import { File } from '@/lib/db/models/file';
import {
  Button,
  Group,
  Modal,
  NumberInput,
  PasswordInput,
  Stack,
  Switch,
  Text,
  TextInput,
  Title,
  Tooltip,
  ActionIcon,
} from '@mantine/core';
import { useClipboard } from '@mantine/hooks';
import { notifications } from '@mantine/notifications';
import { IconCopy, IconTrash } from '@tabler/icons-react';
import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';

export default function ShareFileModal({
  file,
  open,
  onClose,
}: {
  file: File;
  open: boolean;
  onClose: () => void;
}) {
  const { t } = useTranslation(['file', 'common']);
  const clipboard = useClipboard();

  const [shares, setShares] = useState<Share[]>([]);
  const [loading, setLoading] = useState(false);

  const [expiresEnabled, setExpiresEnabled] = useState(false);
  const [expiresAt, setExpiresAt] = useState('');
  const [maxViews, setMaxViews] = useState<number | undefined>(undefined);
  const [password, setPassword] = useState('');
  const [newShareUrl, setNewShareUrl] = useState('');

  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    listFileShares(file)
      .then((data) => {
        if (cancelled) return;
        setShares(data.shares);
      })
      .catch((err: any) => {
        if (cancelled) return;
        notifications.show({ title: t('common:status.error'), message: err.message, color: 'red' });
      });
    return () => {
      cancelled = true;
    };
  }, [open, file, t]);

  useEffect(() => {
    if (open) return;
    const timer = setTimeout(() => setNewShareUrl(''), 200);
    return () => clearTimeout(timer);
  }, [open]);

  const createShare = async () => {
    setLoading(true);
    try {
      const options = {
        expiresAt: expiresEnabled ? expiresAt || null : null,
        maxViews: maxViews ?? null,
        password: password || null,
      };
      const data = await createFileShare(file, options);
      setNewShareUrl(data.url);
      setShares((prev) => [
        {
          id: data.share.id,
          token: data.share.token,
          expiresAt: data.share.expiresAt,
          maxViews: data.share.maxViews,
          views: data.share.views,
          createdAt: data.share.createdAt,
        },
        ...prev,
      ]);
    } catch (err: any) {
      notifications.show({ title: t('common:status.error'), message: err.message, color: 'red' });
    } finally {
      setLoading(false);
    }
  };

  const revokeShare = async (shareId: string) => {
    try {
      await revokeFileShare(file, shareId);
      setShares((prev) => prev.filter((s) => s.id !== shareId));
      notifications.show({
        title: t('shareModal.revoke'),
        message: t('shareModal.revoke'),
        color: 'green',
      });
    } catch (err: any) {
      notifications.show({ title: t('common:status.error'), message: err.message, color: 'red' });
    }
  };

  return (
    <Modal
      opened={open}
      onClose={onClose}
      title={<Title order={3}>{t('shareModal.title', { name: file.name })}</Title>}
      size='lg'
      centered
    >
      <Stack gap='md'>
        {newShareUrl && (
          <Group wrap='nowrap'>
            <TextInput
              label={t('shareModal.shareLink')}
              value={newShareUrl}
              readOnly
              style={{ flex: 1 }}
              onFocus={(e) => e.currentTarget.select()}
            />
            <Tooltip label={t('shareModal.copy')}>
              <Button
                variant='light'
                px='sm'
                onClick={() => {
                  clipboard.copy(newShareUrl);
                  notifications.show({
                    title: t('shareModal.copied.title'),
                    message: t('shareModal.copied.message'),
                    color: 'green',
                  });
                }}
              >
                <IconCopy size='1rem' />
              </Button>
            </Tooltip>
          </Group>
        )}

        <Group align='flex-end'>
          <Switch
            label={t('shareModal.setExpiration')}
            checked={expiresEnabled}
            onChange={(e) => setExpiresEnabled(e.currentTarget.checked)}
          />
          <TextInput
            type='datetime-local'
            label={t('shareModal.expiresAt')}
            disabled={!expiresEnabled}
            value={expiresAt}
            onChange={(e) => setExpiresAt(e.currentTarget.value)}
            style={{ flex: 1 }}
          />
        </Group>

        <NumberInput
          label={t('shareModal.maxViews')}
          placeholder={t('shareModal.maxViewsPlaceholder')}
          min={1}
          value={maxViews}
          onChange={(val) => setMaxViews(typeof val === 'number' ? val : undefined)}
        />

        <PasswordInput
          label={t('shareModal.password')}
          placeholder={t('shareModal.passwordPlaceholder')}
          value={password}
          onChange={(e) => setPassword(e.currentTarget.value)}
        />

        <Button onClick={createShare} loading={loading} disabled={expiresEnabled && !expiresAt}>
          {t('shareModal.create')}
        </Button>

        {shares.length > 0 && (
          <Stack gap='xs'>
            <Text fw={600}>{t('shareModal.activeShares')}</Text>
            {shares.map((share) => {
              const shareUrl = `${window.location.origin}/u/${encodeURIComponent(file.name)}?share=${share.token}`;
              return (
                <Group key={share.id} justify='space-between' wrap='nowrap'>
                  <TextInput
                    value={shareUrl}
                    readOnly
                    style={{ flex: 1 }}
                    onFocus={(e) => e.currentTarget.select()}
                    size='sm'
                  />
                  <Group gap='xs' wrap='nowrap'>
                    <Tooltip label={t('shareModal.copy')}>
                      <ActionIcon
                        variant='light'
                        onClick={() => {
                          clipboard.copy(shareUrl);
                          notifications.show({
                            title: t('shareModal.copied.title'),
                            message: t('shareModal.copied.message'),
                            color: 'green',
                          });
                        }}
                      >
                        <IconCopy size='1rem' />
                      </ActionIcon>
                    </Tooltip>
                    <Tooltip label={t('shareModal.revoke')}>
                      <ActionIcon color='red' variant='light' onClick={() => revokeShare(share.id)}>
                        <IconTrash size='1rem' />
                      </ActionIcon>
                    </Tooltip>
                  </Group>
                </Group>
              );
            })}
          </Stack>
        )}
      </Stack>
    </Modal>
  );
}
