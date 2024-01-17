import * as React from 'react';
import { Button, ButtonVariant, Tooltip, TooltipPosition } from '@patternfly/react-core';
import { ListIcon, ThIcon, ThLargeIcon } from '@patternfly/react-icons';
import { SortAlphaDownIcon, SortAlphaUpIcon } from '@patternfly/react-icons';
import { connect } from 'react-redux';
import { UserSettingsActions } from '../../actions/UserSettingsActions';
import { HistoryManager, URLParam } from '../../app/History';
import { StatefulFilters } from '../../components/Filters/StatefulFilters';
import * as FilterHelper from '../../components/FilterList/FilterHelper';
import { ToolbarDropdown } from '../../components/ToolbarDropdown/ToolbarDropdown';
import { KialiAppState } from '../../store/Store';
import { durationSelector, refreshIntervalSelector } from '../../store/Selectors';
import { IntervalInMilliseconds, DurationInSeconds } from '../../types/Common';
import { SortField } from '../../types/SortFilters';
import { NamespaceInfo } from '../../types/NamespaceInfo';
import * as Sorts from './Sorts';
import * as Filters from './Filters';
import { kialiStyle } from 'styles/StyleUtils';
import { TimeDurationComponent } from '../../components/Time/TimeDurationComponent';
import { KialiDispatch } from '../../types/Redux';
import { RefreshNotifier } from '../../components/Refresh/RefreshNotifier';
import { PFColors } from 'components/Pf/PfColors';

type ReduxProps = {
  duration: DurationInSeconds;
  refreshInterval: IntervalInMilliseconds;
  setRefreshInterval: (refresh: IntervalInMilliseconds) => void;
};

type Props = ReduxProps & {
  displayMode: OverviewDisplayMode;
  onError: (msg: string) => void;
  onRefresh: () => void;
  setDisplayMode: (mode: OverviewDisplayMode) => void;
  sort: (sortField: SortField<NamespaceInfo>, isAscending: boolean) => void;
  statefulFilterRef: React.RefObject<StatefulFilters>;
};

export enum OverviewDisplayMode {
  COMPACT,
  EXPAND,
  LIST
}

const overviewTypes = {
  app: 'Apps',
  workload: 'Workloads',
  service: 'Services'
};

const directionTypes = {
  inbound: 'Inbound',
  outbound: 'Outbound'
};

// TODO Use Object.fromEntries when available
const sortTypes = (() => {
  let o = {};

  Sorts.sortFields.forEach(sortType => {
    let id: string = sortType.id;
    Object.assign(o, { [id]: sortType.title });
  });

  return o;
})();

const containerStyle = kialiStyle({
  padding: '0 1.25rem 0 1.25rem',
  backgroundColor: PFColors.BackgroundColor100,
  borderBottom: `1px solid ${PFColors.BorderColor100}`
});

const containerFlex = kialiStyle({
  display: 'flex',
  flexWrap: 'wrap'
});

const filterToolbarStyle = kialiStyle({
  paddingTop: '0.625rem'
});

const rightToolbarStyle = kialiStyle({
  marginLeft: 'auto',
  height: '118px',
  padding: '0.625rem 0 0 0'
});

const timeToolbarStyle = kialiStyle({
  textAlign: 'right'
});

const actionsToolbarStyle = kialiStyle({
  paddingTop: '1rem',
  display: 'flex',
  justifyContent: 'end',
  alignItems: 'center'
});

const typeSelectStyle = kialiStyle({
  marginRight: '0.5rem'
});

export type OverviewType = keyof typeof overviewTypes;

export type DirectionType = keyof typeof directionTypes;

type State = {
  isSortAscending: boolean;
  overviewType: OverviewType;
  directionType: DirectionType;
  sortField: SortField<NamespaceInfo>;
};

class OverviewToolbarComponent extends React.Component<Props, State> {
  static currentOverviewType(): OverviewType {
    const otype = HistoryManager.getParam(URLParam.OVERVIEW_TYPE);
    return (otype as OverviewType) ?? 'app';
  }

  static currentDirectionType(): DirectionType {
    const drtype = HistoryManager.getParam(URLParam.DIRECTION_TYPE);
    return (drtype as DirectionType) ?? 'inbound';
  }

  constructor(props: Props) {
    super(props);

    this.state = {
      isSortAscending: FilterHelper.isCurrentSortAscending(),
      overviewType: OverviewToolbar.currentOverviewType(),
      directionType: OverviewToolbar.currentDirectionType(),
      sortField: FilterHelper.currentSortField(Sorts.sortFields)
    };
  }

  componentDidUpdate() {
    const urlSortField = FilterHelper.currentSortField(Sorts.sortFields);
    const urlIsSortAscending = FilterHelper.isCurrentSortAscending();

    if (!this.paramsAreSynced(urlSortField, urlIsSortAscending)) {
      this.setState({
        sortField: urlSortField,
        isSortAscending: urlIsSortAscending
      });
    }
  }

  paramsAreSynced(urlSortField: SortField<NamespaceInfo>, urlIsSortAscending: boolean): boolean {
    return urlIsSortAscending === this.state.isSortAscending && urlSortField.title === this.state.sortField.title;
  }

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

