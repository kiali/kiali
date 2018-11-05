import * as React from 'react';
import { DropdownButton, MenuItem, MessageDialog } from 'patternfly-react';

type Props = {
  objectName: string;
  canDelete: boolean;
  onDelete: () => void;
};

type State = {
  showConfirmModal: boolean;
};

class IstioActionDropdown extends React.Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { showConfirmModal: false };
  }

  onAction = (key: string) => {
    if (key === 'delete') {
      this.setState({ showConfirmModal: true });
    }
  };

  hideConfirmModal = () => {
    this.setState({ showConfirmModal: false });
  };

  onDelete = () => {
    this.hideConfirmModal();
    this.props.onDelete();
  };

  render() {
    return (
      <>
        <DropdownButton id="actions" title="Actions" onSelect={this.onAction} pullRight={true}>
          <MenuItem key="delete" eventKey="delete" disabled={!this.props.canDelete}>
            Delete
          </MenuItem>
        </DropdownButton>
        <MessageDialog
          show={this.state.showConfirmModal}
          primaryAction={this.onDelete}
          secondaryAction={this.hideConfirmModal}
          onHide={this.hideConfirmModal}
          primaryActionButtonContent="Delete"
          secondaryActionButtonContent="Cancel"
          primaryActionButtonBsStyle="danger"
          title="Confirm Delete"
          primaryContent={`Are you sure you want to delete the Istio object '${this.props.objectName}'? `}
          secondaryContent="It cannot be undone. Make sure this is something you really want to do!"
          accessibleName="deleteConfirmationDialog"
          accessibleDescription="deleteConfirmationDialogContent"
        />
      </>
    );
  }
}

export default IstioActionDropdown;
