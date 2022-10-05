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
    title: 'Listener Name',
    transforms: [cellWidth(100) as any],
    props: {}
  },
  {
    title: 'Port',
    transforms: [cellWidth(20) as any],
    props: {}
  },
  {
    title: 'TLS',
    transforms: [cellWidth(100) as any],
    props: {}
  },
  {
    title: '',
    props: {}
  }
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
            <div>
              [{listener.port}, {listener.protocol}]
            </div>
          </>,
          <>
            {listener.tls ? (
              <>
                <div>{listener.tls.mode}</div>
                {listener.tls.serverCertificate && listener.tls.serverCertificate.length > 0 ? (
                  <div>[{listener.tls.serverCertificate}]</div>
                ) : undefined}
                {listener.tls.privateKey && listener.tls.privateKey.length > 0 ? (
                  <div>[{listener.tls.privateKey}]</div>
                ) : undefined}
                {listener.tls.caCertificates && listener.tls.caCertificates.length > 0 ? (
                  <div>[{listener.tls.caCertificates}]</div>
                ) : undefined}
              </>
            ) : undefined}
          </>,
          <></>
        ]
      };
    });
  };

  // @ts-ignore
  actionResolver = (rowData, { rowIndex }) => {
    const removeAction = {
      title: 'Remove Rule',
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
          aria-label="Server List"
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
