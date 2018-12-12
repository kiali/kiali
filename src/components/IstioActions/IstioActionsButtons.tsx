import * as React from 'react';
import { Button } from 'patternfly-react';
type Props = {
  objectName: string;
  canUpdate: boolean;
  onCancel: () => void;
  onUpdate: () => void;
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
          <span style={{ paddingRight: '5px' }}>
            <Button bsStyle="primary" disabled={!this.props.canUpdate} onClick={this.props.onUpdate}>
              Save
            </Button>
          </span>
          <span style={{ paddingRight: '5px' }}>
            <Button onClick={this.props.onCancel}>Cancel</Button>
          </span>
        </span>
      </>
    );
  }
}
export default IstioActionButtons;
