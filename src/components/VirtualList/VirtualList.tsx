import * as React from 'react';
import { Table, TableHeader, TableGridBreakpoint } from '@patternfly/react-table';
import history, { HistoryManager, URLParam } from '../../app/History';
import { config, Resource, TResource } from './Config';
import VirtualItem from './VirtualItem';
import { EmptyState, EmptyStateBody, EmptyStateVariant, Title } from '@patternfly/react-core';
import { KialiAppState } from '../../store/Store';
import { activeNamespacesSelector } from '../../store/Selectors';
import { connect } from 'react-redux';
import Namespace from '../../types/Namespace';

type Direction = 'asc' | 'desc' | undefined;

type VirtualListProps<R> = {
  rows: R[];
  activeNamespaces: Namespace[];
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

class VirtualListC<R extends TResource> extends React.Component<VirtualListProps<R>, VirtualListState> {
  constructor(props: VirtualListProps<R>) {
    super(props);
    const match = history.location.pathname.match(listRegex) || [];
    const type = match[1] || '';
    const conf = config[type] as Resource;
    const columns =
      conf.columns && config.headerTable
        ? conf.columns.map(info =>
            info.transforms ? { title: info.column, transforms: info.transforms } : { title: info.column }
          )
        : [];
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

    return (
      <div
        style={{
          padding: '20px',
          marginBottom: '20px'
        }}
      >
        {this.props.rows.length > 0 ? (
          <>
            {this.props.children}
            <Table {...tableProps} sortBy={sortBy} onSort={this.onSort}>
              <TableHeader />
              <tbody>
                {rows.map((r, i) => {
                  return <VirtualItem key={'vItem' + i} item={r} index={i} config={conf} />;
                })}
              </tbody>
            </Table>
          </>
        ) : (
          <EmptyState variant={EmptyStateVariant.full}>
            <Title headingLevel="h5" size="lg">
              No {this.state.type} found
            </Title>
            <EmptyStateBody>
              No {this.state.type} in namespace
              {this.props.activeNamespaces.length === 1
                ? ` ${this.props.activeNamespaces[0].name}`
                : `s: ${this.props.activeNamespaces.map(ns => ns.name).join(', ')}`}
            </EmptyStateBody>
          </EmptyState>
        )}
      </div>
    );
  }
}

const mapStateToProps = (state: KialiAppState) => ({
  activeNamespaces: activeNamespacesSelector(state)
});

const VirtualList = connect(mapStateToProps)(VirtualListC);
export default VirtualList;
