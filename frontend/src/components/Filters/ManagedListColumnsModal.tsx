import * as React from 'react';
import { useEffect } from 'react';
import { ColumnManagementModal } from '@patternfly/react-component-groups';
import type { ColumnManagementModalColumn } from '@patternfly/react-component-groups';
import { type ManagedListColumnsConfig, useManagedListColumns } from '../../hooks/useManagedListColumns';
import { t } from 'utils/I18nUtils';

type ManagedListColumnsModalProps = ManagedListColumnsConfig & {
  isOpen: boolean;
  onClose: () => void;
};

export const ManagedListColumnsModal: React.FC<ManagedListColumnsModalProps> = ({ isOpen, onClose, ...config }) => {
  const { appliedColumns, applyColumns, resetColumnsToDefault, syncColumnsFromURL } = useManagedListColumns(config);

  useEffect(() => {
    syncColumnsFromURL();
    // Mount-only URL hydration, matching prior class component componentDidMount behavior.
    // eslint-disable-next-line react-hooks/exhaustive-deps, @eslint-react/exhaustive-deps
  }, []);

  const handleApplyColumns = (newColumns: ColumnManagementModalColumn[]): void => {
    applyColumns(newColumns);
    onClose();
  };

  return (
    <ColumnManagementModal
      appliedColumns={appliedColumns}
      applyColumns={handleApplyColumns}
      description={t('Selected categories will be displayed in the table. Drag and drop to reorder columns.')}
      enableDragDrop={true}
      isOpen={isOpen}
      onClose={onClose}
      onReset={resetColumnsToDefault}
      title={t('Manage columns')}
    />
  );
};
