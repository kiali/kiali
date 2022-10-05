import * as React from 'react';
import { Button, ButtonVariant, FormGroup, FormSelect, FormSelectOption } from '@patternfly/react-core';
import { TextInputBase as TextInput } from '@patternfly/react-core/dist/js/components/TextInput/TextInput';
import { cellWidth, ICell, Table, TableBody, TableHeader } from '@patternfly/react-table';
import { style } from 'typestyle';
import { PFColors } from '../../../components/Pf/PfColors';
import { PlusCircleIcon } from '@patternfly/react-icons';
import { isGatewayHostValid } from '../../../utils/IstioConfigUtils';
import { Listener } from '../../../types/IstioObjects';
import { isValid } from 'utils/Common';

type Props = {
  onAddListener: (listener: Listener) => void;
};

type State = {
  isHostValid: boolean;
  newHostname: string;
  newPort: string;
  newName: string;
  newProtocol: string;
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

const addListenerStyle = style({
  marginLeft: 0,
  paddingLeft: 0
});

const listenerHeader: ICell[] = [
  {
    title: 'Name',
    transforms: [cellWidth(20) as any],
    props: {}
  },
  {
    title: 'Hostname',
    transforms: [cellWidth(20) as any],
    props: {}
  },
  {
    title: 'Port',
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

//const allowedRoutes = ['All', 'Same', 'Selector'];

const tlsModes = ['PASSTHROUGH', 'SIMPLE', 'MUTUAL', 'AUTO_PASSTHROUGH', 'ISTIO_MUTUAL'];

class ListenerBuilder extends React.Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = {
      newHostname: '',
      isHostValid: false,
      newPort: '',
      newName: '',
      newProtocol: protocols[0],
      newTlsMode: tlsModes[1], // SIMPLE
      newTlsServerCertificate: '',
      newTlsPrivateKey: '',
      newTlsCaCertificate: ''
    };
  }

  canAddListener = (): boolean => {
    const hostValid = this.state.isHostValid;
    const portNumberValid = this.state.newPort.length > 0 && !isNaN(Number(this.state.newPort));
    const portNameValid = this.state.newName.length > 0;
    const tlsRequired = this.state.newProtocol === 'HTTPS' || this.state.newProtocol === 'TLS';
    const tlsCertsValid = tlsRequired
      ? this.state.newTlsMode === 'SIMPLE' || this.state.newTlsMode === 'MUTUAL'
        ? this.state.newTlsServerCertificate.length > 0 && this.state.newTlsPrivateKey.length > 0
        : true
      : true;
    const tlsCaValid =
      tlsRequired && this.state.newTlsMode === 'MUTUAL' ? this.state.newTlsCaCertificate.length > 0 : true;
    return hostValid && portNumberValid && portNameValid && tlsCertsValid && tlsCaValid;
  };

  isValidHost = (host: string): boolean => {
    return isGatewayHostValid(host);
  };

  onAddHostname = (value: string, _) => {
    this.setState({
      newHostname: value,
      isHostValid: this.isValidHost(value)
    });
  };

  onAddPort = (value: string, _) => {
    this.setState({
      newPort: value.trim()
    });
  };

  onAddName = (value: string, _) => {
    this.setState({
      newName: value.trim()
    });
  };

  onAddProtocol = (value: string, _) => {
    this.setState({
      newPort: value
    });
  };

  onAddListener = () => {
    const newListener: Listener = {
      hostname: this.state.newHostname,
      port: +this.state.newPort,
      name: this.state.newName,
      protocol: this.state.newProtocol
    };
    if (this.state.newProtocol === 'HTTPS' || this.state.newProtocol === 'TLS') {
      newListener.tls = {
        mode: this.state.newTlsMode
      };
      if (this.state.newTlsMode === 'SIMPLE' || this.state.newTlsMode === 'MUTUAL') {
        newListener.tls.privateKey = this.state.newTlsPrivateKey;
        newListener.tls.serverCertificate = this.state.newTlsServerCertificate;
      }
      if (this.state.newTlsMode === 'MUTUAL') {
        newListener.tls.caCertificates = this.state.newTlsCaCertificate;
      }
    }
    this.setState(
      {
        newHostname: '',
        isHostValid: false,
        newPort: '',
        newName: '',
        newProtocol: protocols[0],
        newTlsMode: tlsModes[1], // SIMPLE
        newTlsServerCertificate: '',
        newTlsPrivateKey: '',
        newTlsCaCertificate: ''
      },
      () => this.props.onAddListener(newListener)
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
        keys: 'gatewayListenerNew',
        cells: [
          <>
            <TextInput
              value={this.state.newName}
              type="text"
              id="addName"
              aria-describedby="add name"
              name="addName"
              onChange={this.onAddName}
              validated={isValid(this.state.newName.length > 0)}
            />
          </>,
          <>
            <TextInput
              value={this.state.newHostname}
              type="text"
              id="addHostname"
              aria-describedby="add hostname"
              name="addHostname"
              onChange={this.onAddHostname}
              validated={isValid(this.state.newHostname.length > 0)}
            />
          </>,
          <>
            <TextInput
              value={this.state.newPort}
              type="text"
              id="addPort"
              aria-describedby="add port"
              name="addPortNumber"
              onChange={this.onAddPort}
              validated={isValid(this.state.newPort.length > 0 && !isNaN(Number(this.state.newPort)))}
            />
          </>,
          <>
            <FormSelect
              value={this.state.newProtocol}
              id="addPortProtocol"
              name="addPortProtocol"
              onChange={this.onAddProtocol}
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
    const showTls = this.state.newProtocol === 'HTTPS' || this.state.newProtocol === 'TLS';
    return (
      <>
        <FormGroup label="Listener" isRequired={true} fieldId="listener-port">
          <Table aria-label="Port Level MTLS" cells={listenerHeader} rows={this.portRows()}>
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
              helperTextInvalid={'The path to the file holding the listener-side TLS certificate to use.'}
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
              helperTextInvalid={'The path to the file holding the listener’s private key.'}
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
            variant={ButtonVariant.link}
            icon={<PlusCircleIcon />}
            onClick={this.onAddListener}
            isDisabled={!this.canAddListener()}
            className={addListenerStyle}
          >
            Add Listener to Listener List
          </Button>
          {!this.canAddListener() && <span className={warningStyle}>A Listener needs Hostname and Port sections defined</span>}
        </FormGroup>
      </>
    );
  }
}

export default ListenerBuilder;
