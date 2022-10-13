import * as React from 'react';
import { Listener } from '../../../types/IstioObjects';
import { cellWidth, ICell, Table, TableBody, TableHeader } from '@patternfly/react-table';
import { style } from 'typestyle';
import { PFColors } from '../../../components/Pf/PfColors';

type Props = {
  listenerList: Listener[];
  onRemoveListener: (index: number) => void;
};

const noListenerStyle = style({
  marginTop: 10,
  color: PFColors.Red100,
  textAlign: 'center',
  width: '100%'
});

const headerCells: ICell[] = [
  {
    title: '',
    transforms: [cellWidth(20) as any],
    props: {}
  },
  {
    title: '',
    transforms: [cellWidth(20) as any],
    props: {}
  },
  {
    title: '',
    transforms: [cellWidth(10) as any],
    props: {}
  },
  {
    title: '',
    transforms: [cellWidth(10) as any],
    props: {}
  },
  {
    title: '',
    transforms: [cellWidth(10) as any],
    props: {}
  },
  {
    title: '',
    transforms: [cellWidth(25) as any],
    props: {}
  },
];

class ListenerList extends React.Component<Props> {
  rows = () => {
    return this.props.listenerList.map((listener, i) => {
      return {
        key: 'listener_' + i,
        cells: [
          <>
            <div>{listener.name}</div>
          </>,
          <>
            <div>{listener.hostname}</div>
          </>,
          <>
            <div>
              {listener.port}
            </div>
          </>,
          <>
            <div>
              {listener.protocol}
            </div>
          </>,
          <>
            <div>{listener.allowedRoutes.namespaces.from}</div>
          </>,
          <>
            <div>{Object.keys(listener.allowedRoutes.namespaces.selector?.matchLabels).length !== 0 ? JSON.stringify(listener.allowedRoutes.namespaces.selector.matchLabels) : ''}</div>
          </>,
        ]
      };
    });
  };

  // @ts-ignore
  actionResolver = (rowData, { rowIndex }) => {
    const removeAction = {
      title: 'Remove Listener',
      // @ts-ignore
      onClick: (event, rowIndex, rowData, extraData) => {
        this.props.onRemoveListener(rowIndex);
      }
    };
    return [removeAction];
  };

  render() {
    return (
      <>
        <Table
          aria-label="Listener List"
          cells={headerCells}
          rows={this.rows()}
          // @ts-ignore
          actionResolver={this.actionResolver}
        >
          <TableHeader />
          <TableBody />
        </Table>
        {this.props.listenerList.length === 0 && <div className={noListenerStyle}>No Listeners defined</div>}
      </>
    );
  }
}

export default ListenerList;
