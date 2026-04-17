import * as React from 'react';
import type { ModalProps } from '@patternfly/react-core';
import { useEffect, useState } from 'react';
import {
  Button,
  ButtonVariant,
  Content,
  ContentVariants,
  Modal,
  ModalBody,
  ModalHeader,
  ModalVariant
} from '@patternfly/react-core';
import { ListManager, ListManagerItem } from '@patternfly/react-component-groups';

/**
 * Column definition for {@link ListColumnManagementModal} — matches PatternFly
 * {@link @patternfly/react-component-groups#ColumnManagementModalColumn}.
 */
export interface ColumnManagementModalColumn {
  isShown?: boolean;
  isShownByDefault: boolean;
  isUntoggleable?: boolean;
  key: string;
  title: React.ReactNode;
}

export interface ListColumnManagementModalProps extends Omit<ModalProps, 'children' | 'ref'> {
  appliedColumns: ColumnManagementModalColumn[];
  applyColumns: (newColumns: ColumnManagementModalColumn[]) => void;
  description?: string;
  enableDragDrop?: boolean;
  /**
   * When set, "Reset to default" delegates to the parent (e.g. clear Redux + URL column state)
   * so list pages can reset order and visibility without DOM hacks. The parent should update
   * `appliedColumns` from canonical defaults; this modal syncs via useEffect.
   */
  onResetToDefault?: () => void;
  title?: string;
}

/**
 * Reusable column management modal for list pages, based on PatternFly's ColumnManagementModal
 * with an optional {@link onResetToDefault} hook for URL/Redux-backed column state.
 */
export const ListColumnManagementModal: React.FC<ListColumnManagementModalProps> = ({
  title = 'Manage columns',
  description = 'Selected categories will be displayed in the table.',
  isOpen = false,
  onClose = () => undefined,
  appliedColumns,
  applyColumns,
  ouiaId = 'ColumnManagementModal',
  enableDragDrop = false,
  onResetToDefault,
  ...modalProps
}: ListColumnManagementModalProps) => {
  const titleId = `${String(ouiaId)}-title`;
  const descriptionId = `${String(ouiaId)}-description`;
  const [currentColumns, setCurrentColumns] = useState(() =>
    appliedColumns.map(column => ({ ...column, isShown: column.isShown ?? column.isShownByDefault }))
  );

  useEffect(() => {
    setCurrentColumns(
      appliedColumns.map(column => ({ ...column, isShown: column.isShown ?? column.isShownByDefault }))
    );
  }, [appliedColumns]);

  const listManagerItems: ListManagerItem[] = currentColumns.map(column => ({
    key: column.key,
    title: column.title,
    isSelected: column.isShown,
    isShownByDefault: column.isShownByDefault,
    isUntoggleable: column.isUntoggleable
  }));

  const resetToDefault = (): void => {
    if (onResetToDefault) {
      onResetToDefault();
    } else {
      setCurrentColumns(currentColumns.map(column => ({ ...column, isShown: column.isShownByDefault ?? false })));
    }
  };

  const updateColumns = (items: ListManagerItem[]): void => {
    const newColumns = currentColumns.map(column => {
      const matchingItem = items.find(item => item.key === column.key);
      return matchingItem ? { ...column, isShown: matchingItem.isSelected ?? column.isShownByDefault } : column;
    });
    setCurrentColumns(newColumns);
  };

  const handleSelect = (item: ListManagerItem): void => {
    updateColumns([item]);
  };

  const handleSelectAll = (items: ListManagerItem[]): void => {
    updateColumns(items);
  };

  const handleOrderChange = (items: ListManagerItem[]): void => {
    const newColumns = items.map(item => {
      const originalColumn = currentColumns.find(col => col.key === item.key);
      if (!originalColumn) {
        throw new Error(`Column with key ${item.key} not found`);
      }
      return { ...originalColumn, isShown: item.isSelected ?? originalColumn.isShownByDefault };
    });
    setCurrentColumns(newColumns);
  };

  const handleSave = (items: ListManagerItem[]): void => {
    const updatedColumns = items.map(item => ({
      key: item.key,
      title: item.title,
      isShown: item.isSelected,
      isShownByDefault: item.isShownByDefault,
      isUntoggleable: item.isUntoggleable
    }));
    applyColumns(updatedColumns);
    onClose({} as KeyboardEvent);
  };

  const handleCancel = (): void => {
    onClose({} as KeyboardEvent);
  };

  return (
    <Modal
      {...modalProps}
      aria-describedby={descriptionId}
      aria-labelledby={titleId}
      isOpen={isOpen}
      onClose={onClose}
      ouiaId={ouiaId}
      variant={ModalVariant.small}
    >
      <ModalHeader
        description={
          <>
            <Content component={ContentVariants.p}>{description}</Content>
            <Button isInline onClick={resetToDefault} variant={ButtonVariant.link} ouiaId={`${ouiaId}-reset-button`}>
              Reset to default
            </Button>
          </>
        }
        descriptorId={descriptionId}
        labelId={titleId}
        title={title}
      />
      <ModalBody>
        <ListManager
          columns={listManagerItems}
          ouiaId={ouiaId}
          onSelect={handleSelect}
          onSelectAll={handleSelectAll}
          onOrderChange={handleOrderChange}
          onSave={handleSave}
          onCancel={handleCancel}
          enableDragDrop={enableDragDrop}
        />
      </ModalBody>
    </Modal>
  );
};
