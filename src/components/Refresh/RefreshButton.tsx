import * as React from 'react';
import { connect } from 'react-redux';
import { Button, Icon } from 'patternfly-react';
import { TimeInMilliseconds } from '../../types/Common';
import { KialiAppAction } from '../../actions/KialiAppAction';
import { KialiAppState } from '../../store/Store';
import { ThunkDispatch } from 'redux-thunk';
import { GlobalActions } from '../../actions/GlobalActions';
import { style } from 'typestyle';

type ComponentProps = {
  id?: string;
  disabled?: boolean;
  handleRefresh: () => void;
};

type ReduxProps = {
  setLastRefreshAt: (lastRefreshAt: TimeInMilliseconds) => void;
};

type Props = ComponentProps & ReduxProps;

const refreshButtonStyle = style({
  marginLeft: '0.5em'
});

class RefreshButton extends React.Component<Props> {
  getElementId() {
    return this.props.id || 'refresh_button';
  }

  getDisabled() {
    return this.props.disabled || false;
  }

  render() {
    return (
      <Button
        id={this.getElementId()}
        onClick={this.handleRefresh}
        disabled={this.getDisabled()}
        className={refreshButtonStyle}
      >
        <Icon name="refresh" />
      </Button>
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

const RefreshButtonContainer = connect(
  null,
  mapDispatchToProps
)(RefreshButton);

export default RefreshButtonContainer;
