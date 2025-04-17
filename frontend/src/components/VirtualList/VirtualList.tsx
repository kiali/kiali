import * as React from 'react';
import {
  Caption,
  InnerScrollContainer,
  IRow,
  ISortBy,
  OnSort,
  SortByDirection,
  Table,
  TableGridBreakpoint,
  Tbody,
  Td,
  Th,
  Thead,
  ThProps,
  Tr
} from '@patternfly/react-table';
import { HistoryManager, URLParam } from '../../app/History';
import { config, RenderResource, Resource, ResourceType } from './Config';
import { VirtualItem } from './VirtualItem';
import { EmptyState, EmptyStateBody, EmptyStateVariant, EmptyStateHeader } from '@patternfly/react-core';
import { KialiAppState } from '../../store/Store';
import { activeNamespacesSelector } from '../../store/Selectors';
import { connect } from 'react-redux';
import { Namespace } from '../../types/Namespace';
import { SortField } from '../../types/SortFilters';
import { NamespaceInfo } from '../../types/NamespaceInfo';
import * as FilterHelper from '../FilterList/FilterHelper';
import * as Sorts from '../../pages/Overview/Sorts';
import { StatefulFiltersRef } from '../Filters/StatefulFilters';
import { kialiStyle } from 'styles/StyleUtils';
import { SortableTh } from 'components/Table/SimpleTable';
import { isKiosk } from 'components/Kiosk/KioskActions';
import { store } from 'store/ConfigStore';
import { classes } from 'typestyle';

const emptyStyle = kialiStyle({
  borderBottom: 0
});

// TOP_PADDING constant is used to adjust the height of the main div to allow scrolling in the inner container layer.
const TOP_PADDING = 76 + 160;

// EMBEDDED_PADDING constant is a magic number used to adjust the height of the main div to allow scrolling in the inner container layer.
// 42px is the height of the first tab menu
const EMBEDDED_PADDING = 42 + 100;

/**
 * By default, Kiali hides the global scrollbar and fixes the height for some pages to force the scrollbar to appear
 * Hiding global scrollbar is not possible when Kiali is embedded in other application (like Openshift Console)
 * In these cases height is not fixed to avoid multiple scrollbars (https://github.com/kiali/kiali/issues/6601)
 * GLOBAL_SCROLLBAR environment variable is not defined in standalone Kiali application (value is always false)
 */
const globalScrollbar = process.env.GLOBAL_SCROLLBAR ?? 'false';

// ******************************
// VirtualList and its associated classes are intended to be used for main list pages: Applications,
// Workloads, Services and Istio Config. They share common style and filter integration. They have
// have limitations in scenarios where different personalization is needed (columns style, or layout).
// For a secondary list, rendered inside a detail page, it is recommended the imple be based on a
// Table component, such as in WorkloadServices, WorkloadPods, ServiceInfoWorkload, IstioConfigSubList,
// or TrafficListComponent.
// ******************************

type Direction = 'asc' | 'desc' | undefined;

type ReduxProps = { activeNamespaces: Namespace[] };

type VirtualListProps<R> = ReduxProps & {
  actions?: JSX.Element[];
  children?: React.ReactNode;
  className?: any;
  hiddenColumns?: string[];
  onResize?: (height: number) => void;
  rows: R[];
  sort?: (sortField: SortField<NamespaceInfo>, isAscending: boolean) => void;
  statefulProps?: StatefulFiltersRef;
  type: string;
};

type VirtualListState<R extends RenderResource> = {
  columns: ResourceType<R>[];
  conf: Resource;
  scrollStyle: string;
  sortBy: {
    direction: Direction;
    index: number;
  };
};

