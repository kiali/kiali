import * as React from 'react';
import {
  Button,
  ButtonVariant,
  FormGroup,
  FormHelperText,
  FormSelect,
  FormSelectOption,
  HelperText,
  HelperTextItem,
  TextInput
} from '@patternfly/react-core';
import { IRow, Td, ThProps, Tr } from '@patternfly/react-table';
import { isGatewayHostValid } from '../../../utils/IstioConfigUtils';
import { ServerForm } from '../../../types/IstioObjects';
import { isValid } from 'utils/Common';
import { isValidPort } from './ListenerBuilder';
import { kialiStyle } from 'styles/StyleUtils';
import { KialiIcon } from 'config/KialiIcon';
import { SimpleTable } from 'components/SimpleTable';

type ServerBuilderProps = {
  index: number;
  onChange: (serverform: ServerForm, i: number) => void;
  onRemoveServer: (i: number) => void;
  server: ServerForm;
};

const columns: ThProps[] = [
  {
    title: 'Port Number',
    width: 20
  },
  {
    title: 'Port Name',
    width: 20
  },
  {
    title: 'Protocol',
    width: 20
  }
];

export const protocols = ['HTTP', 'HTTPS', 'GRPC', 'HTTP2', 'MONGO', 'TCP', 'TLS'];
const tlsModes = ['PASSTHROUGH', 'SIMPLE', 'MUTUAL', 'AUTO_PASSTHROUGH', 'ISTIO_MUTUAL'];

export const areValidHosts = (hosts: string[]): boolean => {
  if (hosts.length === 0) {
    return false;
  }

  let isValid = true;

  for (let i = 0; i < hosts.length; i++) {
    if (!isGatewayHostValid(hosts[i])) {
      isValid = false;
      break;
    }
  }

  return isValid;
};

const tableStyle = kialiStyle({
  $nest: {
    '& tr': {
      borderBottom: 0
    },
    '&& tbody td': {
      padding: 0,
      paddingRight: '0.5rem'
    }
  }
});

const deleteButtonStyle = kialiStyle({
  display: 'flex',
  margin: 'auto',
  padding: '0.25rem'
});