  updateOverviewType = (otype: String): void => {
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

  updateDirectionType = (dtype: String): void => {
    const isDirectionType = (val: String): val is DirectionType => val === 'inbound' || val === 'outbound';

    if (isDirectionType(dtype)) {
      HistoryManager.setParam(URLParam.DIRECTION_TYPE, dtype);
      this.setState({ directionType: dtype });
      this.props.onRefresh();
    } else {
      throw new Error('Direction type is not valid.');
    }
  };

  changeSortField = (value: string): void => {
    const sortField: SortField<NamespaceInfo> = Sorts.sortFields.filter(sort => sort.id === value)[0];
    this.props.sort(sortField, this.state.isSortAscending);
    HistoryManager.setParam(URLParam.SORT, sortField.param);
    this.setState({ sortField: sortField });
  };

  render() {
    const filterToolbar = (
      <StatefulFilters
        initialFilters={Filters.availableFilters}
        onFilterChange={this.props.onRefresh}
        ref={this.props.statefulFilterRef}
      >
        {this.props.displayMode !== OverviewDisplayMode.LIST && (
          <>
            <ToolbarDropdown
              id="sort_selector"
              handleSelect={this.changeSortField}
              value={this.state.sortField.id}
              label={sortTypes[this.state.sortField.id]}
              options={sortTypes}
              data-sort-field={this.state.sortField.id}
            />

            <Button
              variant={ButtonVariant.plain}
              onClick={this.updateSortDirection}
              style={{ paddingLeft: '0.5rem', paddingRight: '0.5rem' }}
              data-sort-asc={this.state.isSortAscending}
            >
              {this.state.isSortAscending ? <SortAlphaDownIcon /> : <SortAlphaUpIcon />}
            </Button>
          </>
        )}
      </StatefulFilters>
    );

    const timeToolbar = (
      <div className={timeToolbarStyle}>
        <RefreshNotifier onTick={this.props.onRefresh} />
        <TimeDurationComponent key="overview-time-range" id="overview-time-range" disabled={false} />
      </div>
    );

    const actionsToolbar = (
      <div className={actionsToolbarStyle}>
        <ToolbarDropdown
          id="overview-type"
          disabled={false}
          className={typeSelectStyle}
          handleSelect={this.updateOverviewType}
          nameDropdown="Health for"
          value={this.state.overviewType}
          label={overviewTypes[this.state.overviewType]}
          options={overviewTypes}
        />

        {this.props.displayMode !== OverviewDisplayMode.COMPACT && (
          <ToolbarDropdown
            id="direction-type"
            disabled={false}
            handleSelect={this.updateDirectionType}
            nameDropdown="Traffic"
            value={this.state.directionType}
            label={directionTypes[this.state.directionType]}
            options={directionTypes}
          />
        )}

        <Tooltip content={<>Expand view</>} position={TooltipPosition.top}>
          <Button
            onClick={() => this.props.setDisplayMode(OverviewDisplayMode.EXPAND)}
            variant={ButtonVariant.plain}
            isActive={this.props.displayMode === OverviewDisplayMode.EXPAND}
            style={{ padding: '0 0.25rem 0 1rem' }}
            data-test={`overview-type-${OverviewDisplayMode[OverviewDisplayMode.EXPAND]}`}
          >
            <ThLargeIcon />
          </Button>
        </Tooltip>

        <Tooltip content={<>Compact view</>} position={TooltipPosition.top}>
          <Button
            onClick={() => this.props.setDisplayMode(OverviewDisplayMode.COMPACT)}
            variant={ButtonVariant.plain}
            isActive={this.props.displayMode === OverviewDisplayMode.COMPACT}
            style={{ padding: '0 0.25rem 0 0.25rem' }}
            data-test={`overview-type-${OverviewDisplayMode[OverviewDisplayMode.COMPACT]}`}
          >
            <ThIcon />
          </Button>
        </Tooltip>

        <Tooltip content={<>List view</>} position={TooltipPosition.top}>
          <Button
            onClick={() => this.props.setDisplayMode(OverviewDisplayMode.LIST)}
            variant={ButtonVariant.plain}
            isActive={this.props.displayMode === OverviewDisplayMode.LIST}
            style={{ padding: '0 0.25rem 0 0.25rem' }}
            data-test={`overview-type-${OverviewDisplayMode[OverviewDisplayMode.LIST]}`}
          >
            <ListIcon />
          </Button>
        </Tooltip>
      </div>
    );

    return (
      <div className={containerStyle}>
        <div className={containerFlex}>
          <div className={filterToolbarStyle}>{filterToolbar}</div>
          <div className={rightToolbarStyle}>
            {timeToolbar}
            {actionsToolbar}
          </div>
        </div>
      </div>
    );
  }
}

const mapStateToProps = (state: KialiAppState) => ({
  duration: durationSelector(state),
  refreshInterval: refreshIntervalSelector(state)
});

const mapDispatchToProps = (dispatch: KialiDispatch) => {
  return {
    setRefreshInterval: (refreshInterval: IntervalInMilliseconds) => {
      dispatch(UserSettingsActions.setRefreshInterval(refreshInterval));
    }
  };
};

export const OverviewToolbar = connect(mapStateToProps, mapDispatchToProps)(OverviewToolbarComponent);
