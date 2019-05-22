import * as React from 'react';
import { Button, Icon } from 'patternfly-react';
import { style } from 'typestyle';
import { connect } from 'react-redux';
import { ThunkDispatch } from 'redux-thunk';
import { bindActionCreators } from 'redux';

import { KialiAppState } from '../../store/Store';
import { durationSelector, refreshIntervalSelector } from '../../store/Selectors';
import { KialiAppAction } from '../../actions/KialiAppAction';
import { UserSettingsActions } from '../../actions/UserSettingsActions';

import { DurationInSeconds, PollIntervalInMs } from '../../types/Common';

import { config } from '../../config/Config';
import { HistoryManager, URLParam } from '../../app/History';
import ToolbarDropdown from '../ToolbarDropdown/ToolbarDropdown';
import { DurationDropdownContainer } from '../DurationDropdown/DurationDropdown';

//
// GraphRefresh actually handles the Duration dropdown, the RefreshInterval dropdown and the Refresh button.
//

type ReduxProps = {
  duration: DurationInSeconds;
  refreshInterval: PollIntervalInMs;

  setRefreshInterval: (refreshInterval: PollIntervalInMs) => void;
};

type GraphRefreshProps = ReduxProps & {
  disabled: boolean;
  id: string;
  handleRefresh: () => void;
};

export class GraphRefresh extends React.PureComponent<GraphRefreshProps> {
  static readonly POLL_INTERVAL_LIST = config.toolbar.pollInterval;

  static readonly refreshButtonStyle = style({
    paddingLeft: '0.5em'
  });

  constructor(props: GraphRefreshProps) {
    super(props);

    // Let URL override current redux state at construction time
    const urlPollInterval = HistoryManager.getNumericParam(URLParam.POLL_INTERVAL);
    if (urlPollInterval !== undefined && urlPollInterval !== props.refreshInterval) {
      props.setRefreshInterval(urlPollInterval);
    }
    HistoryManager.setParam(URLParam.DURATION, String(this.props.duration));
    HistoryManager.setParam(URLParam.POLL_INTERVAL, String(this.props.refreshInterval));
  }

  componentDidUpdate() {
    // ensure redux state and URL are aligned
    HistoryManager.setParam(URLParam.DURATION, String(this.props.duration));
    HistoryManager.setParam(URLParam.POLL_INTERVAL, String(this.props.refreshInterval));
  }

  render() {
    return (
      <>
        <DurationDropdownContainer
          id={'graph_filter_duration'}
          disabled={this.props.disabled}
          tooltip={'Time range for graph data'}
        />
        <ToolbarDropdown
          id="graph_refresh_dropdown"
          disabled={this.props.disabled}
          handleSelect={value => this.props.setRefreshInterval(Number(value))}
          value={this.props.refreshInterval}
          label={GraphRefresh.POLL_INTERVAL_LIST[this.props.refreshInterval]}
          options={GraphRefresh.POLL_INTERVAL_LIST}
          tooltip={'Refresh interval for graph'}
        />
        <span className={GraphRefresh.refreshButtonStyle}>
          <Button id="refresh_button" onClick={this.props.handleRefresh} disabled={this.props.disabled}>
            <Icon name="refresh" />
          </Button>
        </span>
      </>
    );
  }
}

const mapStateToProps = (state: KialiAppState) => ({
  duration: durationSelector(state),
  refreshInterval: refreshIntervalSelector(state)
});

const mapDispatchToProps = (dispatch: ThunkDispatch<KialiAppState, void, KialiAppAction>) => {
  return {
    setRefreshInterval: bindActionCreators(UserSettingsActions.setRefreshInterval, dispatch)
  };
};

const GraphRefreshContainer = connect(
  mapStateToProps,
  mapDispatchToProps
)(GraphRefresh);

export default GraphRefreshContainer;
