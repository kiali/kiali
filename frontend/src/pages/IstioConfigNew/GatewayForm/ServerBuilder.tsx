import * as React from 'react';
import {
  Button,
  ButtonVariant,
  FormGroup,
  FormHelperText,
  FormSelect,
  FormSelectOption,
  HelperText,
  HelperTextItem
} from '@patternfly/react-core';
import { TextInputBase as TextInput } from '@patternfly/react-core/dist/js/components/TextInput/TextInput';
import { cellWidth, Table, Tbody, Td, Th, Thead, Tr } from '@patternfly/react-table';
import { TrashIcon } from '@patternfly/react-icons';
import { isGatewayHostValid } from '../../../utils/IstioConfigUtils';
import { ServerForm } from '../../../types/IstioObjects';
import { isValid } from 'utils/Common';
import { isValidPort } from './ListenerBuilder';

type Props = {
  server: ServerForm;
  onRemoveServer: (i: number) => void;
  index: number;
  onChange: (serverform: ServerForm, i: number) => void;
};

type State = {
  newHosts: string[];
  isHostsValid: boolean;
  newPortNumber: string;
  newPortName: string;
  newPortProtocol: string;
  newTlsMode: string;
  newTlsServerCertificate: string;
  newTlsPrivateKey: string;
  newTlsCaCertificate: string;
};

