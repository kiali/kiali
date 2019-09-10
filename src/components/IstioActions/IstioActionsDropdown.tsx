import * as React from 'react';
import {
  Button,
  Dropdown,
  DropdownItem,
  DropdownPosition,
  DropdownToggle,
  Modal,
  Text,
  TextVariants
} from '@patternfly/react-core';

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

  onSelect = e => {
    console.log(e);
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

  render() {
    const objectName = this.props.objectKind ? this.props.objectKind : 'Istio object';

    return (
      <>
        <Dropdown
          id="actions"
          title="Actions"
          toggle={<DropdownToggle onToggle={this.onToggle}>Actions</DropdownToggle>}
          onSelect={this.onSelect}
          position={DropdownPosition.right}
          isOpen={this.state.dropdownOpen}
          dropdownItems={[
            <DropdownItem key="delete" onClick={this.onClickDelete} isDisabled={!this.props.canDelete}>
              Delete
            </DropdownItem>
          ]}
        />
        <Modal
          title="Confirm Delete"
          isSmall={true}
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
