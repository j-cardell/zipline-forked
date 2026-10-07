import type { Response } from '@/lib/api/response';
import useAvatar from '@/lib/client/hooks/useAvatar';
import useLogin from '@/lib/client/hooks/useLogin';
import { useLogout } from '@/lib/client/hooks/useLogout';
import { useUserStore } from '@/lib/client/store/user';
import type { SafeConfig } from '@/lib/config/safe';
import { fetchApi } from '@/lib/fetchApi';
import { isAdministrator } from '@/lib/role';
import {
  AppShell,
  Avatar,
  Box,
  Burger,
  Button,
  Divider,
  Group,
  Menu,
  NavLink,
  Paper,
  ScrollArea,
  Title,
  useMantineColorScheme,
  useMantineTheme,
} from '@mantine/core';
import { useClipboard } from '@mantine/hooks';
import { useModals, openModal, closeModal } from '@mantine/modals';
import { showNotification } from '@mantine/notifications';
import {
  IconAdjustments,
  IconChevronDown,
  IconChevronRight,
  IconClipboardCopy,
  IconExternalLink,
  IconFileText,
  IconFileUpload,
  IconFiles,
  IconFolder,
  IconGraph,
  IconHome,
  IconLink,
  IconLogout,
  IconRefreshDot,
  IconSettingsFilled,
  IconShieldLockFilled,
  IconStopwatch,
  IconTags,
  IconUpload,
  IconUsersGroup,
  IconShare,
} from '@tabler/icons-react';
import type { TFunction } from 'i18next';
import { useCallback, useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Link, NavigateFunction, Outlet, useLoaderData, useLocation, useNavigate } from 'react-router-dom';
import { useShallow } from 'zustand/shallow';
import { useSWRConfig } from 'swr';
import { dashboardLoader } from '../client/routes';
import { bytes } from '@/lib/bytes';
import { useUploadOptionsStore } from '@/lib/client/store/uploadOptions';
import { uploadFiles } from '@/lib/client/upload/files';
import { uploadPartialFiles } from '@/lib/client/upload/partial';
import FolderSelectModal from './folders/FolderSelectModal';
import ConfigProvider from './ConfigProvider';
import LanguageSelect from './LanguageSelect';
import VersionBadge from './VersionBadge';
import { SETTINGS_EXTERNAL_LINKS } from './pages/serverSettings';

function isTextField(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false;
  const tag = target.tagName.toLowerCase();
  return tag === 'input' || tag === 'textarea' || target.isContentEditable;
}

function promptForFolder(): Promise<string | undefined | null> {
  return new Promise((resolve) => {
    const id = openModal({
      title: 'Select folder for upload',
      size: 'lg',
      centered: true,
      children: (
        <FolderSelectModal
          onSelect={(folderId) => {
            resolve(folderId);
            closeModal(id);
          }}
          onCancel={() => {
            resolve(null);
            closeModal(id);
          }}
        />
      ),
      onClose: () => resolve(null),
    });
  });
}

type NavLinks = {
  label: string;
  icon: React.ReactNode;
  active: (path: string) => boolean;
  href?: string;
  links?: NavLinks[];
  if?: (user: Response['/api/user']['user'], config: SafeConfig) => boolean;
};

