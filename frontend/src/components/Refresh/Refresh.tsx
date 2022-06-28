import * as React from 'react';
import { connect } from 'react-redux';
import { ThunkDispatch } from 'redux-thunk';
import { KialiAppState } from '../../store/Store';
import { refreshIntervalSelector } from '../../store/Selectors';
import { config } from '../../config';
import { IntervalInMilliseconds, TimeInMilliseconds } from '../../types/Common';
import { UserSettingsActions } from '../../actions/UserSettingsActions';
import { KialiAppAction } from '../../actions/KialiAppAction';
import { ToolbarDropdown } from '../ToolbarDropdown/ToolbarDropdown';
import RefreshButtonContainer from './RefreshButton';
import { GlobalActions } from '../../actions/GlobalActions';
import { HistoryManager, URLParam } from 'app/History';
import { TooltipPosition } from '@patternfly/react-core';

type ReduxProps = {
  refreshInterval: IntervalInMilliseconds;
  setRefreshInterval: (refreshInterval: IntervalInMilliseconds) => void;
  setLastRefreshAt: (lastRefreshAt: TimeInMilliseconds) => void;
};

type ComponentProps = {
  id: string;
  disabled?: boolean;
  hideLabel?: boolean;
  manageURL?: boolean;

  handleRefresh?: () => void;
};

type Props = ComponentProps & ReduxProps;

type State = {
  refresherRef?: number;
};

const REFRESH_INTERVALS = config.toolbar.refreshInterval;

class Refresh extends React.PureComponent<Props, State> {
  constructor(props: Props) {
    super(props);

    // Let URL override current redux state at construction time
    if (props.manageURL) {
      let refreshInterval = HistoryManager.getNumericParam(URLParam.REFRESH_INTERVAL);
      if (refreshInterval === undefined) {
        refreshInterval = props.refreshInterval;
      }
      if (refreshInterval !== props.refreshInterval) {
        props.setRefreshInterval(refreshInterval);
      }
      HistoryManager.setParam(URLParam.REFRESH_INTERVAL, String(refreshInterval));
    }

    this.state = {
      refresherRef: undefined
    };
  }

  componentDidMount() {
    this.updateRefresher();
  }

  componentDidUpdate(prevProps: Props) {
    // ensure redux state and URL are aligned
    if (this.props.manageURL) {
      HistoryManager.setParam(URLParam.REFRESH_INTERVAL, String(this.props.refreshInterval));
    }
    if (prevProps.refreshInterval !== this.props.refreshInterval) {
      this.updateRefresher();
    }
  }

  componentWillUnmount() {
    if (this.state.refresherRef) {
      clearInterval(this.state.refresherRef);
    }
  }

  render() {
    if (this.props.refreshInterval !== undefined) {
      const { hideLabel } = this.props;
      return (
        <>
          {!hideLabel && <label style={{ paddingRight: '0.5em', marginLeft: '1.5em' }}>Refreshing</label>}
          <ToolbarDropdown
            id={this.props.id}
            handleSelect={value => this.updateRefreshInterval(Number(value))}
            value={String(this.props.refreshInterval)}
            label={REFRESH_INTERVALS[this.props.refreshInterval]}
            options={REFRESH_INTERVALS}
            tooltip={'Refresh interval'}
            tooltipPosition={TooltipPosition.left}
          />
          <RefreshButtonContainer handleRefresh={this.handleRefresh} disabled={this.props.disabled} />
        </>
      );
    } else {
      return <RefreshButtonContainer handleRefresh={this.handleRefresh} />;
    }
  }

  private updateRefresher = () => {
    if (this.state.refresherRef) {
      clearInterval(this.state.refresherRef);
    }
    let refresherRef: number | undefined = undefined;
    if (this.props.refreshInterval > 0) {
      refresherRef = window.setInterval(this.handleRefresh, this.props.refreshInterval);
      this.setState({ refresherRef: refresherRef });
    }
  };

  private updateRefreshInterval = (refreshInterval: IntervalInMilliseconds) => {
    this.props.setRefreshInterval(refreshInterval); // notify redux of the change
  };

  private handleRefresh = () => {
    this.props.setLastRefreshAt(Date.now());
    // Components may connect to the lastRefreshAt property instead to pass a refreshMethod
    if (this.props.handleRefresh) {
      this.props.handleRefresh();
    }
  };
}

const mapStateToProps = (state: KialiAppState) => ({
  refreshInterval: refreshIntervalSelector(state)
});

const mapDispatchToProps = (dispatch: ThunkDispatch<KialiAppState, void, KialiAppAction>) => {
  return {
    setRefreshInterval: (refresh: IntervalInMilliseconds) => {
      dispatch(UserSettingsActions.setRefreshInterval(refresh));
    },
    setLastRefreshAt: (lastRefreshAt: TimeInMilliseconds) => {
      dispatch(GlobalActions.setLastRefreshAt(lastRefreshAt));
    }
  };
};

const RefreshContainer = connect(mapStateToProps, mapDispatchToProps)(Refresh);

export default RefreshContainer;