export const ServerBuilder: React.FC<ServerBuilderProps> = (props: ServerBuilderProps) => {
  const onAddHosts = (_event: React.FormEvent, value: string): void => {
    const server = props.server;
    server.hosts = value.trim().length === 0 ? [] : value.split(',').map(host => host.trim());

    props.onChange(server, props.index);
  };

  const onAddPortNumber = (_event: React.FormEvent, value: string): void => {
    const server = props.server;
    server.number = value.trim();

    props.onChange(server, props.index);
  };

  const onAddPortName = (_event: React.FormEvent, value: string): void => {
    const server = props.server;
    server.name = value.trim();

    props.onChange(server, props.index);
  };

  const onAddPortProtocol = (_event: React.FormEvent, value: string): void => {
    const server = props.server;
    server.protocol = value.trim();

    props.onChange(server, props.index);
  };

  const onAddTlsMode = (_event: React.FormEvent, value: string): void => {
    const server = props.server;
    server.tlsMode = value.trim();

    props.onChange(server, props.index);
  };

  const onAddTlsServerCertificate = (_event: React.FormEvent, value: string): void => {
    const server = props.server;
    server.tlsServerCertificate = value.trim();

    props.onChange(server, props.index);
  };

  const onAddTlsPrivateKey = (_event: React.FormEvent, value: string): void => {
    const server = props.server;
    server.tlsPrivateKey = value.trim();

    props.onChange(server, props.index);
  };

  const onAddTlsCaCertificate = (_event: React.FormEvent, value: string): void => {
    const server = props.server;
    server.tlsCaCertificate = value.trim();

    props.onChange(server, props.index);
  };

  const portRows: IRow[] = [
    {
      cells: [
        <TextInput
          value={props.server.number}
          type="text"
          id={`addPortNumber_${props.index}`}
          aria-describedby="add port number"
          name="addPortNumber"
          onChange={onAddPortNumber}
          validated={isValid(isValidPort(props.server.number))}
        />,

        <TextInput
          value={props.server.name}
          type="text"
          id={`addPortName_${props.index}`}
          aria-describedby="add port name"
          name="addPortName"
          onChange={onAddPortName}
          validated={isValid(props.server.name.length > 0)}
        />,

        <FormSelect
          value={props.server.protocol}
          id={`addPortProtocol_${props.index}`}
          name="addPortProtocol"
          onChange={onAddPortProtocol}
        >
          {protocols.map((option, index) => (
            <FormSelectOption isDisabled={false} key={`p_${index}`} value={option} label={option} />
          ))}
        </FormSelect>
      ]
    }
  ];

  const showTls = props.server.protocol === 'HTTPS' || props.server.protocol === 'TLS';

  return (
    <Tr>
      <Td>
        <FormGroup label="Hosts" isRequired={true} fieldId="gateway-selector">
          <TextInput
            value={props.server.hosts.join(',')}
            isRequired={true}
            type="text"
            id={`hosts_${props.index}`}
            aria-describedby="hosts"
            name="hosts"
            onChange={onAddHosts}
            validated={isValid(areValidHosts(props.server.hosts))}
          />

          <FormHelperText>
            <HelperText>
              <HelperTextItem>
                {isValid(areValidHosts(props.server.hosts))
                  ? 'One or more hosts exposed by this Gateway.'
                  : 'Invalid hosts for this Gateway. Enter one or more hosts separated by comma.'}
              </HelperTextItem>
            </HelperText>
          </FormHelperText>
        </FormGroup>

        <FormGroup label="Port" isRequired={true} fieldId="server-port" style={{ padding: '0.5rem 0' }}>
          <SimpleTable label="Port Level MTLS" className={tableStyle} columns={columns} rows={portRows} />
        </FormGroup>

        {showTls && (
          <FormGroup label="TLS Mode" isRequired={true} fieldId="addTlsMode" style={{ margin: '0.5rem 0' }}>
            <FormSelect value={props.server.tlsMode} id="addTlsMode" name="addTlsMode" onChange={onAddTlsMode}>
              {tlsModes.map((option, index) => (
                <FormSelectOption isDisabled={false} key={`p_${index}`} value={option} label={option} />
              ))}
            </FormSelect>
          </FormGroup>
        )}

        {showTls && (props.server.tlsMode === 'SIMPLE' || props.server.tlsMode === 'MUTUAL') && (
          <>
            <FormGroup
              label="Server Certificate"
              style={{ margin: '0.5rem 0' }}
              isRequired={true}
              fieldId="server-certificate"
            >
              <TextInput
                value={props.server.tlsServerCertificate}
                isRequired={true}
                type="text"
                id="server-certificate"
                aria-describedby="server-certificate"
                name="server-certificate"
                onChange={onAddTlsServerCertificate}
                validated={isValid(props.server.tlsServerCertificate.length > 0)}
              />

              {!isValid(props.server.tlsServerCertificate.length > 0) && (
                <FormHelperText>
                  <HelperText>
                    <HelperTextItem>
                      The path to the file holding the server-side TLS certificate to use.
                    </HelperTextItem>
                  </HelperText>
                </FormHelperText>
              )}
            </FormGroup>

            <FormGroup label="Private Key" isRequired={true} fieldId="private-key" style={{ margin: '0.5rem 0' }}>
              <TextInput
                value={props.server.tlsPrivateKey}
                isRequired={true}
                type="text"
                id="private-key"
                aria-describedby="private-key"
                name="private-key"
                onChange={onAddTlsPrivateKey}
                validated={isValid(props.server.tlsPrivateKey.length > 0)}
              />

              {!isValid(props.server.tlsPrivateKey.length > 0) && (
                <FormHelperText>
                  <HelperText>
                    <HelperTextItem>The path to the file holding the server’s private key.</HelperTextItem>
                  </HelperText>
                </FormHelperText>
              )}
            </FormGroup>
          </>
        )}

        {showTls && props.server.tlsMode === 'MUTUAL' && (
          <FormGroup label="CA Certificate" style={{ margin: '0.5rem 0' }} isRequired={true} fieldId="ca-certificate">
            <TextInput
              value={props.server.tlsCaCertificate}
              isRequired={true}
              type="text"
              id="ca-certificate"
              aria-describedby="ca-certificate"
              name="ca-certificate"
              onChange={onAddTlsCaCertificate}
              validated={isValid(props.server.tlsCaCertificate.length > 0)}
            />

            {!isValid(props.server.tlsCaCertificate.length > 0) && (
              <FormHelperText>
                <HelperText>
                  <HelperTextItem>
                    The path to a file containing certificate authority certificates to use in verifying a presented
                    client side certificate.
                  </HelperTextItem>
                </HelperText>
              </FormHelperText>
            )}
          </FormGroup>
        )}
      </Td>

      <Td style={{ verticalAlign: 'middle' }}>
        <Button
          id="deleteBtn"
          variant={ButtonVariant.link}
          icon={<KialiIcon.Trash />}
          className={deleteButtonStyle}
          onClick={() => props.onRemoveServer(props.index)}
        />
      </Td>
    </Tr>
  );
};
