import * as React from 'react';
import { TimeInMilliseconds } from '../../types/Common';
import { connect } from 'react-redux';
import { ThunkDispatch } from 'redux-thunk';
import { KialiAppAction } from '../../actions/KialiAppAction';
import { KialiAppState } from '../../store/Store';
import { GlobalActions } from '../../actions/GlobalActions';
import { Button, ButtonVariant } from '@patternfly/react-core';

type ReduxProps = {
  setLastRefreshAt: (lastRefreshAt: TimeInMilliseconds) => void;
};

type Props = ReduxProps & {
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
      </>
    );
  }

  private handleRefresh = () => {
    this.props.onRefresh();
    this.props.setLastRefreshAt(Date.now());
  };
}

const mapDispatchToProps = (dispatch: ThunkDispatch<KialiAppState, void, KialiAppAction>) => {
  return {
    setLastRefreshAt: (lastRefreshAt: TimeInMilliseconds) => {
      dispatch(GlobalActions.setLastRefreshAt(lastRefreshAt));
    }
  };
};

const IstioActionButtonsContainer = connect(
  null,
  mapDispatchToProps
)(IstioActionButtons);

export default IstioActionButtonsContainer;
