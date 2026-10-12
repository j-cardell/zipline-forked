import { useFolders } from '@/lib/client/hooks/useFolders';
import { buildFolderHierarchy } from '@/lib/folderHierarchy';
import { Alert, Box, Button, Card, Code, Group, Select, Stack, Text, TextInput, Title } from '@mantine/core';
import { notifications } from '@mantine/notifications';
import { IconAlertCircle, IconFolder, IconUpload } from '@tabler/icons-react';
import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';

export default function UploadImportDir() {
  const { t } = useTranslation('upload');
  const { data: folders, isLoading: foldersLoading } = useFolders();
  const [directory, setDirectory] = useState('');
  const [folder, setFolder] = useState('');
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<{
    directory: string;
    inserted: number;
    imported: number;
    deleted: number;
    skipped: number;
    totalSize: number;
    files: string[];
    errors: string[];
  } | null>(null);

  const folderOptions = useMemo(() => {
    const noFolder = { value: '', label: t('importDir.noFolder') };
    if (!folders) return [noFolder];
    return [
      noFolder,
      ...buildFolderHierarchy(folders).map((f) => ({
        value: f.id,
        label: `${'  '.repeat(f.depth)}${f.depth > 0 ? '└ ' : ''}${f.name}`,
      })),
    ];
  }, [folders, t]);

  const importFiles = async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/user/import-dir', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          directory: directory || undefined,
          folder: folder || undefined,
        }),
      });

      if (!res.ok) {
        const err = await res.json().catch(() => ({ error: t('importDir.unknownError') }));
        throw new Error(err.error || `${t('importDir.failed')}: ${res.status}`);
      }

      const data = await res.json();
      setResult(data);
      notifications.show({
        title: t('importDir.complete'),
        message: t('importDir.imported', { count: data.imported }),
        color: data.errors.length ? 'yellow' : 'green',
      });
    } catch (err: any) {
      notifications.show({ title: t('importDir.failed'), message: err.message, color: 'red' });
    } finally {
      setLoading(false);
    }
  };

  return (
    <Stack gap='md'>
      <Title>{t('importDir.title')}</Title>

      <Alert icon={<IconAlertCircle size='1rem' />} color='yellow' variant='light'>
        {t('importDir.description')}
      </Alert>

      <Card withBorder shadow='sm' padding='md' radius='md'>
        <Stack gap='md'>
          <TextInput
            label={t('importDir.directoryPath.label')}
            placeholder={t('importDir.directoryPath.placeholder')}
            description={t('importDir.directoryPath.description')}
            value={directory}
            onChange={(e) => setDirectory(e.currentTarget.value)}
          />

          <Select
            label={t('importDir.destinationFolder.label')}
            placeholder={t('importDir.destinationFolder.placeholder')}
            data={folderOptions}
            value={folder}
            onChange={(val) => setFolder(val ?? '')}
            disabled={foldersLoading}
            leftSection={<IconFolder size='1rem' />}
          />

          <Button onClick={importFiles} loading={loading} leftSection={<IconUpload size='1rem' />}>
            {t('importDir.scanAndImport')}
          </Button>
        </Stack>
      </Card>

      {result && (
        <Card withBorder shadow='sm' padding='md' radius='md'>
          <Stack gap='xs'>
            <Text fw={500}>{t('importDir.result.title')}</Text>
            <Group gap='md'>
              <Box>
                <Text size='xs' c='dimmed'>
                  {t('importDir.result.directory')}
                </Text>
                <Code>{result.directory}</Code>
              </Box>
              <Box>
                <Text size='xs' c='dimmed'>
                  {t('importDir.result.inserted')}
                </Text>
                <Text>{result.inserted}</Text>
              </Box>
              <Box>
                <Text size='xs' c='dimmed'>
                  {t('importDir.result.imported')}
                </Text>
                <Text>{result.imported}</Text>
              </Box>
              <Box>
                <Text size='xs' c='dimmed'>
                  {t('importDir.result.deleted')}
                </Text>
                <Text>{result.deleted}</Text>
              </Box>
              <Box>
                <Text size='xs' c='dimmed'>
                  {t('importDir.result.skipped')}
                </Text>
                <Text>{result.skipped}</Text>
              </Box>
            </Group>

            {result.errors.length > 0 && (
              <Alert icon={<IconAlertCircle size='1rem' />} color='red' variant='light'>
                {result.errors.map((err, i) => (
                  <Text key={i} size='sm'>
                    {err}
                  </Text>
                ))}
              </Alert>
            )}
          </Stack>
        </Card>
      )}
    </Stack>
  );
}
