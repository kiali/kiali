import * as React from 'react';
import { TableGridBreakpoint } from '@patternfly/react-table';
import { Table, TableHeader } from '@patternfly/react-table/deprecated';
import { HistoryManager, URLParam } from '../../app/History';
import { config, RenderResource, Resource } from './Config';
import { VirtualItem } from './VirtualItem';
import { EmptyState, EmptyStateBody, EmptyStateVariant, EmptyStateHeader } from '@patternfly/react-core';
import { KialiAppState } from '../../store/Store';
import { activeNamespacesSelector } from '../../store/Selectors';
import { connect } from 'react-redux';
import { Namespace } from '../../types/Namespace';
import { SortField } from '../../types/SortFilters';
import { NamespaceInfo } from '../../pages/Overview/NamespaceInfo';
import * as FilterHelper from '../FilterList/FilterHelper';
import * as Sorts from '../../pages/Overview/Sorts';
import { StatefulFilters } from '../Filters/StatefulFilters';
import { kialiStyle } from 'styles/StyleUtils';

const virtualListStyle = kialiStyle({
  padding: '20px',
  marginBottom: '20px'
});

// ******************************
// VirtualList and its associated classes are intended to be used for main list pages: Applications,
// Workloads, Services and Istio Config. They share common style and filter integration. They have
// have limitations in scenarios where different personalization is needed (columns style, or layout).
// For a secondary list, rendered inside a detail page, it is recommended the imple be based on a
// Table component, such as in WorkloadServices, WorkloadPods, ServiceInfoWorkload, IstioConfigSubList,
// or TrafficListComponent.
// ******************************

type Direction = 'asc' | 'desc' | undefined;

type VirtualListProps<R> = {
  actions?: JSX.Element[];
  activeNamespaces: Namespace[];
  children?: React.ReactNode;
  hiddenColumns?: string[];
  rows: R[];
  sort?: (sortField: SortField<NamespaceInfo>, isAscending: boolean) => void;
  statefulProps?: React.RefObject<StatefulFilters>;
  type: string;
};

type VirtualListState = {
  sortBy: {
    index: number;
    direction: Direction;
  };
  columns: any[];
  conf: Resource;
};

class VirtualListComponent<R extends RenderResource> extends React.Component<VirtualListProps<R>, VirtualListState> {
  private statefulFilters: React.RefObject<StatefulFilters> = React.createRef();

  constructor(props: VirtualListProps<R>) {
    super(props);
    const conf = config[props.type] as Resource;
    const columns = this.getColumns(props.type);
    let index = -1;
    const sortParam = HistoryManager.getParam(URLParam.SORT);
    if (sortParam) {
      index = conf.columns.findIndex(column => column.param === sortParam);
    }
    this.state = {
      sortBy: {
        index,
        direction: HistoryManager.getParam(URLParam.DIRECTION) as Direction
      },
      columns,
      conf
    };
  }

  onSort = (_event, index, direction) => {
    this.setState({
      sortBy: {
        index,
        direction
      }
    });
    if (direction) {
      HistoryManager.setParam(URLParam.DIRECTION, direction);
    }
    HistoryManager.setParam(URLParam.SORT, String(this.state.columns[index].param));
    this.props.sort && this.props.sort(FilterHelper.currentSortField(Sorts.sortFields), direction === 'asc');
  };

  componentDidUpdate() {
    const columns = this.getColumns(this.props.type);
    if (columns.length !== this.state.columns.length) {
      this.setState({ columns: columns });
    }
  }

  private getColumns = (type): any[] => {
    let columns = [] as any[];
    const conf = config[type] as Resource;
    if (conf.columns) {
      const filteredColumns = conf.columns.filter(
        info => !this.props.hiddenColumns || !this.props.hiddenColumns.includes(info.column.toLowerCase())
      );
      columns = filteredColumns.map(info => {
        let config = { param: info.param, title: info.column, renderer: info.renderer };
        if (info.transforms) {
          config['transforms'] = info.transforms;
        }
        if (info.cellTransforms) {
          config['cellTransforms'] = info.cellTransforms;
        }
        return config;
      });
    }
    if (this.props.actions) {
      columns.push({
        title: ''
      });
    }
    return columns;
  };

  render() {
    const { rows } = this.props;
    const { sortBy, columns, conf } = this.state;
    const tableProps = {
      cells: columns,
      rows: [],
      gridBreakPoint: TableGridBreakpoint.none,
      role: 'presentation',
      caption: conf.caption ? conf.caption : undefined
    };
    const typeDisplay = this.props.type === 'istio' ? 'Istio config' : this.props.type;

    const childrenWithProps = React.Children.map(this.props.children, child => {
      // Checking isValidElement is the safe way and avoids a TS error too.
      if (React.isValidElement(child)) {
        return React.cloneElement(child, { ref: this.statefulFilters } as React.Attributes);
      }

      return child;
    });

    const rowItems: any[] = rows.map((r, i) => {
      return (
        <VirtualItem
          key={'vItem' + i}
          item={r}
          index={i}
          columns={this.state.columns}
          config={conf}
          statefulFilterProps={this.props.statefulProps ? this.props.statefulProps : this.statefulFilters}
          action={this.props.actions && this.props.actions[i] ? this.props.actions[i] : undefined}
        />
      );
    });

    return (
      <div className={virtualListStyle}>
        {childrenWithProps}
        <Table {...tableProps} sortBy={sortBy} onSort={this.onSort}>
          <TableHeader />
          <tbody>
            {this.props.rows.length > 0 ? (
              rowItems
            ) : (
              <tr>
                <td colSpan={tableProps.cells.length}>
                  {this.props.activeNamespaces.length > 0 ? (
                    <EmptyState variant={EmptyStateVariant.full}>
                      <EmptyStateHeader titleText={<>No {typeDisplay} found</>} headingLevel="h5" />
                      <EmptyStateBody>
                        No {typeDisplay} in namespace
                        {this.props.activeNamespaces.length === 1
                          ? ` ${this.props.activeNamespaces[0].name}`
                          : `s: ${this.props.activeNamespaces.map(ns => ns.name).join(', ')}`}
                      </EmptyStateBody>
                    </EmptyState>
                  ) : (
                    <EmptyState variant={EmptyStateVariant.full}>
                      <EmptyStateHeader titleText={$t('title7', 'No namespace is selected')} headingLevel="h5" />
                      <EmptyStateBody>
                        {$t(
                          'tip162',
                          'There is currently no namespace selected, please select one using the Namespace selector.'
                        )}
                      </EmptyStateBody>
                    </EmptyState>
                  )}
                </td>
              </tr>
            )}
          </tbody>
        </Table>
      </div>
    );
  }
}

const mapStateToProps = (state: KialiAppState) => ({
  activeNamespaces: activeNamespacesSelector(state)
});

export const VirtualList = connect(mapStateToProps)(VirtualListComponent);
