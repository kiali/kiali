import * as React from 'react';
import { Button, ButtonVariant } from '@patternfly/react-core';
import { triggerRefresh } from "../../hooks/refresh";

type Props = {
  objectName: string;
  readOnly: boolean;
  canUpdate: boolean;
  onCancel: () => void;
  onUpdate: () => void;
  onRefresh: () => void;
  showOverview: boolean;
  overview: boolean;
  onOverview: () => void;
};

type State = {
  showConfirmModal: boolean;
};

class IstioActionButtons extends React.Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { showConfirmModal: false };
  }
  hideConfirmModal = () => {
    this.setState({ showConfirmModal: false });
  };
  render() {
    return (
      <>
        <span style={{ float: 'left', padding: '10px' }}>
          {!this.props.readOnly && (
            <span style={{ paddingRight: '5px' }}>
              <Button variant={ButtonVariant.primary} isDisabled={!this.props.canUpdate} onClick={this.props.onUpdate}>
                Save
              </Button>
            </span>
          )}
          <span style={{ paddingRight: '5px' }}>
            <Button variant={ButtonVariant.secondary} onClick={this.handleRefresh}>
              Reload
            </Button>
          </span>
          <span style={{ paddingRight: '5px' }}>
            <Button variant={ButtonVariant.secondary} onClick={this.props.onCancel}>
              {this.props.readOnly ? 'Close' : 'Cancel'}
            </Button>
          </span>
        </span>
        {this.props.showOverview && (
          <span style={{ float: 'right', padding: '10px' }}>
            <span style={{ paddingLeft: '5px' }}>
              <Button variant={ButtonVariant.link} onClick={this.props.onOverview}>
                {this.props.overview ? 'Close Overview' : 'Show Overview'}
              </Button>
            </span>
          </span>
        )}
      </>
    );
  }

  private handleRefresh = () => {
    this.props.onRefresh();
    triggerRefresh();
  };
}

export default IstioActionButtons;
