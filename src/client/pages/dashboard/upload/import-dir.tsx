import UploadImportDir from '@/components/pages/upload/ImportDir';
import { useTitle } from '@/lib/client/hooks/useTitle';

export function Component() {
  useTitle('Import Directory');

  return <UploadImportDir />;
}

Component.displayName = 'Dashboard/Upload/ImportDir';
