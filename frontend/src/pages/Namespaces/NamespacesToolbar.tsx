import * as React from 'react';
import { connect } from 'react-redux';
import { UserSettingsActions } from '../../actions/UserSettingsActions';
import { HistoryManager, URLParam } from '../../app/History';
import { StatefulFilters, StatefulFiltersRef } from '../../components/Filters/StatefulFilters';
import * as FilterHelper from '../../components/FilterList/FilterHelper';
import { KialiAppState } from '../../store/Store';
import { durationSelector, languageSelector, refreshIntervalSelector } from '../../store/Selectors';
import { IntervalInMilliseconds, DurationInSeconds } from '../../types/Common';
import { SortField } from '../../types/SortFilters';
import { NamespaceInfo } from '../../types/NamespaceInfo';
import * as Sorts from './Sorts';
import * as Filters from './Filters';
import { kialiStyle } from 'styles/StyleUtils';
import { TimeDurationComponent } from '../../components/Time/TimeDurationComponent';
import { KialiDispatch } from '../../types/Redux';

type ReduxStateProps = {
  duration: DurationInSeconds;
  language: string;
  refreshInterval: IntervalInMilliseconds;
};

type ReduxDispatchProps = {
  setRefreshInterval: (refresh: IntervalInMilliseconds) => void;
};

type Props = ReduxStateProps &
  ReduxDispatchProps & {
    onChange: () => void;
    onRefresh: () => void;
    sort: (sortField: SortField<NamespaceInfo>, isAscending: boolean) => void;
    statefulFilterRef: StatefulFiltersRef;
  };

const containerFlex = kialiStyle({
  display: 'flex',
  flexWrap: 'wrap'
});

const rightToolbarStyle = kialiStyle({
  marginLeft: 'auto',
  height: '110px'
});

const timeToolbarStyle = kialiStyle({
  textAlign: 'right'
});

class NamespacesToolbarComponent extends React.Component<Props> {
  state = {
    isSortAscending: FilterHelper.isCurrentSortAscending(),
    sortField: FilterHelper.currentSortField(Sorts.sortFields)
  };

  componentDidUpdate(): void {
    const urlSortField = FilterHelper.currentSortField(Sorts.sortFields);
    const urlIsSortAscending = FilterHelper.isCurrentSortAscending();

    if (!this.paramsAreSynced(urlSortField, urlIsSortAscending)) {
      this.setState({
        sortField: urlSortField,
        isSortAscending: urlIsSortAscending
      });
    }
  }

  paramsAreSynced = (urlSortField: SortField<NamespaceInfo>, urlIsSortAscending: boolean): boolean => {
    return urlIsSortAscending === this.state.isSortAscending && urlSortField.title === this.state.sortField.title;
  };

  updateSortField = (sortField: SortField<NamespaceInfo>): void => {
    this.props.sort(sortField, this.state.isSortAscending);
    HistoryManager.setParam(URLParam.SORT, sortField.param);
    this.setState({ sortField: sortField });
  };

  updateSortDirection = (): void => {
    const newDir = !this.state.isSortAscending;
    this.props.sort(this.state.sortField, newDir);
    HistoryManager.setParam(URLParam.DIRECTION, newDir ? 'asc' : 'desc');
    this.setState({ isSortAscending: newDir });
  };

  changeSortField = (value: string): void => {
    const sortField: SortField<NamespaceInfo> = Sorts.sortFields.filter(sort => sort.id === value)[0];
    this.props.sort(sortField, this.state.isSortAscending);
    HistoryManager.setParam(URLParam.SORT, sortField.param);
    this.setState({ sortField: sortField });
  };

  render(): React.ReactNode {
    const filterToolbar = (
      <StatefulFilters
        initialFilters={Filters.availableFilters}
        onFilterChange={this.props.onChange}
        ref={this.props.statefulFilterRef}
      />
    );

    const timeToolbar = (
      <div className={timeToolbarStyle}>
        <TimeDurationComponent key="namespaces-time-range" id="namespaces-time-range" disabled={false} />
      </div>
    );

    return (
      <div className={containerFlex}>
        {filterToolbar}
        <div className={rightToolbarStyle}>{timeToolbar}</div>
      </div>
    );
  }
}

const mapStateToProps = (state: KialiAppState): ReduxStateProps => ({
  duration: durationSelector(state),
  refreshInterval: refreshIntervalSelector(state),
  language: languageSelector(state)
});

const mapDispatchToProps = (dispatch: KialiDispatch): ReduxDispatchProps => {
  return {
    setRefreshInterval: (refreshInterval: IntervalInMilliseconds) => {
      dispatch(UserSettingsActions.setRefreshInterval(refreshInterval));
    }
  };
};

export const NamespacesToolbar = connect(mapStateToProps, mapDispatchToProps)(NamespacesToolbarComponent);
