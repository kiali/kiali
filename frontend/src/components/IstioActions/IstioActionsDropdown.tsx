import * as React from 'react';
import {
  Button,
  Dropdown,
  DropdownItem,
  DropdownPosition,
  DropdownToggle,
  Modal,
  ModalVariant,
  Text,
  TextVariants,
  Tooltip,
  TooltipPosition
} from '@patternfly/react-core';
import { serverConfig } from '../../config';

type Props = {
  objectKind?: string;
  objectName: string;
  canDelete: boolean;
  onDelete: () => void;
};

type State = {
  showConfirmModal: boolean;
  dropdownOpen: boolean;
};

class IstioActionDropdown extends React.Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = {
      showConfirmModal: false,
      dropdownOpen: false
    };
  }

  onSelect = _ => {
    this.setState({
      dropdownOpen: !this.state.dropdownOpen
    });
  };

  onToggle = (dropdownState: boolean) => {
    this.setState({
      dropdownOpen: dropdownState
    });
  };

  hideConfirmModal = () => {
    this.setState({ showConfirmModal: false });
  };

  onClickDelete = () => {
    this.setState({ showConfirmModal: true });
  };

  onDelete = () => {
    this.hideConfirmModal();
    this.props.onDelete();
  };

  renderTooltip = (key, position, msg, child): JSX.Element => {
    return (
      <Tooltip key={'tooltip_' + key} position={position} content={<>{msg}</>}>
        <div style={{ display: 'inline-block', cursor: 'not-allowed', textAlign: 'left' }}>{child}</div>
      </Tooltip>
    );
  };

  render() {
    const objectName = this.props.objectKind ? this.props.objectKind : 'Istio object';
    const deleteAction = (
      <DropdownItem key="delete" onClick={this.onClickDelete} isDisabled={!this.props.canDelete}>
        Delete
      </DropdownItem>
    );
    const deleteActionWrapper = serverConfig.deployment.viewOnlyMode
      ? this.renderTooltip('delete', TooltipPosition.left, 'User does not have permission', deleteAction)
      : deleteAction;

    return (
      <>
        <Dropdown
          id="actions"
          toggle={<DropdownToggle onToggle={this.onToggle}>Actions</DropdownToggle>}
          onSelect={this.onSelect}
          position={DropdownPosition.right}
          isOpen={this.state.dropdownOpen}
          dropdownItems={[deleteActionWrapper]}
        />
        <Modal
          title="Confirm Delete"
          variant={ModalVariant.small}
          isOpen={this.state.showConfirmModal}
          onClose={this.hideConfirmModal}
          actions={[
            <Button key="cancel" variant="secondary" onClick={this.hideConfirmModal}>
              Cancel
            </Button>,
            <Button key="confirm" variant="danger" onClick={this.onDelete}>
              Delete
            </Button>
          ]}
        >
          <Text component={TextVariants.p}>
            Are you sure you want to delete the {objectName} '{this.props.objectName}'? It cannot be undone. Make sure
            this is something you really want to do!
          </Text>
        </Modal>
      </>
    );
  }
}

export default IstioActionDropdown;
