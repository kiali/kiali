import * as React from 'react';
import { Server, ServerForm } from '../../../types/IstioObjects';
import { Tbody, Td, Th, Thead, Tr, Table, ThProps } from '@patternfly/react-table';
import { kialiStyle } from 'styles/StyleUtils';
import { PFColors } from '../../../components/Pf/PfColors';
import { Button, ButtonVariant } from '@patternfly/react-core';
import { ServerBuilder, protocols } from './ServerBuilder';
import { KialiIcon } from 'config/KialiIcon';

type ServerListProps = {
  onChange: (server: Server[], serverForm: ServerForm[]) => void;
  serverForm: ServerForm[];
  serverList: Server[];
};

const noServerStyle = kialiStyle({
  color: PFColors.Red100,
  textAlign: 'center'
});

const columns: ThProps[] = [
  {
    title: 'Servers'
  },
  {
    title: ''
  }
];

const addServerStyle = kialiStyle({
  marginLeft: '0.5rem',
  marginTop: '0.25rem'
});

export const ServerList: React.FC<ServerListProps> = (props: ServerListProps) => {
  const onAddServer = (): void => {
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

    const sf = props.serverForm;
    sf.push(newServerForm);

    const newServer: Server = {
      hosts: [],
      port: {
        number: 70000,
        name: '',
        protocol: 'HTTP'
      }
    };

    const s = props.serverList;
    s.push(newServer);

    props.onChange(s, sf);
  };

  const onRemoveServer = (index: number): void => {
    const serverList = props.serverList;
    serverList.splice(index, 1);

    const serverForm = props.serverForm;
    serverForm.splice(index, 1);

    props.onChange(serverList, serverForm);
  };

  const onChange = (serverForm: ServerForm, i: number): void => {
    const serversForm = props.serverForm;
    serversForm[i] = serverForm;

    const servers = props.serverList;
    const newServer = createNewServer(serverForm);

    if (typeof newServer !== 'undefined') {
      servers[i] = newServer;
    }

    props.onChange(servers, serversForm);
  };

  const createNewServer = (serverForm: ServerForm): Server | undefined => {
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

  return (
    <>
      <Table aria-label="Server List">
        <Thead>
          <Tr>
            {columns.map((column, index) => (
              <Th key={`column_${index}`} dataLabel={column.title}>
                {column.title}
              </Th>
            ))}
          </Tr>
        </Thead>
        <Tbody>
          {props.serverForm.length > 0 ? (
            <>
              {props.serverForm.map((server, index) => (
                <ServerBuilder
                  key={`server_builder_${index}`}
                  server={server}
                  onRemoveServer={onRemoveServer}
                  index={index}
                  onChange={onChange}
                ></ServerBuilder>
              ))}
            </>
          ) : (
            <Tr>
              <Td colSpan={columns.length}>
                <div className={noServerStyle}>No Servers defined</div>
              </Td>
            </Tr>
          )}
        </Tbody>
      </Table>

      <Button
        name="addServer"
        variant={ButtonVariant.link}
        icon={<KialiIcon.AddMore />}
        onClick={onAddServer}
        className={addServerStyle}
      >
        Add Server to Servers List
      </Button>
    </>
  );
};
