import * as React from 'react';
import { Button, ButtonGroup, FormGroup, Sort, ToolbarRightContent } from 'patternfly-react';
import { connect } from 'react-redux';
import { ThunkDispatch } from 'redux-thunk';

import { KialiAppAction } from '../../actions/KialiAppAction';
import { UserSettingsActions } from '../../actions/UserSettingsActions';
import history, { HistoryManager, URLParam } from '../../app/History';
import { StatefulFilters } from '../../components/Filters/StatefulFilters';
import * as ListPagesHelper from '../../components/ListPage/ListPagesHelper';
import RefreshContainer from '../../components/Refresh/Refresh';
import { ToolbarDropdown } from '../../components/ToolbarDropdown/ToolbarDropdown';
import { KialiAppState } from '../../store/Store';
import { durationSelector, refreshIntervalSelector } from '../../store/Selectors';
import { PollIntervalInMs, DurationInSeconds } from '../../types/Common';
import { SortField } from '../../types/SortFilters';

import NamespaceInfo from './NamespaceInfo';
import { AlignRightStyle, ThinStyle } from '../../components/Filters/FilterStyles';
import * as Sorts from './Sorts';
import * as Filters from './Filters';
import { DurationDropdownContainer } from '../../components/DurationDropdown/DurationDropdown';

type ReduxProps = {
  duration: DurationInSeconds;
  refreshInterval: PollIntervalInMs;
  setRefreshInterval: (refresh: PollIntervalInMs) => void;
};

type Props = ReduxProps & {
  onError: (msg: string) => void;
  onRefresh: () => void;
  sort: (sortField: SortField<NamespaceInfo>, isAscending: boolean) => void;
  displayMode: OverviewDisplayMode;
  setDisplayMode: (mode: OverviewDisplayMode) => void;
};

export enum OverviewDisplayMode {
  COMPACT,
  EXPAND
}

const overviewTypes = {
  app: 'Apps',
  workload: 'Workloads',
  service: 'Services'
};

export type OverviewType = keyof typeof overviewTypes;

type State = {
  isSortAscending: boolean;
  overviewType: OverviewType;
  sortField: SortField<NamespaceInfo>;
};

export class OverviewToolbar extends React.Component<Props, State> {
  static currentOverviewType(): OverviewType {
    const otype = HistoryManager.getParam(URLParam.OVERVIEW_TYPE);
    return (otype as OverviewType) || 'app';
  }

  constructor(props: Props) {
    super(props);
    // Let URL override current redux state at construction time
    const urlParams = new URLSearchParams(history.location.search);
    const urlPollInterval = HistoryManager.getNumericParam(URLParam.POLL_INTERVAL, urlParams);
    if (urlPollInterval !== undefined && urlPollInterval !== props.refreshInterval) {
      props.setRefreshInterval(urlPollInterval);
    }
    HistoryManager.setParam(URLParam.DURATION, String(this.props.duration));
    HistoryManager.setParam(URLParam.POLL_INTERVAL, String(this.props.refreshInterval));

    this.state = {
      isSortAscending: ListPagesHelper.isCurrentSortAscending(),
      overviewType: OverviewToolbar.currentOverviewType(),
      sortField: ListPagesHelper.currentSortField(Sorts.sortFields)
    };
  }

  componentDidUpdate(prevProps: Props) {
    // ensure redux state and URL are aligned
    HistoryManager.setParam(URLParam.DURATION, String(this.props.duration));
    HistoryManager.setParam(URLParam.POLL_INTERVAL, String(this.props.refreshInterval));

    const urlSortField = ListPagesHelper.currentSortField(Sorts.sortFields);
    const urlIsSortAscending = ListPagesHelper.isCurrentSortAscending();
    if (!this.paramsAreSynced(urlSortField, urlIsSortAscending) || this.props.duration !== prevProps.duration) {
      this.setState({
        sortField: urlSortField,
        isSortAscending: urlIsSortAscending
      });
      this.props.onRefresh();
    }
  }

  paramsAreSynced(urlSortField: SortField<NamespaceInfo>, urlIsSortAscending: boolean) {
    return urlIsSortAscending === this.state.isSortAscending && urlSortField.title === this.state.sortField.title;
  }

  updateSortField = (sortField: SortField<NamespaceInfo>) => {
    this.props.sort(sortField, this.state.isSortAscending);
    HistoryManager.setParam(URLParam.SORT, sortField.param);
    this.setState({ sortField: sortField });
  };

  updateSortDirection = () => {
    const newDir = !this.state.isSortAscending;
    this.props.sort(this.state.sortField, newDir);
    HistoryManager.setParam(URLParam.DIRECTION, newDir ? 'asc' : 'desc');
    this.setState({ isSortAscending: newDir });
  };

  updateOverviewType = (otype: OverviewType) => {
    HistoryManager.setParam(URLParam.OVERVIEW_TYPE, otype);
    this.setState({ overviewType: otype });
    this.props.onRefresh();
  };

  render() {
    return (
      <StatefulFilters initialFilters={Filters.availableFilters} onFilterChange={this.props.onRefresh}>
        <Sort style={{ ...ThinStyle }}>
          <Sort.TypeSelector
            // style={{ ...thinGroupStyle }}
            sortTypes={Sorts.sortFields}
            currentSortType={this.state.sortField}
            onSortTypeSelected={this.updateSortField}
          />
          <Sort.DirectionSelector
            // style={{ ...thinGroupStyle }}
            isNumeric={false}
            isAscending={this.state.isSortAscending}
            onClick={this.updateSortDirection}
          />
        </Sort>
        <FormGroup style={{ ...ThinStyle }}>
          <ToolbarDropdown
            id="overview-type"
            disabled={false}
            handleSelect={this.updateOverviewType}
            nameDropdown="Show health for"
            value={this.state.overviewType}
            label={overviewTypes[this.state.overviewType]}
            options={overviewTypes}
          />
        </FormGroup>
        <FormGroup>
          <ButtonGroup id="toolbar_layout_group">
            <Button
              onClick={() => this.props.setDisplayMode(OverviewDisplayMode.COMPACT)}
              title="Compact mode"
              active={this.props.displayMode === OverviewDisplayMode.COMPACT}
            >
              Compact
            </Button>
            <Button
              onClick={() => this.props.setDisplayMode(OverviewDisplayMode.EXPAND)}
              title="Expanded mode"
              active={this.props.displayMode === OverviewDisplayMode.EXPAND}
            >
              Expand
            </Button>
          </ButtonGroup>
        </FormGroup>
        <ToolbarRightContent style={{ ...AlignRightStyle }}>
          <DurationDropdownContainer id="overview-duration" disabled={false} tooltip={'Time range for overview data'} />
          <RefreshContainer id="overview-refresh" handleRefresh={this.props.onRefresh} hideLabel={true} />
        </ToolbarRightContent>
      </StatefulFilters>
    );
  }
}

const mapStateToProps = (state: KialiAppState) => ({
  duration: durationSelector(state),
  refreshInterval: refreshIntervalSelector(state)
});

const mapDispatchToProps = (dispatch: ThunkDispatch<KialiAppState, void, KialiAppAction>) => {
  return {
    setRefreshInterval: (refreshInterval: PollIntervalInMs) => {
      dispatch(UserSettingsActions.setRefreshInterval(refreshInterval));
    }
  };
};

const OverviewToolbarContainer = connect(
  mapStateToProps,
  mapDispatchToProps
)(OverviewToolbar);

export default OverviewToolbarContainer;
