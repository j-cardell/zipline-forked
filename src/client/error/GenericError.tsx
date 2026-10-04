import { Container, Paper, ScrollArea, Stack, Text, Title } from '@mantine/core';
import { useTranslation } from 'react-i18next';
import { useRouteError } from 'react-router-dom';
import FourOhFour from '../pages/404';

export default function GenericError({
  title,
  message,
  details,
}: {
  title?: string;
  message?: string;
  details?: Record<string, any>;
}) {
  const { t } = useTranslation('layout');
  const routeError: any = useRouteError();
  if (routeError?.status === 404) return <FourOhFour />;

  console.error(routeError ?? details);

  return (
    <Container my='lg'>
      <Stack gap='xs'>
        <Title order={5}>{title || t('errors.generic.title')}</Title>
        <Text c='dimmed'>{message || t('errors.generic.message')}</Text>
        {details && (
          <Paper withBorder px={3} py={3}>
            <ScrollArea>
              <pre style={{ margin: 0 }}>
                {JSON.stringify(
                  { routeError, details },
                  (_, value) =>
                    value instanceof Error
                      ? { ...value, name: value.name, message: value.message, stack: value.stack }
                      : value,
                  2,
                )}
              </pre>
            </ScrollArea>
          </Paper>
        )}
      </Stack>
    </Container>
  );
}
