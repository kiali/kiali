import * as React from 'react';
import { Server, ServerForm } from '../../../types/IstioObjects';
import { cellWidth, Tbody, Td, Th, Thead, Tr, TableComposable } from '@patternfly/react-table';
import { kialiStyle } from 'styles/StyleUtils';
import { PFColors } from '../../../components/Pf/PfColors';
import { Button, ButtonVariant } from '@patternfly/react-core';
import { PlusCircleIcon } from '@patternfly/react-icons';
import { ServerBuilder, protocols } from './ServerBuilder';

type Props = {
  serverList: Server[];
  serverForm: ServerForm[];
  onChange: (server: Server[], serverForm: ServerForm[]) => void;
};

const noServerStyle = kialiStyle({
  marginTop: 10,
  color: PFColors.Red100,
  textAlign: 'center',
  width: '100%'
});

const headerCells = [
  {
    title: 'Servers',
    transforms: [cellWidth(100) as any],
    props: {}
  },
  {
    title: '',
    props: {}
  }
];

const addServerStyle = kialiStyle({
  marginLeft: 0,
  paddingLeft: 0
});

export class ServerList extends React.Component<Props> {
  onAddServer = () => {
    const newServerForm: ServerForm = {
      hosts: [],
      number: '',
      protocol: protocols[0],
      name: '',
      tlsMode: '',
      tlsServerCertificate: '',
      tlsPrivateKey: '',
      tlsCaCertificate: ''
    };
    const sf = this.props.serverForm;
    sf.push(newServerForm);

    const newServer: Server = {
      hosts: [],
      port: {
        number: 70000,
        name: '',
        protocol: 'HTTP'
      }
    };
    const s = this.props.serverList;
    s.push(newServer);

    this.setState({}, () => this.props.onChange(s, sf));
  };

  onRemoveServer = (index: number) => {
    const serverList = this.props.serverList;
    serverList.splice(index, 1);

    const serverForm = this.props.serverForm;
    serverForm.splice(index, 1);

    this.setState({}, () => this.props.onChange(serverList, serverForm));
  };

  onChange = (serverForm: ServerForm, i: number) => {
    const serversForm = this.props.serverForm;
    serversForm[i] = serverForm;

    const servers = this.props.serverList;
    const newServer = this.createNewServer(serverForm);
    if (typeof newServer !== 'undefined') {
      servers[i] = newServer;
    }

    this.props.onChange(servers, serversForm);
  };

  createNewServer = (serverForm: ServerForm) => {
    if (serverForm.hosts.length === 0) return;
    if (serverForm.number.length === 0 || isNaN(Number(serverForm.number))) return;
    if (serverForm.name.length === 0) return;

    const server: Server = {
      hosts: serverForm.hosts,
      port: { number: Number(serverForm.number), name: serverForm.name, protocol: serverForm.protocol },
      tls:
        serverForm.protocol === 'HTTPS' || serverForm.protocol === 'TLS'
          ? {
              mode: serverForm.tlsMode,
              serverCertificate: serverForm.tlsServerCertificate,
              privateKey: serverForm.tlsPrivateKey,
              caCertificates: serverForm.tlsCaCertificate
            }
          : undefined
    };
    return server;
  };

  render() {
    return (
      <>
        <TableComposable aria-label="Server List">
          <Thead>
            <Tr>
              {headerCells.map(e => (
                <Th>{e.title}</Th>
              ))}
            </Tr>
          </Thead>
          <Tbody>
            {this.props.serverForm.map((server, i) => (
              <ServerBuilder
                server={server}
                onRemoveServer={this.onRemoveServer}
                index={i}
                onChange={this.onChange}
              ></ServerBuilder>
            ))}
            <Tr>
              <Td>
                <Button
                  name="addServer"
                  variant={ButtonVariant.link}
                  icon={<PlusCircleIcon />}
                  onClick={this.onAddServer}
                  className={addServerStyle}
                >
                  Add Server to Servers List
                </Button>
              </Td>
            </Tr>
          </Tbody>
        </TableComposable>
        {this.props.serverList.length === 0 && <div className={noServerStyle}>No Servers defined</div>}
      </>
    );
  }
}