const portHeader = [
  {
    title: $t('PeerAuthenticationForm.PortNumber', 'Port Number'),
    transforms: [cellWidth(20) as any],
    props: {}
  },
  {
    title: $t('PortName', 'Port Name'),
    transforms: [cellWidth(20) as any],
    props: {}
  },
  {
    title: $t('Protocol'),
    transforms: [cellWidth(20) as any],
    props: {}
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

export class ServerBuilder extends React.Component<Props, State> {
  onAddHosts = (_event, value: string) => {
    const server = this.props.server;
    server.hosts = value.trim().length === 0 ? [] : value.split(',').map(host => host.trim());

    this.props.onChange(server, this.props.index);
  };

  onAddPortNumber = (_event, value: string) => {
    const server = this.props.server;
    server.number = value.trim();

    this.props.onChange(server, this.props.index);
  };

  onAddPortName = (_event, value: string) => {
    const server = this.props.server;
    server.name = value.trim();

    this.props.onChange(server, this.props.index);
  };

  onAddPortProtocol = (_event, value: string) => {
    const server = this.props.server;
    server.protocol = value.trim();

    this.props.onChange(server, this.props.index);
  };

  onAddTlsMode = (_event, value: string) => {
    const server = this.props.server;
    server.tlsMode = value.trim();

    this.props.onChange(server, this.props.index);
  };

  onAddTlsServerCertificate = (_event, value: string) => {
    const server = this.props.server;
    server.tlsServerCertificate = value.trim();

    this.props.onChange(server, this.props.index);
  };

  onAddTlsPrivateKey = (_event, value: string) => {
    const server = this.props.server;
    server.tlsPrivateKey = value.trim();

    this.props.onChange(server, this.props.index);
  };

  onAddTlsCaCertificate = (_event, value: string) => {
    const server = this.props.server;
    server.tlsCaCertificate = value.trim();

    this.props.onChange(server, this.props.index);
  };

  portRows() {
    return (
      <Tr>
        <Td style={{ padding: '0 10px 0 0' }}>
          <TextInput
            value={this.props.server.number}
            type="text"
            id={'addPortNumber' + this.props.index}
            aria-describedby="add port number"
            name="addPortNumber"
            onChange={this.onAddPortNumber}
            validated={isValid(isValidPort(this.props.server.number))}
          />
        </Td>
        <Td style={{ padding: '0 10px 0 0' }}>
          <TextInput
            value={this.props.server.name}
            type="text"
            id={'addPortName' + this.props.index}
            aria-describedby="add port name"
            name="addPortName"
            onChange={this.onAddPortName}
            validated={isValid(this.props.server.name.length > 0)}
          />
        </Td>
        <Td style={{ padding: '0 10px 0 0' }}>
          <FormSelect
            value={this.props.server.protocol}
            id={'addPortProtocol' + this.props.index}
            name="addPortProtocol"
            onChange={this.onAddPortProtocol}
          >
            {protocols.map((option, index) => (
              <FormSelectOption isDisabled={false} key={'p' + index} value={option} label={option} />
            ))}
          </FormSelect>
        </Td>
      </Tr>
    );
  }

  render() {
    const showTls = this.props.server.protocol === 'HTTPS' || this.props.server.protocol === 'TLS';
    return (
      <Tr>
        <Td>
          <FormGroup label={$t('Hosts')} isRequired={true} fieldId="gateway-selector">
            <TextInput
              value={this.props.server.hosts.join(',')}
              isRequired={true}
              type="text"
              id={'hosts' + this.props.index}
              aria-describedby="hosts"
              name="hosts"
              onChange={this.onAddHosts}
              validated={isValid(areValidHosts(this.props.server.hosts))}
            />
            <FormHelperText>
              <HelperText>
                <HelperTextItem>
                  {isValid(areValidHosts(this.props.server.hosts))
                    ? $t('HelperText.exposedGatewayHosts', 'One or more hosts exposed by this Gateway.')
                    : $t(
                        'HelperText.invalidGatewayHosts',
                        'Invalid hosts for this Gateway. Enter one or more hosts separated by comma.'
                      )}
                </HelperTextItem>
              </HelperText>
            </FormHelperText>
          </FormGroup>
          <FormGroup label={$t('Port')} isRequired={true} fieldId="server-port" style={{ padding: '10px 0' }}>
            <Table aria-label="Port Level MTLS">
              <Thead>
                <Tr>
                  {portHeader.map(e => (
                    <Th>{e.title}</Th>
                  ))}
                </Tr>
              </Thead>
              <Tbody>{this.portRows()}</Tbody>
            </Table>
          </FormGroup>
          {showTls && (
            <FormGroup label={`TLS ${$t('Mode')}`} isRequired={true} fieldId="addTlsMode" style={{ margin: '10px 0' }}>
              <FormSelect
                value={this.props.server.tlsMode}
                id="addTlsMode"
                name="addTlsMode"
                onChange={this.onAddTlsMode}
              >
                {tlsModes.map((option, index) => (
                  <FormSelectOption isDisabled={false} key={'p' + index} value={option} label={$t(option)} />
                ))}
              </FormSelect>
            </FormGroup>
          )}
          {showTls && (this.props.server.tlsMode === 'SIMPLE' || this.props.server.tlsMode === 'MUTUAL') && (
            <>
              <FormGroup
                label={$t('ServerCertificate', 'Server Certificate')}
                style={{ margin: '10px 0' }}
                isRequired={true}
                fieldId="server-certificate"
              >
                <TextInput
                  value={this.props.server.tlsServerCertificate}
                  isRequired={true}
                  type="text"
                  id="server-certificate"
                  aria-describedby="server-certificate"
                  name="server-certificate"
                  onChange={this.onAddTlsServerCertificate}
                  validated={isValid(this.props.server.tlsServerCertificate.length > 0)}
                />
                {!isValid(this.props.server.tlsServerCertificate.length > 0) && (
                  <FormHelperText>
                    <HelperText>
                      <HelperTextItem>
                        {$t(
                          'ServerTLSCertPath',
                          'The path to the file holding the server-side TLS certificate to use.'
                        )}
                      </HelperTextItem>
                    </HelperText>
                  </FormHelperText>
                )}
              </FormGroup>
              <FormGroup
                label={$t('PrivateKey', 'Private Key')}
                isRequired={true}
                fieldId="private-key"
                style={{ margin: '10px 0' }}
              >
                <TextInput
                  value={this.props.server.tlsPrivateKey}
                  isRequired={true}
                  type="text"
                  id="private-key"
                  aria-describedby="private-key"
                  name="private-key"
                  onChange={this.onAddTlsPrivateKey}
                  validated={isValid(this.props.server.tlsPrivateKey.length > 0)}
                />
                {!isValid(this.props.server.tlsPrivateKey.length > 0) && (
                  <FormHelperText>
                    <HelperText>
                      <HelperTextItem>
                        {$t(
                          'HelperText.serverPrivateKeyPath',
                          'The path to the file holding the server’s private key.'
                        )}
                      </HelperTextItem>
                    </HelperText>
                  </FormHelperText>
                )}
              </FormGroup>
            </>
          )}
          {showTls && this.props.server.tlsMode === 'MUTUAL' && (
            <FormGroup
              label={$t('CACertificate', 'CA Certificate')}
              style={{ margin: '10px 0' }}
              isRequired={true}
              fieldId="ca-certificate"
            >
              <TextInput
                value={this.props.server.tlsCaCertificate}
                isRequired={true}
                type="text"
                id="ca-certificate"
                aria-describedby="ca-certificate"
                name="ca-certificate"
                onChange={this.onAddTlsCaCertificate}
                validated={isValid(this.props.server.tlsCaCertificate.length > 0)}
              />
              {!isValid(this.props.server.tlsCaCertificate.length > 0) && (
                <FormHelperText>
                  <HelperText>
                    <HelperTextItem>
                      {$t(
                        'HelperText.caCertificatePath',
                        'The path to a file containing certificate authority certificates to use in verifying a presented  client side certificate.'
                      )}
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
            icon={<TrashIcon />}
            style={{ padding: '0 40%' }}
            onClick={() => this.props.onRemoveServer(this.props.index)}
          />
        </Td>
      </Tr>
    );
  }
}
