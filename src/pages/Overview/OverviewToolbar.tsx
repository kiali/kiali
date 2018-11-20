import * as React from 'react';
import { FormGroup, Sort, ToolbarRightContent } from 'patternfly-react';

import { StatefulFilters } from '../../components/Filters/StatefulFilters';
import { ListPagesHelper } from '../../components/ListPage/ListPagesHelper';
import { ToolbarDropdown } from '../../components/ToolbarDropdown/ToolbarDropdown';
import { config } from '../../config';

import { FiltersAndSorts } from './FiltersAndSorts';
import { SortField } from '../../types/SortFilters';
import NamespaceInfo from './NamespaceInfo';
import { HistoryManager, URLParams } from '../../app/History';
import { PollIntervalInMs } from '../../types/Common';
import RefreshContainer from '../../containers/RefreshContainer';

type Props = {
  onRefresh: () => void;
  onError: (msg: string) => void;
  sort: (sortField: SortField<NamespaceInfo>, isAscending: boolean) => void;
};

const overviewTypes = {
  app: 'Apps',
  workload: 'Workloads'
};

type OverviewType = keyof typeof overviewTypes;

type State = {
  sortField: SortField<NamespaceInfo>;
  isSortAscending: boolean;
  duration: number;
  pollInterval: number;
  overviewType: OverviewType;
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
    this.state = {
      sortField: ListPagesHelper.currentSortField(FiltersAndSorts.sortFields),
      isSortAscending: ListPagesHelper.isCurrentSortAscending(),
      duration: ListPagesHelper.currentDuration(),
      pollInterval: ListPagesHelper.currentPollInterval(),
      overviewType: OverviewToolbar.currentOverviewType()
    };
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

  updateDuration = (duration: number) => {
    HistoryManager.setParam(URLParams.DURATION, String(duration));
    this.setState({ duration: duration });
    this.props.onRefresh();
  };

  updatePollInterval = (pollInterval: PollIntervalInMs) => {
    HistoryManager.setParam(URLParams.POLL_INTERVAL, String(pollInterval));
    this.setState({ pollInterval: pollInterval });
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
            handleSelect={this.updateDuration}
            nameDropdown="Displaying"
            value={this.state.duration}
            label={DURATIONS[this.state.duration]}
            options={DURATIONS}
          />
        </FormGroup>
        <ToolbarRightContent>
          <RefreshContainer
            id="overview-refresh"
            handleRefresh={this.props.onRefresh}
            onSelect={this.updatePollInterval}
            pollInterval={this.state.pollInterval}
          />
        </ToolbarRightContent>
      </StatefulFilters>
    );
  }
}

export default OverviewToolbar;
