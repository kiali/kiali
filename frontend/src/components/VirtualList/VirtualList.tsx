import * as React from 'react';
import { Table, TableHeader, TableGridBreakpoint } from '@patternfly/react-table';
import history, { HistoryManager, URLParam } from '../../app/History';
import { config, RenderResource, Resource } from './Config';
import VirtualItem from './VirtualItem';
import { EmptyState, EmptyStateBody, EmptyStateVariant, Title, TitleSizes } from '@patternfly/react-core';
import { KialiAppState } from '../../store/Store';
import { activeNamespacesSelector } from '../../store/Selectors';
import { connect } from 'react-redux';
import Namespace from '../../types/Namespace';
import { SortField } from '../../types/SortFilters';
import NamespaceInfo from '../../pages/Overview/NamespaceInfo';
import * as FilterHelper from '../FilterList/FilterHelper';
import * as Sorts from '../../pages/Overview/Sorts';
import { StatefulFilters } from '../Filters/StatefulFilters';

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
  activeNamespaces: Namespace[];
  children?: React.ReactNode;
  rows: R[];
  sort?: (sortField: SortField<NamespaceInfo>, isAscending: boolean) => void;
  statefulProps?: React.RefObject<StatefulFilters>;
  actions?: JSX.Element[];
};

type VirtualListState = {
  type: string;
  sortBy: {
    index: number;
    direction: Direction;
  };
  columns: any[];
  conf: Resource;
};

// get the type of list user request
const listRegex = /\/([a-z0-9-]+)/;

class VirtualListC<R extends RenderResource> extends React.Component<VirtualListProps<R>, VirtualListState> {
  private statefulFilters: React.RefObject<StatefulFilters> = React.createRef();

  constructor(props: VirtualListProps<R>) {
    super(props);
    const match = history.location.pathname.match(listRegex) || [];
    const type = match[1] || '';
    const conf = config[type] as Resource;
    const columns =
      conf.columns && config.headerTable
        ? conf.columns.map(info => {
            let config = { title: info.column };
            if (info.transforms) {
              config['transforms'] = info.transforms;
            }
            if (info.cellTransforms) {
              config['cellTransforms'] = info.cellTransforms;
            }
            return config;
          })
        : [];
    if (this.props.actions) {
      columns.push({
        title: ''
      });
    }
    let index = -1;
    const sortParam = HistoryManager.getParam(URLParam.SORT);
    if (sortParam) {
      index = conf.columns.findIndex(column => column.param === sortParam);
    }
    this.state = {
      type,
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
    HistoryManager.setParam(URLParam.SORT, String(this.state.conf.columns[index].param));
    this.props.sort && this.props.sort(FilterHelper.currentSortField(Sorts.sortFields), direction === 'asc');
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
    const typeDisplay = this.state.type === 'istio' ? 'Istio config' : this.state.type;

    const childrenWithProps = React.Children.map(this.props.children, child => {
      // Checking isValidElement is the safe way and avoids a TS error too.
      if (React.isValidElement(child)) {
        return React.cloneElement(child, { ref: this.statefulFilters });
      }

      return child;
    });

    const rowItems: any[] = rows.map((r, i) => {
      return (
        <VirtualItem
          key={'vItem' + i}
          item={r}
          index={i}
          config={conf}
          statefulFilterProps={this.props.statefulProps ? this.props.statefulProps : this.statefulFilters}
          action={this.props.actions && this.props.actions[i] ? this.props.actions[i] : undefined}
        />
      );
    });

    return (
      <div
        style={{
          padding: '20px',
          marginBottom: '20px'
        }}
      >
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
                      <Title headingLevel="h5" size={TitleSizes.lg}>
                        No {typeDisplay} found
                      </Title>
                      <EmptyStateBody>
                        No {typeDisplay} in namespace
                        {this.props.activeNamespaces.length === 1
                          ? ` ${this.props.activeNamespaces[0].name}`
                          : `s: ${this.props.activeNamespaces.map(ns => ns.name).join(', ')}`}
                      </EmptyStateBody>
                    </EmptyState>
                  ) : (
                    <EmptyState variant={EmptyStateVariant.full}>
                      <Title headingLevel="h5" size={TitleSizes.lg}>
                        No namespace is selected
                      </Title>
                      <EmptyStateBody>
                        There is currently no namespace selected, please select one using the Namespace selector.
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

const VirtualList = connect(mapStateToProps)(VirtualListC);
export default VirtualList;
