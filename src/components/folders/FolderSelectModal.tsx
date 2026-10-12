import { useFolders } from '@/lib/client/hooks/useFolders';
import { buildFolderHierarchy } from '@/lib/folderHierarchy';
import { Button, Group, Paper, ScrollArea, Stack, Text, TextInput, UnstyledButton } from '@mantine/core';
import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';

export default function FolderSelectModal({
  onSelect,
  onCancel,
  allowNoFolder = true,
  confirmLabel,
}: {
  onSelect: (folderId: string | undefined) => void;
  onCancel: () => void;
  allowNoFolder?: boolean;
  confirmLabel?: string;
}) {
  const { t } = useTranslation('folders');
  const { data: folders } = useFolders();
  const folderOptions = useMemo(() => (folders ? buildFolderHierarchy(folders) : []), [folders]);
  const [search, setSearch] = useState('');
  const [selected, setSelected] = useState<string | undefined>(undefined);

  const filtered = useMemo(
    () => folderOptions.filter((folder) => folder.path.toLowerCase().includes(search.toLowerCase().trim())),
    [folderOptions, search],
  );

  return (
    <Stack gap='md'>
      <TextInput
        placeholder={t('select.search')}
        value={search}
        onChange={(event) => setSearch(event.currentTarget.value)}
      />

      <Paper withBorder style={{ overflow: 'hidden' }}>
        <ScrollArea.Autosize mah={360} type='auto'>
          <Stack gap={0}>
            {allowNoFolder && (
              <UnstyledButton
                onClick={() => setSelected(undefined)}
                style={{
                  padding: 12,
                  textAlign: 'left',
                  background: selected === undefined ? 'var(--mantine-primary-color-light)' : undefined,
                }}
              >
                <Text size='sm'>{t('select.noFolder')}</Text>
              </UnstyledButton>
            )}

            {filtered.map((folder) => (
              <UnstyledButton
                key={folder.id}
                onClick={() => setSelected(folder.id)}
                style={{
                  padding: '8px 12px',
                  paddingLeft: `${12 + folder.depth * 16}px`,
                  textAlign: 'left',
                  background: selected === folder.id ? 'var(--mantine-primary-color-light)' : undefined,
                }}
              >
                <Text size='sm'>{folder.name}</Text>
              </UnstyledButton>
            ))}

            {filtered.length === 0 && search.trim() && (
              <Text size='sm' c='dimmed' p='sm'>
                {t('select.noMatch')}
              </Text>
            )}
          </Stack>
        </ScrollArea.Autosize>
      </Paper>

      <Group justify='right'>
        <Button variant='default' size='sm' onClick={onCancel}>
          {t('select.cancel')}
        </Button>
        <Button size='sm' onClick={() => onSelect(selected)} disabled={!folders}>
          {confirmLabel || t('select.confirm')}
        </Button>
      </Group>
    </Stack>
  );
}
