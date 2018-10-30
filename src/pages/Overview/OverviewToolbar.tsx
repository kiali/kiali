import * as React from 'react';
import { Sort, ToolbarRightContent } from 'patternfly-react';

import { StatefulFilters } from '../../components/Filters/StatefulFilters';
import { ListPagesHelper } from '../../components/ListPage/ListPagesHelper';
import Refresh from '../../components/Refresh/Refresh';
import { ToolbarDropdown } from '../../components/ToolbarDropdown/ToolbarDropdown';
import { config } from '../../config';

import { FiltersAndSorts } from './FiltersAndSorts';
import { SortField } from '../../types/SortFilters';
import NamespaceInfo from './NamespaceInfo';
import { HistoryManager, URLParams } from '../../app/History';

type Props = {
  onRefresh: () => void;
  onError: (msg: string) => void;
  sort: (sortField: SortField<NamespaceInfo>, isAscending: boolean) => void;
};

type State = {
  sortField: SortField<NamespaceInfo>;
  isSortAscending: boolean;
  duration: number;
  pollInterval: number;
};

const DURATIONS = config().toolbar.intervalDuration;

class OverviewToolbar extends React.Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = {
      sortField: ListPagesHelper.currentSortField(FiltersAndSorts.sortFields),
      isSortAscending: ListPagesHelper.isCurrentSortAscending(),
      duration: ListPagesHelper.currentDuration(),
      pollInterval: ListPagesHelper.currentPollInterval()
    };
  }

  componentDidUpdate() {
    const urlSortField = ListPagesHelper.currentSortField(FiltersAndSorts.sortFields);
    const urlIsSortAscending = ListPagesHelper.isCurrentSortAscending();
    const urlDuration = ListPagesHelper.currentDuration();
    const urlPollInterval = ListPagesHelper.currentPollInterval();
    if (!this.paramsAreSynced(urlSortField, urlIsSortAscending, urlDuration, urlPollInterval)) {
      this.setState({
        sortField: urlSortField,
        isSortAscending: urlIsSortAscending,
        duration: urlDuration,
        pollInterval: urlPollInterval
      });
      this.props.onRefresh();
    }
  }

  paramsAreSynced(
    urlSortField: SortField<NamespaceInfo>,
    urlIsSortAscending: boolean,
    urlDuration: number,
    urlPollInterval: number
  ) {
    return (
      urlIsSortAscending === this.state.isSortAscending &&
      urlSortField.title === this.state.sortField.title &&
      urlDuration === this.state.duration &&
      urlPollInterval === this.state.pollInterval
    );
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
  };

  updatePollInterval = (pollInterval: number) => {
    HistoryManager.setParam(URLParams.POLL_INTERVAL, String(pollInterval));
    this.setState({ pollInterval: pollInterval });
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
        <ToolbarDropdown
          id="overview-duration"
          disabled={false}
          handleSelect={this.updateDuration}
          nameDropdown="Displaying"
          value={this.state.duration}
          label={DURATIONS[this.state.duration]}
          options={DURATIONS}
        />
        <ToolbarRightContent>
          <Refresh
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
