import * as React from 'react';
import { Button, FormSelect, FormSelectOption } from '@patternfly/react-core';
import { SortAlphaDownIcon, SortAlphaUpIcon } from '@patternfly/react-icons';

import { connect } from 'react-redux';
import { ThunkDispatch } from 'redux-thunk';

import { KialiAppAction } from '../../actions/KialiAppAction';
import { UserSettingsActions } from '../../actions/UserSettingsActions';
import history, { HistoryManager, URLParam } from '../../app/History';
import { StatefulFilters } from '../../components/Filters/StatefulFilters';
import * as FilterHelper from '../../components/FilterList/FilterHelper';
import RefreshContainer from '../../components/Refresh/Refresh';
import { ToolbarDropdown } from '../../components/ToolbarDropdown/ToolbarDropdown';
import { KialiAppState } from '../../store/Store';
import { durationSelector, refreshIntervalSelector } from '../../store/Selectors';
import { PollIntervalInMs, DurationInSeconds } from '../../types/Common';
import { SortField } from '../../types/SortFilters';

import NamespaceInfo from './NamespaceInfo';
import { ThinStyle } from '../../components/Filters/FilterStyles';
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
    HistoryManager.setParam(URLParam.POLL_INTERVAL, String(this.props.refreshInterval));

    this.state = {
      isSortAscending: FilterHelper.isCurrentSortAscending(),
      overviewType: OverviewToolbar.currentOverviewType(),
      sortField: FilterHelper.currentSortField(Sorts.sortFields)
    };
  }

  componentDidUpdate(prevProps: Props) {
    // ensure redux state and URL are aligned
    HistoryManager.setParam(URLParam.POLL_INTERVAL, String(this.props.refreshInterval));

    const urlSortField = FilterHelper.currentSortField(Sorts.sortFields);
    const urlIsSortAscending = FilterHelper.isCurrentSortAscending();
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

  updateOverviewType = (otype: String) => {
    const isOverviewType = (val: String): val is OverviewType =>
      val === 'app' || val === 'workload' || val === 'service';

    if (isOverviewType(otype)) {
      HistoryManager.setParam(URLParam.OVERVIEW_TYPE, otype);
      this.setState({ overviewType: otype });
      this.props.onRefresh();
    } else {
      throw new Error('Overview type is not valid.');
    }
  };

  changeSortField = value => {
    const sortField: SortField<NamespaceInfo> = Sorts.sortFields.filter(sort => sort.id === value)[0];
    this.props.sort(sortField, this.state.isSortAscending);
    HistoryManager.setParam(URLParam.SORT, sortField.param);
    this.setState({ sortField: sortField });
  };

  render() {
    return (
      <StatefulFilters
        initialFilters={Filters.availableFilters}
        onFilterChange={this.props.onRefresh}
        rightToolbar={[
          <DurationDropdownContainer
            id="overview-duration"
            key={'DurationDropdown'}
            disabled={false}
            tooltip={'Time range for overview data'}
          />,
          <RefreshContainer
            id="overview-refresh"
            key={'Refresh'}
            handleRefresh={this.props.onRefresh}
            hideLabel={true}
          />
        ]}
      >
        <>
          <FormSelect
            aria-label={'Sort_Selector'}
            value={this.state.sortField.id}
            onChange={this.changeSortField}
            style={{ width: 'auto' }}
          >
            {Sorts.sortFields.map(sortType => (
              <FormSelectOption key={sortType.id} value={sortType.id} label={sortType.title} />
            ))}
          </FormSelect>
          <Button variant="plain" onClick={this.updateSortDirection} style={{ ...ThinStyle }}>
            {this.state.isSortAscending ? <SortAlphaDownIcon /> : <SortAlphaUpIcon />}
          </Button>
        </>
        <ToolbarDropdown
          id="overview-type"
          disabled={false}
          handleSelect={this.updateOverviewType}
          nameDropdown="Show health for"
          value={this.state.overviewType}
          label={overviewTypes[this.state.overviewType]}
          options={overviewTypes}
        />
        <>
          <Button
            onClick={() => this.props.setDisplayMode(OverviewDisplayMode.COMPACT)}
            title="Compact mode"
            variant="tertiary"
            isActive={this.props.displayMode === OverviewDisplayMode.COMPACT}
          >
            Compact
          </Button>
          <Button
            onClick={() => this.props.setDisplayMode(OverviewDisplayMode.EXPAND)}
            title="Expanded mode"
            variant="tertiary"
            isActive={this.props.displayMode === OverviewDisplayMode.EXPAND}
            style={{ marginLeft: '5px' }}
          >
            Expand
          </Button>
        </>
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
