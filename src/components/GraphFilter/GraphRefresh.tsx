import * as React from 'react';
import { Button, MenuItem, Icon, DropdownButton } from 'patternfly-react';
import { style } from 'typestyle';
import { connect } from 'react-redux';
import { ThunkDispatch } from 'redux-thunk';
import { bindActionCreators } from 'redux';

import { KialiAppState, ServerConfig } from '../../store/Store';
import { durationSelector, refreshIntervalSelector, serverConfigSelector } from '../../store/Selectors';
import { KialiAppAction } from '../../actions/KialiAppAction';
import { UserSettingsActions } from '../../actions/UserSettingsActions';

import { DurationInSeconds, PollIntervalInMs } from '../../types/Common';

import { config } from '../../config/config';
import { HistoryManager, URLParams } from '../../app/History';
import { ListPagesHelper } from '../../components/ListPage/ListPagesHelper';
import ToolbarDropdown from '../ToolbarDropdown/ToolbarDropdown';
import { getValidDurations, getValidDuration } from '../../config/serverConfig';

//
// GraphRefresh actually handles the Duration dropdown, the RefreshInterval dropdown and the Refresh button.
//

type ReduxProps = {
  duration: DurationInSeconds;
  refreshInterval: PollIntervalInMs;
  serverConfig: ServerConfig;

  setDuration: (duration: DurationInSeconds) => void;
  setRefreshInterval: (refreshInterval: PollIntervalInMs) => void;
};

type GraphRefreshProps = ReduxProps & {
  disabled: boolean;
  id: string;
  handleRefresh: () => void;
};

export class GraphRefresh extends React.PureComponent<GraphRefreshProps> {
  static readonly DURATION_LIST = config.toolbar.intervalDuration;
  static readonly POLL_INTERVAL_LIST = config.toolbar.pollInterval;

  static readonly durationLabelStyle = style({
    paddingRight: '0.5em',
    marginLeft: '1.5em'
  });

  static readonly refreshButtonStyle = style({
    paddingLeft: '0.5em'
  });

  constructor(props: GraphRefreshProps) {
    super(props);

    // Let URL override current redux state at construction time
    const urlDuration = ListPagesHelper.getSingleIntQueryParam(URLParams.DURATION);
    const urlPollInterval = ListPagesHelper.getSingleIntQueryParam(URLParams.POLL_INTERVAL);
    if (urlDuration !== undefined && urlDuration !== props.duration) {
      props.setDuration(urlDuration);
    }
    if (urlPollInterval !== undefined && urlPollInterval !== props.refreshInterval) {
      props.setRefreshInterval(urlPollInterval);
    }
    HistoryManager.setParam(URLParams.DURATION, String(this.props.duration));
    HistoryManager.setParam(URLParams.POLL_INTERVAL, String(this.props.refreshInterval));
  }

  componentDidUpdate() {
    // ensure redux state and URL are aligned
    HistoryManager.setParam(URLParams.DURATION, String(this.props.duration));
    HistoryManager.setParam(URLParams.POLL_INTERVAL, String(this.props.refreshInterval));
  }

  render() {
    const retention = this.props.serverConfig.prometheus.storageTsdbRetention;
    const validDurations = getValidDurations(GraphRefresh.DURATION_LIST, retention);
    const validDuration = getValidDuration(validDurations, this.props.duration);

    return (
      <>
        <label className={GraphRefresh.durationLabelStyle}>Display</label>
        <ToolbarDropdown
          id={'graph_filter_duration'}
          disabled={this.props.disabled}
          handleSelect={this.handleDurationChange}
          value={validDuration}
          label={String(validDurations[validDuration])}
          options={validDurations}
        />
        <DropdownButton
          id="graph_refresh_dropdown"
          title={GraphRefresh.POLL_INTERVAL_LIST[this.props.refreshInterval]}
          disabled={this.props.disabled}
        >
          {Object.keys(GraphRefresh.POLL_INTERVAL_LIST).map((key: any) => {
            return (
              <MenuItem
                key={key}
                eventKey={key}
                active={Number(key) === this.props.refreshInterval}
                onSelect={value => this.props.setRefreshInterval(Number(value))}
              >
                {GraphRefresh.POLL_INTERVAL_LIST[key]}
              </MenuItem>
            );
          })}
        </DropdownButton>
        <span className={GraphRefresh.refreshButtonStyle}>
          <Button id="refresh_button" onClick={this.props.handleRefresh} disabled={this.props.disabled}>
            <Icon name="refresh" />
          </Button>
        </span>
      </>
    );
  }

  private handleDurationChange = (duration: string) => {
    this.props.setDuration(Number(duration));
  };
}

const mapStateToProps = (state: KialiAppState) => ({
  duration: durationSelector(state),
  refreshInterval: refreshIntervalSelector(state),
  serverConfig: serverConfigSelector(state)
});

const mapDispatchToProps = (dispatch: ThunkDispatch<KialiAppState, void, KialiAppAction>) => {
  return {
    setDuration: bindActionCreators(UserSettingsActions.setDuration, dispatch),
    setRefreshInterval: bindActionCreators(UserSettingsActions.setRefreshInterval, dispatch)
  };
};

const GraphRefreshContainer = connect(
  mapStateToProps,
  mapDispatchToProps
)(GraphRefresh);

export default GraphRefreshContainer;
