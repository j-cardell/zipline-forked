import { useFolders } from '@/lib/client/hooks/useFolders';
import { buildFolderHierarchy } from '@/lib/folderHierarchy';
import { Alert, Box, Button, Card, Code, Group, Select, Stack, Text, TextInput, Title } from '@mantine/core';
import { notifications } from '@mantine/notifications';
import { IconAlertCircle, IconFolder, IconUpload } from '@tabler/icons-react';
import { useMemo, useState } from 'react';

export default function UploadImportDir() {
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
    if (!folders) return [{ value: '', label: 'No folder' }];
    return [
      { value: '', label: 'No folder' },
      ...buildFolderHierarchy(folders).map((f) => ({
        value: f.id,
        label: `${'  '.repeat(f.depth)}${f.depth > 0 ? '└ ' : ''}${f.name}`,
      })),
    ];
  }, [folders]);

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
        const err = await res.json().catch(() => ({ error: 'Unknown error' }));
        throw new Error(err.error || `Import failed: ${res.status}`);
      }

      const data = await res.json();
      setResult(data);
      notifications.show({
        title: 'Import complete',
        message: `Imported ${data.imported} files, inserted ${data.inserted} into DB`,
        color: data.errors.length ? 'yellow' : 'green',
      });
    } catch (err: any) {
      notifications.show({ title: 'Import failed', message: err.message, color: 'red' });
    } finally {
      setLoading(false);
    }
  };

  return (
    <Stack gap='md'>
      <Title>Import Directory</Title>

      <Alert icon={<IconAlertCircle size='1rem' />} color='yellow' variant='light'>
        This scans a directory on the server filesystem and imports its files into your account. Defaults to{' '}
        <Code>/zipline/uploads/_manual_uploads</Code> if no directory is provided.
      </Alert>

      <Card withBorder shadow='sm' padding='md' radius='md'>
        <Stack gap='md'>
          <TextInput
            label='Directory path'
            placeholder='/zipline/uploads/_manual_uploads'
            description='Leave empty to use the default manual uploads folder'
            value={directory}
            onChange={(e) => setDirectory(e.currentTarget.value)}
          />

          <Select
            label='Destination folder'
            placeholder='Select a folder'
            data={folderOptions}
            value={folder}
            onChange={(val) => setFolder(val ?? '')}
            disabled={foldersLoading}
            leftSection={<IconFolder size='1rem' />}
          />

          <Button onClick={importFiles} loading={loading} leftSection={<IconUpload size='1rem' />}>
            Scan and import
          </Button>
        </Stack>
      </Card>

      {result && (
        <Card withBorder shadow='sm' padding='md' radius='md'>
          <Stack gap='xs'>
            <Text fw={500}>Import result</Text>
            <Group gap='md'>
              <Box>
                <Text size='xs' c='dimmed'>
                  Directory
                </Text>
                <Code>{result.directory}</Code>
              </Box>
              <Box>
                <Text size='xs' c='dimmed'>
                  Inserted
                </Text>
                <Text>{result.inserted}</Text>
              </Box>
              <Box>
                <Text size='xs' c='dimmed'>
                  Imported
                </Text>
                <Text>{result.imported}</Text>
              </Box>
              <Box>
                <Text size='xs' c='dimmed'>
                  Deleted
                </Text>
                <Text>{result.deleted}</Text>
              </Box>
              <Box>
                <Text size='xs' c='dimmed'>
                  Skipped
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
