import DashboardShares from '@/components/pages/shares';
import { useTitle } from '@/lib/client/hooks/useTitle';

export function Component() {
  useTitle('Shares');

  return <DashboardShares />;
}

Component.displayName = 'Dashboard/Shares';
