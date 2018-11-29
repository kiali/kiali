import * as React from 'react';
import { Button, MenuItem, Icon, DropdownButton } from 'patternfly-react';
import { style } from 'typestyle';
import { connect } from 'react-redux';
import { ThunkDispatch } from 'redux-thunk';
import { bindActionCreators } from 'redux';

import { KialiAppState } from '../../store/Store';
import { durationSelector, refreshIntervalSelector } from '../../store/Selectors';
import { KialiAppAction } from '../../actions/KialiAppAction';
import { UserSettingsActions } from '../../actions/UserSettingsActions';

import { DurationInSeconds, PollIntervalInMs } from '../../types/Common';

import { config } from '../../config';
import { HistoryManager, URLParams } from '../../app/History';
import { ListPagesHelper } from '../../components/ListPage/ListPagesHelper';
import ToolbarDropdown from '../ToolbarDropdown/ToolbarDropdown';

//
// GraphRefresh actually handles the Duration dropdown, the RefreshInterval dropdown and the Refresh button.
//

type ReduxProps = {
  duration: DurationInSeconds;
  refreshInterval: PollIntervalInMs;

  setDuration: (duration: DurationInSeconds) => void;
  setRefreshInterval: (refreshInterval: PollIntervalInMs) => void;
};

type GraphRefreshProps = ReduxProps & {
  disabled: boolean;
  id: string;
  handleRefresh: () => void;
};

export class GraphRefresh extends React.PureComponent<GraphRefreshProps> {
  static readonly DURATION_LIST = config().toolbar.intervalDuration;
  static readonly POLL_INTERVAL_LIST = config().toolbar.pollInterval;

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

  formatRefreshText = (key, isTitle: boolean = false): string => {
    // Ensure that we have an integer (for comparisons).
    key = Number(key);

    if (isTitle) {
      return key !== 0 ? `Every ${GraphRefresh.POLL_INTERVAL_LIST[key]}` : 'Paused';
    } else {
      return key !== 0 ? `Every ${GraphRefresh.POLL_INTERVAL_LIST[key]}` : GraphRefresh.POLL_INTERVAL_LIST[key];
    }
  };

  render() {
    return (
      <>
        <label className={GraphRefresh.durationLabelStyle}>Fetching</label>
        <ToolbarDropdown
          id={'graph_filter_duration'}
          disabled={this.props.disabled}
          handleSelect={this.props.setDuration}
          value={this.props.duration}
          label={String(GraphRefresh.DURATION_LIST[this.props.duration])}
          options={GraphRefresh.DURATION_LIST}
        />
        <DropdownButton
          id="graph_refresh_dropdown"
          title={this.formatRefreshText(this.props.refreshInterval, true)}
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
                {this.formatRefreshText(key)}
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
}

const mapStateToProps = (state: KialiAppState) => ({
  duration: durationSelector(state),
  refreshInterval: refreshIntervalSelector(state)
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