class VirtualListComponent<R extends RenderResource> extends React.Component<VirtualListProps<R>, VirtualListState<R>> {
  private statefulFilters: StatefulFiltersRef = React.createRef();

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
      scrollStyle: kialiStyle({}),
      columns,
      conf
    };
  }

  onSort = (_event: React.MouseEvent, index: number, direction: SortByDirection): void => {
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

  componentDidMount(): void {
    this.updateWindowDimensions();
    window.addEventListener('resize', this.updateWindowDimensions);
  }

  componentWillUnmount(): void {
    window.removeEventListener('resize', this.updateWindowDimensions);
  }

  componentDidUpdate(): void {
    const columns = this.getColumns(this.props.type);

    if (columns.length !== this.state.columns.length) {
      this.setState({ columns: columns });
    }
  }

  getScrollStyle = (height: number): string => {
    if (globalScrollbar === 'false') {
      return kialiStyle({
        height: height,
        padding: '1.25rem',
        marginBottom: '1.25rem',
        width: '100%'
      });
    }
    return kialiStyle({});
  };

  updateWindowDimensions = (): void => {
    const isStandalone = !isKiosk(store.getState().globalState.kiosk);
    const topPadding = isStandalone ? TOP_PADDING : EMBEDDED_PADDING;

    this.setState(
      {
        scrollStyle: this.getScrollStyle(window.innerHeight - topPadding)
      },
      () => {
        if (this.props.onResize) {
          this.props.onResize(window.innerHeight - topPadding);
        }
      }
    );
  };

  private getColumns = (type: string): ResourceType<R>[] => {
    let columns = [] as ResourceType<R>[];
    const conf = config[type] as Resource;

    if (conf.columns) {
      columns = conf.columns.filter(
        info => !this.props.hiddenColumns || !this.props.hiddenColumns.includes(info.title.toLowerCase())
      );
    }

    if (this.props.actions) {
      columns.push({
        title: '',
        name: '',
        sortable: false
      });
    }

    return columns;
  };

  private getSortParams = (
    column: SortableTh,
    index: number,
    sortBy: ISortBy,
    onSort: OnSort
  ): ThProps['sort'] | undefined => {
    return column.sortable
      ? {
          sortBy: sortBy,
          onSort: onSort,
          columnIndex: index
        }
      : undefined;
  };

  render(): React.ReactNode {
    // If there is no global scrollbar, height is fixed to force the scrollbar to appear in the component
    const { rows } = this.props;
    const { sortBy, columns, conf } = this.state;

    const typeDisplay = this.props.type === 'istio' ? 'Istio config' : this.props.type;

    const childrenWithProps = React.Children.map(this.props.children, child => {
      // Checking isValidElement is the safe way and avoids a TS error too.
      if (React.isValidElement(child)) {
        return React.cloneElement(child, { ref: this.statefulFilters } as React.Attributes);
      }

      return child;
    });

    const rowItems: IRow[] = rows.map((row, index) => {
      return (
        <VirtualItem
          key={`vItem_${index}`}
          item={row}
          index={index}
          columns={this.state.columns}
          config={conf}
          statefulFilterProps={this.props.statefulProps ? this.props.statefulProps : this.statefulFilters}
          action={this.props.actions && this.props.actions[index] ? this.props.actions[index] : undefined}
        />
      );
    });
    const table = (
      <Table gridBreakPoint={TableGridBreakpoint.none} role="presentation" isStickyHeader>
        {conf.caption && <Caption>{conf.caption}</Caption>}
        <Thead>
          <Tr>
            {columns.map((column, index) => (
              <Th
                key={`column_${index}`}
                dataLabel={column.title}
                sort={this.getSortParams(column, index, sortBy, this.onSort)}
                width={column.width}
                textCenter={column.textCenter}
              >
                {column.title}
              </Th>
            ))}
          </Tr>
        </Thead>

        <Tbody>
          {this.props.rows.length > 0 ? (
            rowItems
          ) : (
            <Tr className={emptyStyle}>
              <Td colSpan={columns.length}>
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
                    <EmptyStateHeader titleText="No namespace is selected" headingLevel="h5" />
                    <EmptyStateBody>
                      There is currently no namespace selected, please select one using the Namespace selector.
                    </EmptyStateBody>
                  </EmptyState>
                )}
              </Td>
            </Tr>
          )}
        </Tbody>
      </Table>
    );
    return (
      <div className={classes(this.state.scrollStyle, this.props.className)}>
        {childrenWithProps}
        {this.props.actions ? table : <InnerScrollContainer style={{ maxHeight: '95%' }}>{table}</InnerScrollContainer>}
      </div>
    );
  }
}

const mapStateToProps = (state: KialiAppState): ReduxProps => ({
  activeNamespaces: activeNamespacesSelector(state)
});

export const VirtualList = connect(mapStateToProps)(VirtualListComponent);
