import * as React from 'react';
import {
  Button,
  ButtonVariant,
  Dropdown,
  DropdownItem,
  DropdownList,
  MenuToggle,
  MenuToggleElement,
  Content,
  ContentVariants,
  TooltipPosition
} from '@patternfly/react-core';
import { Modal, ModalVariant } from '@patternfly/react-core/deprecated';
import { serverConfig } from '../../config';
import { renderDisabledDropdownOption } from 'utils/DropdownUtils';
import { t } from 'utils/I18nUtils';

type IstioActionDropdownProps = {
  canDelete: boolean;
  objectKind?: string;
  objectName: string;
  onDelete: () => void;
};

export const IstioActionDropdown: React.FC<IstioActionDropdownProps> = (props: IstioActionDropdownProps) => {
  const [showConfirmModal, setShowConfirmModal] = React.useState<boolean>(false);
  const [dropdownOpen, setDropdownOpen] = React.useState<boolean>(false);

  const onSelect = (): void => {
    setDropdownOpen(!dropdownOpen);
  };

  const onToggle = (dropdownState: boolean): void => {
    setDropdownOpen(dropdownState);
  };

  const hideConfirmModal = (): void => {
    setShowConfirmModal(false);
  };

  const onClickDelete = (): void => {
    setShowConfirmModal(true);
  };

  const onDelete = (): void => {
    setShowConfirmModal(false);
    props.onDelete();
  };

  const objectName = props.objectKind ?? 'Istio object';

  const deleteAction = (
    <DropdownItem key="delete" onClick={onClickDelete} isDisabled={!props.canDelete}>
      Delete
    </DropdownItem>
  );

  const deleteActionWrapper = serverConfig.deployment.viewOnlyMode
    ? renderDisabledDropdownOption(
        'delete',
        TooltipPosition.left,
        t('No user permission or Kiali in view-only mode'),
        deleteAction
      )
    : deleteAction;

  return (
    <>
      <Dropdown
        id="actions"
        toggle={(toggleRef: React.Ref<MenuToggleElement>) => (
          <MenuToggle
            ref={toggleRef}
            id="actions-toggle"
            onClick={() => onToggle(!dropdownOpen)}
            isExpanded={dropdownOpen}
          >
            Actions
          </MenuToggle>
        )}
        isOpen={dropdownOpen}
        onOpenChange={(isOpen: boolean) => onToggle(isOpen)}
        onSelect={onSelect}
        popperProps={{ position: 'right' }}
      >
        <DropdownList>{[deleteActionWrapper]}</DropdownList>
      </Dropdown>

      <Modal
        title="Confirm Delete"
        variant={ModalVariant.small}
        isOpen={showConfirmModal}
        onClose={hideConfirmModal}
        actions={[
          <Button key="confirm" variant={ButtonVariant.danger} onClick={onDelete}>
            Delete
          </Button>,
          <Button key="cancel" variant={ButtonVariant.secondary} onClick={hideConfirmModal}>
            Cancel
          </Button>
        ]}
      >
        <Content component={ContentVariants.p}>
          Are you sure you want to delete the {objectName} '{props.objectName}'? It cannot be undone. Make sure this is
          something you really want to do!
        </Content>
      </Modal>
    </>
  );
};
