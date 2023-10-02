import * as React from 'react';
import {
  Button,
  ButtonVariant,
  Dropdown,
  DropdownItem,
  DropdownList,
  MenuToggle,
  MenuToggleElement,
  Modal,
  ModalVariant,
  Text,
  TextVariants,
  Tooltip,
  TooltipPosition
} from '@patternfly/react-core';
import { serverConfig } from '../../config';
import { kialiStyle } from 'styles/StyleUtils';

type IstioActionDropdownProps = {
  canDelete: boolean;
  objectKind?: string;
  objectName: string;

  onDelete: () => void;
};

const optionDisabledStyle = kialiStyle({
  cursor: 'not-allowed',
  $nest: {
    '& button': {
      pointerEvents: 'none'
    }
  }
});

export const IstioActionDropdown: React.FC<IstioActionDropdownProps> = (props: IstioActionDropdownProps) => {
  const [showConfirmModal, setShowConfirmModal] = React.useState<boolean>(false);
  const [dropdownOpen, setDropdownOpen] = React.useState<boolean>(false);

  const onToggle = (dropdownState: boolean) => {
    setDropdownOpen(dropdownState);
  };

  const hideConfirmModal = () => {
    setShowConfirmModal(false);
  };

  const onClickDelete = () => {
    setShowConfirmModal(true);
  };

  const onDelete = () => {
    setShowConfirmModal(false);
    props.onDelete();
  };

  const renderTooltip = (
    key: string,
    position: TooltipPosition,
    msg: string,
    child: React.ReactElement
  ): JSX.Element => {
    return (
      <Tooltip key={'tooltip_' + key} position={position} content={<>{msg}</>}>
        <div className={optionDisabledStyle}>{child}</div>
      </Tooltip>
    );
  };

  const objectName = props.objectKind ?? 'Istio object';

  const deleteAction = (
    <DropdownItem key="delete" onClick={onClickDelete} isDisabled={!props.canDelete}>
      Delete
    </DropdownItem>
  );

  const deleteActionWrapper = serverConfig.deployment.viewOnlyMode
    ? renderTooltip('delete', TooltipPosition.left, 'User does not have permission', deleteAction)
    : deleteAction;

  return (
    <>
      <Dropdown
        id="actions"
        toggle={(toggleRef: React.Ref<MenuToggleElement>) => (
          <MenuToggle ref={toggleRef} onClick={() => onToggle(!dropdownOpen)} isExpanded={dropdownOpen}>
            Actions
          </MenuToggle>
        )}
        isOpen={dropdownOpen}
        onOpenChange={(isOpen: boolean) => onToggle(isOpen)}
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
        <Text component={TextVariants.p}>
          Are you sure you want to delete the {objectName} '{props.objectName}'? It cannot be undone. Make sure this is
          something you really want to do!
        </Text>
      </Modal>
    </>
  );
};
