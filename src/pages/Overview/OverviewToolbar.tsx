import * as React from 'react';
import { FormGroup, Sort, ToolbarRightContent } from 'patternfly-react';
import { connect } from 'react-redux';
import { Dispatch } from 'redux';

import { KialiAppState } from '../../store/Store';
import { durationSelector, refreshIntervalSelector } from '../../store/Selectors';
import { UserSettingsActions } from '../../actions/UserSettingsActions';

import { StatefulFilters } from '../../components/Filters/StatefulFilters';
import { ListPagesHelper } from '../../components/ListPage/ListPagesHelper';
import { ToolbarDropdown } from '../../components/ToolbarDropdown/ToolbarDropdown';
import { config } from '../../config';

import { PollIntervalInMs, DurationInSeconds } from '../../types/Common';
import { SortField } from '../../types/SortFilters';

import { FiltersAndSorts } from './FiltersAndSorts';
import NamespaceInfo from './NamespaceInfo';
import { HistoryManager, URLParams } from '../../app/History';
import RefreshContainer from '../../containers/RefreshContainer';

type ReduxProps = {
  duration: DurationInSeconds;
  refreshInterval: PollIntervalInMs;
  setDuration: (duration: DurationInSeconds) => void;
  setRefreshInterval: (refresh: PollIntervalInMs) => void;
};

type Props = ReduxProps & {
  onError: (msg: string) => void;
  onRefresh: () => void;
  sort: (sortField: SortField<NamespaceInfo>, isAscending: boolean) => void;
};

const overviewTypes = {
  app: 'Apps',
  workload: 'Workloads'
};

type OverviewType = keyof typeof overviewTypes;

type State = {
  isSortAscending: boolean;
  overviewType: OverviewType;
  sortField: SortField<NamespaceInfo>;
};

const DURATIONS = config().toolbar.intervalDuration;

class OverviewToolbar extends React.Component<Props, State> {
  static currentOverviewType(): OverviewType {
    const otype = ListPagesHelper.getSingleQueryParam(URLParams.OVERVIEW_TYPE);
    if (otype === undefined) {
      return 'app';
    }
    return otype as OverviewType;
  }

  constructor(props: Props) {
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

    this.state = {
      isSortAscending: ListPagesHelper.isCurrentSortAscending(),
      overviewType: OverviewToolbar.currentOverviewType(),
      sortField: ListPagesHelper.currentSortField(FiltersAndSorts.sortFields)
    };
  }

  componentDidUpdate() {
    // ensure redux state and URL are aligned
    HistoryManager.setParam(URLParams.DURATION, String(this.props.duration));
    HistoryManager.setParam(URLParams.POLL_INTERVAL, String(this.props.refreshInterval));

    const urlSortField = ListPagesHelper.currentSortField(FiltersAndSorts.sortFields);
    const urlIsSortAscending = ListPagesHelper.isCurrentSortAscending();
    if (!this.paramsAreSynced(urlSortField, urlIsSortAscending)) {
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
    HistoryManager.setParam(URLParams.SORT, sortField.param);
    this.setState({ sortField: sortField });
  };

  updateSortDirection = () => {
    const newDir = !this.state.isSortAscending;
    this.props.sort(this.state.sortField, newDir);
    HistoryManager.setParam(URLParams.DIRECTION, newDir ? 'asc' : 'desc');
    this.setState({ isSortAscending: newDir });
  };

  updateOverviewType = (otype: OverviewType) => {
    HistoryManager.setParam(URLParams.OVERVIEW_TYPE, otype);
    this.setState({ overviewType: otype });
    this.props.onRefresh();
  };

  render() {
    return (
      <StatefulFilters initialFilters={FiltersAndSorts.availableFilters} onFilterChange={this.props.onRefresh}>
        <Sort>
          <Sort.TypeSelector
            sortTypes={FiltersAndSorts.sortFields}
            currentSortType={this.state.sortField}
            onSortTypeSelected={this.updateSortField}
          />
          <Sort.DirectionSelector
            isNumeric={false}
            isAscending={this.state.isSortAscending}
            onClick={this.updateSortDirection}
          />
        </Sort>
        <FormGroup>
          <ToolbarDropdown
            id="overview-type"
            disabled={false}
            handleSelect={this.updateOverviewType}
            nameDropdown="Show health for"
            value={this.state.overviewType}
            label={overviewTypes[this.state.overviewType]}
            options={overviewTypes}
          />
          <ToolbarDropdown
            id="overview-duration"
            disabled={false}
            handleSelect={this.props.setDuration}
            nameDropdown="Displaying"
            value={this.props.duration}
            label={DURATIONS[this.props.duration]}
            options={DURATIONS}
          />
        </FormGroup>
        <ToolbarRightContent>
          <RefreshContainer
            id="overview-refresh"
            handleRefresh={this.props.onRefresh}
            pollInterval={this.props.refreshInterval}
          />
        </ToolbarRightContent>
      </StatefulFilters>
    );
  }
}

const mapStateToProps = (state: KialiAppState) => ({
  duration: durationSelector(state),
  refreshInterval: refreshIntervalSelector(state)
});

const mapDispatchToProps = (dispatch: Dispatch<any>) => {
  return {
    setDuration: (duration: DurationInSeconds) => {
      dispatch(UserSettingsActions.setDuration(duration));
    },
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
