import * as React from 'react';
import { Button, FormGroup, FormSelect, FormSelectOption } from '@patternfly/react-core';
import { TextInputBase as TextInput } from '@patternfly/react-core/dist/js/components/TextInput/TextInput';
import { cellWidth, ICell, Table, TableBody, TableHeader } from '@patternfly/react-table';
import { style } from 'typestyle';
import { PFColors } from '../../../components/Pf/PfColors';
import { PlusCircleIcon } from '@patternfly/react-icons';
import { isGatewayHostValid } from '../../../utils/IstioConfigUtils';
import { Server } from '../../../types/IstioObjects';
import { isValid } from 'utils/Common';

type Props = {
  onAddServer: (server: Server) => void;
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

const warningStyle = style({
  marginLeft: 25,
  color: PFColors.Red100,
  textAlign: 'center'
});

const addServerStyle = style({
  marginLeft: 0,
  paddingLeft: 0
});

const portHeader: ICell[] = [
  {
    title: 'Port Number',
    transforms: [cellWidth(20) as any],
    props: {}
  },
  {
    title: 'Port Name',
    transforms: [cellWidth(20) as any],
    props: {}
  },
  {
    title: 'Protocol',
    transforms: [cellWidth(20) as any],
    props: {}
  }
];

const protocols = ['HTTP', 'HTTPS', 'GRPC', 'HTTP2', 'MONGO', 'TCP', 'TLS'];

const tlsModes = ['PASSTHROUGH', 'SIMPLE', 'MUTUAL', 'AUTO_PASSTHROUGH', 'ISTIO_MUTUAL'];

class ServerBuilder extends React.Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = {
      newHosts: [],
      isHostsValid: false,
      newPortNumber: '',
      newPortName: '',
      newPortProtocol: protocols[0],
      newTlsMode: tlsModes[1], // SIMPLE
      newTlsServerCertificate: '',
      newTlsPrivateKey: '',
      newTlsCaCertificate: ''
    };
  }

  canAddServer = (): boolean => {
    const hostValid = this.state.isHostsValid;
    const portNumberValid = this.state.newPortNumber.length > 0 && !isNaN(Number(this.state.newPortNumber));
    const portNameValid = this.state.newPortName.length > 0;
    const tlsRequired = this.state.newPortProtocol === 'HTTPS' || this.state.newPortProtocol === 'TLS';
    const tlsCertsValid = tlsRequired
      ? this.state.newTlsMode === 'SIMPLE' || this.state.newTlsMode === 'MUTUAL'
        ? this.state.newTlsServerCertificate.length > 0 && this.state.newTlsPrivateKey.length > 0
        : true
      : true;
    const tlsCaValid =
      tlsRequired && this.state.newTlsMode === 'MUTUAL' ? this.state.newTlsCaCertificate.length > 0 : true;
    return hostValid && portNumberValid && portNameValid && tlsCertsValid && tlsCaValid;
  };

  areValidHosts = (hosts: string[]): boolean => {
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

  onAddHosts = (value: string, _) => {
    const hosts = value.trim().length === 0 ? [] : value.split(',').map(host => host.trim());
    this.setState({
      newHosts: hosts,
      isHostsValid: this.areValidHosts(hosts)
    });
  };

  onAddPortNumber = (value: string, _) => {
    this.setState({
      newPortNumber: value.trim()
    });
  };

  onAddPortName = (value: string, _) => {
    this.setState({
      newPortName: value.trim()
    });
  };

  onAddPortProtocol = (value: string, _) => {
    this.setState({
      newPortProtocol: value
    });
  };

  onAddServer = () => {
    const newServer: Server = {
      hosts: this.state.newHosts,
      port: {
        number: +this.state.newPortNumber,
        name: this.state.newPortName,
        protocol: this.state.newPortProtocol
      }
    };
    if (this.state.newPortProtocol === 'HTTPS' || this.state.newPortProtocol === 'TLS') {
      newServer.tls = {
        mode: this.state.newTlsMode
      };
      if (this.state.newTlsMode === 'SIMPLE' || this.state.newTlsMode === 'MUTUAL') {
        newServer.tls.privateKey = this.state.newTlsPrivateKey;
        newServer.tls.serverCertificate = this.state.newTlsServerCertificate;
      }
      if (this.state.newTlsMode === 'MUTUAL') {
        newServer.tls.caCertificates = this.state.newTlsCaCertificate;
      }
    }
    this.setState(
      {
        newHosts: [],
        isHostsValid: false,
        newPortNumber: '',
        newPortName: '',
        newPortProtocol: protocols[0],
        newTlsMode: tlsModes[1], // SIMPLE
        newTlsServerCertificate: '',
        newTlsPrivateKey: '',
        newTlsCaCertificate: ''
      },
      () => this.props.onAddServer(newServer)
    );
  };

  onAddTlsMode = (value: string, _) => {
    this.setState({
      newTlsMode: value
    });
  };

  onAddTlsServerCertificate = (value: string, _) => {
    this.setState({
      newTlsServerCertificate: value
    });
  };

  onAddTlsPrivateKey = (value: string, _) => {
    this.setState({
      newTlsPrivateKey: value
    });
  };

  onAddTlsCaCertificate = (value: string, _) => {
    this.setState({
      newTlsCaCertificate: value
    });
  };

  portRows() {
    return [
      {
        keys: 'gatewayPortNew',
        cells: [
          <>
            <TextInput
              value={this.state.newPortNumber}
              type="text"
              id="addPortNumber"
              aria-describedby="add port number"
              name="addPortNumber"
              onChange={this.onAddPortNumber}
              validated={isValid(this.state.newPortNumber.length > 0 && !isNaN(Number(this.state.newPortNumber)))}
            />
          </>,
          <>
            <TextInput
              value={this.state.newPortName}
              type="text"
              id="addPortName"
              aria-describedby="add port name"
              name="addPortName"
              onChange={this.onAddPortName}
              validated={isValid(this.state.newPortName.length > 0)}
            />
          </>,
          <>
            <FormSelect
              value={this.state.newPortProtocol}
              id="addPortProtocol"
              name="addPortProtocol"
              onChange={this.onAddPortProtocol}
            >
              {protocols.map((option, index) => (
                <FormSelectOption isDisabled={false} key={'p' + index} value={option} label={option} />
              ))}
            </FormSelect>
          </>
        ]
      }
    ];
  }

  render() {
    const showTls = this.state.newPortProtocol === 'HTTPS' || this.state.newPortProtocol === 'TLS';
    return (
      <>
        <FormGroup
          label="Hosts"
          isRequired={true}
          fieldId="gateway-selector"
          helperText="One or more hosts exposed by this Gateway."
          helperTextInvalid="Invalid hosts for this Gateway. Enter one or more hosts separated by comma."
          validated={isValid(this.state.isHostsValid)}
        >
          <TextInput
            value={this.state.newHosts.join(',')}
            isRequired={true}
            type="text"
            id="hosts"
            aria-describedby="hosts"
            name="hosts"
            onChange={this.onAddHosts}
            validated={isValid(this.state.isHostsValid)}
          />
        </FormGroup>
        <FormGroup label="Port" isRequired={true} fieldId="server-port">
          <Table aria-label="Port Level MTLS" cells={portHeader} rows={this.portRows()}>
            <TableHeader />
            <TableBody />
          </Table>
        </FormGroup>
        {showTls && (
          <FormGroup label="TLS Mode" isRequired={true} fieldId="addTlsMode">
            <FormSelect value={this.state.newTlsMode} id="addTlsMode" name="addTlsMode" onChange={this.onAddTlsMode}>
              {tlsModes.map((option, index) => (
                <FormSelectOption isDisabled={false} key={'p' + index} value={option} label={option} />
              ))}
            </FormSelect>
          </FormGroup>
        )}
        {showTls && (this.state.newTlsMode === 'SIMPLE' || this.state.newTlsMode === 'MUTUAL') && (
          <>
            <FormGroup
              label="Server Certificate"
              isRequired={true}
              fieldId="server-certificate"
              validated={isValid(this.state.newTlsServerCertificate.length > 0)}
              helperTextInvalid={'The path to the file holding the server-side TLS certificate to use.'}
            >
              <TextInput
                value={this.state.newTlsServerCertificate}
                isRequired={true}
                type="text"
                id="server-certificate"
                aria-describedby="server-certificate"
                name="server-certificate"
                onChange={this.onAddTlsServerCertificate}
                validated={isValid(this.state.newTlsServerCertificate.length > 0)}
              />
            </FormGroup>
            <FormGroup
              label="Private Key"
              isRequired={true}
              fieldId="private-key"
              validated={isValid(this.state.newTlsPrivateKey.length > 0)}
              helperTextInvalid={'The path to the file holding the server’s private key.'}
            >
              <TextInput
                value={this.state.newTlsPrivateKey}
                isRequired={true}
                type="text"
                id="private-key"
                aria-describedby="private-key"
                name="private-key"
                onChange={this.onAddTlsPrivateKey}
                validated={isValid(this.state.newTlsPrivateKey.length > 0)}
              />
            </FormGroup>
          </>
        )}
        {showTls && this.state.newTlsMode === 'MUTUAL' && (
          <FormGroup
            label="CA Certificate"
            isRequired={true}
            fieldId="ca-certificate"
            validated={isValid(this.state.newTlsCaCertificate.length > 0)}
            helperTextInvalid={
              'The path to a file containing certificate authority certificates to use in verifying a presented client side certificate.'
            }
          >
            <TextInput
              value={this.state.newTlsCaCertificate}
              isRequired={true}
              type="text"
              id="ca-certificate"
              aria-describedby="ca-certificate"
              name="ca-certificate"
              onChange={this.onAddTlsCaCertificate}
              validated={isValid(this.state.newTlsCaCertificate.length > 0)}
            />
          </FormGroup>
        )}
        <FormGroup fieldId="addRule">
          <Button
            variant="link"
            icon={<PlusCircleIcon />}
            onClick={this.onAddServer}
            isDisabled={!this.canAddServer()}
            className={addServerStyle}
          >
            Add Server to Server List
          </Button>
          {!this.canAddServer() && <span className={warningStyle}>A Server needs Hosts and Port sections defined</span>}
        </FormGroup>
      </>
    );
  }
}

export default ServerBuilder;
