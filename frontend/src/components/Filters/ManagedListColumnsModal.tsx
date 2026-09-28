import * as React from 'react';
import { ColumnManagementModal } from '@patternfly/react-component-groups';
import type { ManagedListColumnsConfig } from '../../hooks/useManagedListColumns';
import { useManagedListColumns } from '../../hooks/useManagedListColumns';
import { useKialiTranslation } from 'utils/I18nUtils';

type ManagedListColumnsModalProps = ManagedListColumnsConfig & {
  isOpen: boolean;
  onClose: () => void;
};

export const ManagedListColumnsModal: React.FC<ManagedListColumnsModalProps> = ({ isOpen, onClose, ...config }) => {
  const { t } = useKialiTranslation();
  const { appliedColumns, applyColumns, resetColumnsToDefault } = useManagedListColumns(config);

  return (
    <ColumnManagementModal
      appliedColumns={appliedColumns}
      applyColumns={applyColumns}
      description={t('Selected categories will be displayed in the table. Drag and drop to reorder columns.')}
      enableDragDrop={true}
      isOpen={isOpen}
      onClose={onClose}
      onReset={resetColumnsToDefault}
      ouiaId="ColumnManagementModal"
      title={t('Manage columns')}
    />
  );
};
