import * as React from 'react';
import { Button } from 'patternfly-react';
type Props = {
  objectName: string;
  readOnly: boolean;
  canUpdate: boolean;
  onCancel: () => void;
  onUpdate: () => void;
  onRefresh: () => void;
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
        <span style={{ float: 'left', paddingTop: '10px', paddingBottom: '10px' }}>
          {!this.props.readOnly && (
            <span style={{ paddingRight: '5px' }}>
              <Button bsStyle="primary" disabled={!this.props.canUpdate} onClick={this.props.onUpdate}>
                Save
              </Button>
            </span>
          )}
          <span style={{ paddingRight: '5px' }}>
            <Button onClick={this.props.onRefresh}>Reload</Button>
          </span>
          <span style={{ paddingRight: '5px' }}>
            <Button onClick={this.props.onCancel}>{this.props.readOnly ? 'Close' : 'Cancel'}</Button>
          </span>
        </span>
      </>
    );
  }
}
export default IstioActionButtons;
