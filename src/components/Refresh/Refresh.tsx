import * as React from 'react';
import { connect } from 'react-redux';
import { ThunkDispatch } from 'redux-thunk';
import { KialiAppState } from '../../store/Store';
import { refreshIntervalSelector } from '../../store/Selectors';
import { config } from '../../config';
import { PollIntervalInMs, TimeInMilliseconds } from '../../types/Common';
import { UserSettingsActions } from '../../actions/UserSettingsActions';
import { KialiAppAction } from '../../actions/KialiAppAction';
import { ToolbarDropdown } from '../ToolbarDropdown/ToolbarDropdown';
import RefreshButtonContainer from './RefreshButton';
import { GlobalActions } from '../../actions/GlobalActions';

type ComponentProps = {
  id: string;
  handleRefresh: () => void;
  hideLabel?: boolean;
};

type ReduxProps = {
  refreshInterval: PollIntervalInMs;
  setRefreshInterval: (pollInterval: PollIntervalInMs) => void;
  setLastRefreshAt: (lastRefreshAt: TimeInMilliseconds) => void;
};

type Props = ComponentProps & ReduxProps;

type State = {
  pollerRef?: number;
};

const POLL_INTERVALS = config.toolbar.pollInterval;

class Refresh extends React.Component<Props, State> {
  constructor(props: Props) {
    super(props);
    let pollerRef: number | undefined = undefined;
    if (this.props.refreshInterval) {
      pollerRef = window.setInterval(this.handleRefresh, this.props.refreshInterval);
    }
    this.state = {
      pollerRef: pollerRef
    };
  }

  componentWillUnmount() {
    if (this.state.pollerRef) {
      clearInterval(this.state.pollerRef);
    }
  }

  updatePollInterval = (pollInterval: PollIntervalInMs) => {
    let newRefInterval: number | undefined = undefined;
    if (this.state.pollerRef) {
      clearInterval(this.state.pollerRef);
    }
    if (pollInterval > 0) {
      newRefInterval = window.setInterval(this.handleRefresh, pollInterval);
    }
    this.setState({ pollerRef: newRefInterval });
    this.props.setRefreshInterval(pollInterval); // notify redux of the change
  };

  render() {
    if (this.props.refreshInterval !== undefined) {
      const { hideLabel } = this.props;
      return (
        <>
          {!hideLabel && <label style={{ paddingRight: '0.5em', marginLeft: '1.5em' }}>Refreshing</label>}
          <ToolbarDropdown
            id={this.props.id}
            handleSelect={value => this.updatePollInterval(Number(value))}
            value={this.props.refreshInterval}
            label={POLL_INTERVALS[this.props.refreshInterval]}
            options={POLL_INTERVALS}
            tooltip={'Refresh interval'}
          />
          <span style={{ paddingLeft: '0.5em' }}>
            <RefreshButtonContainer id={this.props.id + '_btn'} handleRefresh={this.props.handleRefresh} />
          </span>
        </>
      );
    } else {
      return <RefreshButtonContainer handleRefresh={this.props.handleRefresh} />;
    }
  }

  private handleRefresh = () => {
    this.props.setLastRefreshAt(Date.now());
    this.props.handleRefresh();
  };
}

const mapStateToProps = (state: KialiAppState) => ({
  refreshInterval: refreshIntervalSelector(state)
});

const mapDispatchToProps = (dispatch: ThunkDispatch<KialiAppState, void, KialiAppAction>) => {
  return {
    setRefreshInterval: (refresh: PollIntervalInMs) => {
      dispatch(UserSettingsActions.setRefreshInterval(refresh));
    },
    setLastRefreshAt: (lastRefreshAt: TimeInMilliseconds) => {
      dispatch(GlobalActions.setLastRefreshAt(lastRefreshAt));
    }
  };
};

const RefreshContainer = connect(
  mapStateToProps,
  mapDispatchToProps
)(Refresh);

export default RefreshContainer;
