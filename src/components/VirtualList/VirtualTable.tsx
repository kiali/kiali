import * as React from 'react';
import clsx from 'clsx';
import { VirtualTableBody, AutoSizer } from '@patternfly/react-virtualized-extension';
import { CellMeasurerCache, CellMeasurer } from 'react-virtualized';
import { TResource, Resource } from './Config';
import VirtualItem from './VirtualItem';

type VirtualTableProps = {
  rows: TResource[];
  columns?: string[];
  config: Resource;
};

type VirtualTableState = {
  height: number;
};

export default class VirtualTable extends React.Component<VirtualTableProps, VirtualTableState> {
  private measurementCache = new CellMeasurerCache({
    fixedWidth: true,
    minHeight: 44,
    keyMapper: rowIndex => rowIndex
  });

  constructor(props: VirtualTableProps) {
    super(props);
    this.state = { height: 0 };
  }

  componentDidMount() {
    this.updateWindowDimensions();
    window.addEventListener('resize', this.updateWindowDimensions);
  }

  componentWillUnmount() {
    window.removeEventListener('resize', this.updateWindowDimensions);
  }

  updateWindowDimensions = () => {
    this.setState({ height: window.innerHeight * 0.7 });
  };

  rowRenderer = ({ index, isVisible, key, style, parent }) => {
    const { rows, config } = this.props;
    const object: TResource = rows[index];

    const className = clsx({
      isVisible: isVisible
    });

    return (
      <CellMeasurer cache={this.measurementCache} columnIndex={0} key={key} parent={parent} rowIndex={index}>
        <VirtualItem className={className} style={style} item={object} index={index} config={config} />
      </CellMeasurer>
    );
  };

  render() {
    const { rows } = this.props;
    // TODO: This is a chrome/webkit-only fix for kiali#1710. A full fix is waiting of PF to handle header changes when
    //       virtualized table-body space is reduced by vertical scrollbar. When resolved in PF this should be updated.
    const hasOverlay = navigator.userAgent.indexOf('Chrome') !== -1 || navigator.userAgent.indexOf('WebKit') !== -1;
    const overflowY = hasOverlay ? 'overlay' : 'auto';

    return (
      <AutoSizer disableHeight>
        {({ width }) => (
          <VirtualTableBody
            className={'pf-c-table pf-c-virtualized pf-c-window-scroller'}
            deferredMeasurementCache={this.measurementCache}
            rowHeight={this.measurementCache.rowHeight}
            height={this.state.height}
            overscanRowCount={2}
            columnCount={1}
            rows={rows}
            rowCount={rows.length}
            rowRenderer={this.rowRenderer}
            width={width}
            style={{ overflowY: overflowY }}
          />
        )}
      </AutoSizer>
    );
  }
}
