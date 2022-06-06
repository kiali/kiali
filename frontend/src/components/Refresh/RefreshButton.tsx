import * as React from 'react';
import { connect } from 'react-redux';
import { Button, ButtonVariant, Tooltip } from '@patternfly/react-core';
import { SyncAltIcon } from '@patternfly/react-icons';
import { TimeInMilliseconds } from '../../types/Common';
import { KialiAppAction } from '../../actions/KialiAppAction';
import { KialiAppState } from '../../store/Store';
import { ThunkDispatch } from 'redux-thunk';
import { GlobalActions } from '../../actions/GlobalActions';

type ComponentProps = {
  id?: string;
  disabled?: boolean;
  handleRefresh: () => void;
};

type ReduxProps = {
  setLastRefreshAt: (lastRefreshAt: TimeInMilliseconds) => void;
};

type Props = ComponentProps & ReduxProps;

class RefreshButton extends React.Component<Props> {
  getElementId() {
    return this.props.id || 'refresh_button';
  }

  getDisabled() {
    return this.props.disabled || false;
  }

  render() {
    return (
      <Tooltip position="bottom" content={<>Refresh</>}>
        <Button
          id={this.getElementId()}
          data-test="refresh-button"
          onClick={this.handleRefresh}
          isDisabled={this.getDisabled()}
          aria-label="Action"
          variant={ButtonVariant.primary}
        >
          <SyncAltIcon />
        </Button>
      </Tooltip>
    );
  }

  private handleRefresh = () => {
    this.props.setLastRefreshAt(Date.now());
    this.props.handleRefresh();
  };
}

const mapDispatchToProps = (dispatch: ThunkDispatch<KialiAppState, void, KialiAppAction>) => {
  return {
    setLastRefreshAt: (lastRefreshAt: TimeInMilliseconds) => {
      dispatch(GlobalActions.setLastRefreshAt(lastRefreshAt));
    }
  };
};

const RefreshButtonContainer = connect(null, mapDispatchToProps)(RefreshButton);

export default RefreshButtonContainer;