// built at render time so labels follow the active language
const buildNavLinks = (t: TFunction<['layout', 'common', 'serverSettings']>): NavLinks[] => [
  {
    label: t('nav.home'),
    icon: <IconHome size='1rem' />,
    active: (path: string) => path === '/dashboard',
    href: '/dashboard',
  },
  {
    label: t('nav.metrics'),
    icon: <IconGraph size='1rem' />,
    active: (path: string) => path === '/dashboard/metrics',
    href: '/dashboard/metrics',
    if: (user, config) =>
      config.features.metrics.enabled &&
      (config.features.metrics.adminOnly ? isAdministrator(user?.role) : true),
  },
  {
    label: t('nav.files'),
    icon: <IconFiles size='1rem' />,
    active: (path: string) => path === '/dashboard/files',
    href: '/dashboard/files',
  },
  {
    label: t('nav.shares'),
    icon: <IconShare size='1rem' />,
    active: (path: string) => path === '/dashboard/shares',
    href: '/dashboard/shares',
  },
  {
    label: t('nav.folders'),
    icon: <IconFolder size='1rem' />,
    active: (path: string) => path === '/dashboard/folders',
    href: '/dashboard/folders',
  },
  {
    label: t('nav.upload'),
    icon: <IconUpload size='1rem' />,
    active: (path: string) => path.startsWith('/dashboard/upload'),
    links: [
      {
        label: t('nav.uploadFile'),
        icon: <IconFileUpload size='1rem' />,
        active: (path: string) => path === '/dashboard/upload/file',
        href: '/dashboard/upload/file',
      },
      {
        label: t('nav.uploadText'),
        icon: <IconFileText size='1rem' />,
        active: (path: string) => path === '/dashboard/upload/text',
        href: '/dashboard/upload/text',
      },
      {
        label: t('nav.importDirectory'),
        icon: <IconFolder size='1rem' />,
        active: (path: string) => path === '/dashboard/upload/import-dir',
        href: '/dashboard/upload/import-dir',
      },
    ],
  },
  {
    label: t('nav.urls'),
    icon: <IconLink size='1rem' />,
    active: (path: string) => path === '/dashboard/urls',
    href: '/dashboard/urls',
  },
  {
    label: t('nav.administrator'),
    icon: <IconShieldLockFilled size='1rem' />,
    if: (user) => isAdministrator(user?.role),
    active: (path: string) => path.startsWith('/dashboard/admin'),
    links: [
      {
        label: t('nav.adminDashboard'),
        icon: <IconHome size='1rem' />,
        active: (path: string) => path === '/dashboard/admin',
        href: '/dashboard/admin',
      },
      {
        label: t('nav.serverSettings'),
        icon: <IconAdjustments size='1rem' />,
        active: (path: string) => path.startsWith('/dashboard/admin/settings'),
        if: (user) => user?.role === 'SUPERADMIN',
        href: '/dashboard/admin/settings',
        links: SETTINGS_EXTERNAL_LINKS.map(({ labelKey, href, icon: Icon }) => ({
          label: t(labelKey, { ns: 'serverSettings' }),
          icon: <Icon size='1rem' />,
          active: (path: string) => path === href,
          href,
        })),
      },
      {
        label: t('nav.serverActions'),
        icon: <IconStopwatch size='1rem' />,
        active: (path: string) => path === '/dashboard/admin/actions',
        href: '/dashboard/admin/actions',
      },
      {
        label: t('nav.users'),
        icon: <IconUsersGroup size='1rem' />,
        active: (path: string) => path === '/dashboard/admin/users',
        href: '/dashboard/admin/users',
      },
      {
        label: t('nav.invites'),
        icon: <IconTags size='1rem' />,
        active: (path: string) => path === '/dashboard/admin/invites',
        href: '/dashboard/admin/invites',
        if: (_, config) => config.invites.enabled,
      },
    ],
  },
];

const renderLinks = (
  links: NavLinks[],
  pathname: string,
  user: Response['/api/user']['user'],
  config: SafeConfig,
  navigate: NavigateFunction,
) => {
  const visible = (link: NavLinks) => !link.if || link.if(user as Response['/api/user']['user'], config);

  const active = (link: NavLinks): boolean => {
    if (!visible(link)) return false;
    if (link.active(pathname)) return true;

    return (link.links || []).some((child) => active(child));
  };

  return links.map((link) => {
    if (visible(link)) {
      const sublinks = link.links;
      const isActive = link.active(pathname);

      if (!sublinks) {
        return (
          <NavLink
            key={link.href ?? link.label}
            label={link.label}
            leftSection={link.icon}
            variant='light'
            rightSection={<IconChevronRight size='0.7rem' />}
            active={isActive}
            component={Link}
            to={link.href || ''}
            prefetch='intent'
          />
        );
      } else {
        return (
          <NavLink
            key={link.href ?? link.label}
            label={link.label}
            leftSection={link.icon}
            variant='light'
            rightSection={<IconChevronRight size='0.7rem' />}
            active={isActive && !sublinks.some((child) => active(child))}
            defaultOpened={isActive || sublinks.some((child) => active(child))}
            onClick={(event) => {
              if (!link.href) return;
              event.preventDefault();
              navigate(link.href);
            }}
          >
            {renderLinks(sublinks, pathname, user as Response['/api/user']['user'], config, navigate)}
          </NavLink>
        );
      }
    }
    return null;
  });
};

export default function Layout() {
  const { t } = useTranslation(['layout', 'common', 'serverSettings']);
  const theme = useMantineTheme();
  const { colorScheme } = useMantineColorScheme();
  const [opened, setOpened] = useState(false);
  const modals = useModals();
  const clipboard = useClipboard();
  const setUser = useUserStore((s) => s.setUser);
  const location = useLocation();
  const navigate = useNavigate();
  const logout = useLogout();
  const { mutate: mutateCache } = useSWRConfig();

  const loaderData = useLoaderData<typeof dashboardLoader>();
  const config = loaderData.config;

  const [options, ephemeral, clearEphemeral] = useUploadOptionsStore(
    useShallow((state) => [state.options, state.ephemeral, state.clearEphemeral]),
  );

  const uploadingRef = useRef(false);

  const handleGlobalPaste = useCallback(
    async (e: ClipboardEvent) => {
      const path = location.pathname;
      if (path.startsWith('/dashboard/admin') || path === '/dashboard/settings') return;

      if (!e.clipboardData) return;

      const pastedFiles: File[] = [];
      let pastedText = '';

      for (const item of Array.from(e.clipboardData.items)) {
        const file = item.getAsFile();
        if (file) {
          pastedFiles.push(file);
        } else if (item.kind === 'string' && item.type === 'text/plain') {
          pastedText = e.clipboardData.getData('text/plain');
        }
      }

      if (pastedFiles.length === 0 && !pastedText) return;

      // If only text and user is focused in a text field, let native paste work
      if (pastedFiles.length === 0 && isTextField(e.target)) return;

      e.preventDefault();
      if (uploadingRef.current) return;
      uploadingRef.current = true;

      const folderId = await promptForFolder();
      if (folderId === null) {
        uploadingRef.current = false;
        return;
      }

      const files: File[] =
        pastedFiles.length > 0
          ? pastedFiles
          : [
              new File([new Blob([pastedText], { type: 'text/plain' })], 'pasted-snippet.txt', {
                type: 'text/plain',
              }),
            ];

      const maxBytes = config.chunks.enabled && bytes(config.chunks.max);
      const partialUploads = maxBytes ? files.filter((file) => file.size >= maxBytes) : [];
      const normalUploads = maxBytes ? files.filter((file) => file.size < maxBytes) : files;

      try {
        if (normalUploads.length > 0) {
          await uploadFiles(normalUploads, {
            setFiles: () => {},
            setLoading: () => {},
            setProgress: () => {},
            clipboard,
            clearEphemeral,
            options,
            ephemeral,
            folder: folderId ?? undefined,
          });
        }
        if (partialUploads.length > 0) {
          await uploadPartialFiles(partialUploads, {
            setFiles: () => {},
            setLoading: () => {},
            setProgress: () => {},
            options,
            ephemeral,
            config,
            folder: folderId ?? undefined,
          });
        }
      } finally {
        uploadingRef.current = false;
        mutateCache(() => true, undefined, { revalidate: true });
      }
    },
    [clipboard, clearEphemeral, config, ephemeral, location.pathname, mutateCache, options],
  );

  useEffect(() => {
    document.addEventListener('paste', handleGlobalPaste);
    return () => {
      document.removeEventListener('paste', handleGlobalPaste);
    };
  }, [handleGlobalPaste]);

  const { user, mutate } = useLogin();
  const { avatar } = useAvatar();

  const [prev, setPrev] = useState(location.pathname);
  if (prev !== location.pathname) {
    setPrev(location.pathname);
    setOpened(false);
  }

  const copyToken = () => {
    modals.openConfirmModal({
      title: t('token.copy.title'),
      children: t('token.copy.message'),
      labels: { confirm: t('common:actions.copy'), cancel: t('token.cancel') },
      onConfirm: async () => {
        const { data, error } = await fetchApi<Response['/api/user/token']>('/api/user/token');
        if (error) {
          showNotification({
            title: t('common:status.error'),
            message: error.error,
            color: 'red',
            icon: <IconClipboardCopy size='1rem' />,
          });
        } else {
          clipboard.copy(data?.token ?? '');
          showNotification({
            title: t('token.copied.title'),
            message: t('token.copied.message'),
            color: 'green',
            icon: <IconClipboardCopy size='1rem' />,
          });
        }
      },
    });
  };

  const refreshToken = () => {
    modals.openConfirmModal({
      title: t('token.refresh.title'),

      children: t('token.refresh.message'),
      labels: { confirm: t('common:actions.refresh'), cancel: t('token.cancel') },
      onConfirm: async () => {
        const { data, error } = await fetchApi<Response['/api/user/token']>('/api/user/token', 'PATCH');
        if (error) {
          showNotification({
            title: t('common:status.error'),
            message: error.error,
            color: 'red',
            icon: <IconRefreshDot size='1rem' />,
          });
        } else {
          setUser(data?.user);
          mutate(data as Response['/api/user']);

          showNotification({
            title: t('token.refreshed.title'),
            message: t('token.refreshed.message'),
            color: 'green',
            icon: <IconRefreshDot size='1rem' />,
          });
        }
      },
    });
  };

  return (
    <AppShell
      navbar={{ breakpoint: 'sm', width: { sm: 200, lg: 230 }, collapsed: { mobile: !opened } }}
      header={{ height: 60 }}
      footer={{ height: { base: 0.1 } }}
    >
      <AppShell.Header px='md'>
        <div style={{ display: 'flex', alignItems: 'center', height: '100%' }}>
          <Burger
            opened={opened}
            onClick={() => setOpened((o) => !o)}
            size='sm'
            color={theme.colors.gray[6]}
            mr='xl'
            hiddenFrom='sm'
            bdrs='md'
          />

          {config.website.titleLogo && (
            <Avatar src={config.website.titleLogo} alt={t('header.logoAlt')} radius='sm' size='md' mr='md' />
          )}

          <Title visibleFrom='sm' lineClamp={1} size={32}>
            {config.website.title.trim()}
          </Title>

          <Group gap='xs' wrap='nowrap' style={{ marginLeft: 'auto' }}>
            <LanguageSelect />

            <Menu shadow='md' width={200}>
              <Menu.Target>
                <Button
                  variant='transparent'
                  color={colorScheme === 'dark' ? 'white' : 'black'}
                  leftSection={
                    avatar ? (
                      <Avatar
                        src={avatar}
                        radius='sm'
                        size='sm'
                        alt={user?.username ?? t('header.avatarAlt')}
                      />
                    ) : (
                      <IconSettingsFilled size='1rem' />
                    )
                  }
                  rightSection={<IconChevronDown size='0.7rem' />}
                  size='sm'
                >
                  {user?.username}
                </Button>
              </Menu.Target>

              <Menu.Dropdown>
                <Menu.Label>
                  {isAdministrator(user?.role)
                    ? t('userMenu.administratorLabel', { username: user?.username })
                    : user?.username}
                </Menu.Label>

                <Menu.Item leftSection={<IconClipboardCopy size='1rem' />} onClick={copyToken}>
                  {t('userMenu.copyToken')}
                </Menu.Item>
                <Menu.Item color='red' leftSection={<IconRefreshDot size='1rem' />} onClick={refreshToken}>
                  {t('userMenu.refreshToken')}
                </Menu.Item>
                <Menu.Divider />

                <Menu.Item
                  leftSection={<IconSettingsFilled size='1rem' />}
                  component={Link}
                  to='/dashboard/settings'
                  prefetch='intent'
                >
                  {t('userMenu.settings')}
                </Menu.Item>

                {user?.role === 'SUPERADMIN' && (
                  <Menu.Item
                    leftSection={<IconAdjustments size='1rem' />}
                    component={Link}
                    to='/dashboard/admin/settings'
                    prefetch='intent'
                  >
                    {t('userMenu.serverSettings')}
                  </Menu.Item>
                )}

                <Menu.Divider />
                <Menu.Item color='red' leftSection={<IconLogout size='1rem' />} onClick={logout}>
                  {t('userMenu.logout')}
                </Menu.Item>
              </Menu.Dropdown>
            </Menu>
          </Group>
        </div>
      </AppShell.Header>

      <AppShell.Navbar hidden={!opened} zIndex={90}>
        <Title hiddenFrom='sm' size={24} m='sm' style={{ marginBottom: 20 }}>
          {config.website.title.trim()}
        </Title>
        <Divider hiddenFrom='sm' />

        <ScrollArea mah='calc(100vh - 200px)'>
          {renderLinks(
            buildNavLinks(t),
            location.pathname,
            user as Response['/api/user']['user'],
            config,
            navigate,
          )}
        </ScrollArea>

        <div style={{ marginTop: 'auto' }}>
          <VersionBadge />

          <Divider />

          <ScrollArea mah='auto'>
            <Box>
              {config.website.externalLinks.map(({ name, url }, i) => (
                <NavLink
                  key={i}
                  label={name}
                  leftSection={<IconExternalLink size='1rem' />}
                  variant='light'
                  component={Link}
                  to={url}
                  target='_blank'
                />
              ))}
            </Box>
          </ScrollArea>
        </div>
      </AppShell.Navbar>

      <AppShell.Main>
        <ConfigProvider data={loaderData}>
          <Paper withBorder m='md' p='xs' radius='md'>
            <Outlet />
          </Paper>
        </ConfigProvider>
      </AppShell.Main>

      <AppShell.Footer display='none' />
    </AppShell>
  );
}
