import * as React from 'react';
import { cellWidth, ICell, Table, TableBody, TableHeader } from '@patternfly/react-table';
// Use TextInputBase like workaround while PF4 team work in https://github.com/patternfly/patternfly-react/issues/4072
import { Button, FormSelect, FormSelectOption, TextInputBase as TextInput } from '@patternfly/react-core';
import { style } from 'typestyle';
import { PfColors } from '../../components/Pf/PfColors';
import { isGatewayHostValid } from '../../utils/IstioConfigUtils';

const headerCells: ICell[] = [
  {
    title: 'Hosts',
    transforms: [cellWidth(60) as any],
    props: {}
  },
  {
    title: 'Port Number',
    transforms: [cellWidth(10) as any],
    props: {}
  },
  {
    title: 'Port Name',
    transforms: [cellWidth(10) as any],
    props: {}
  },
  {
    title: 'Port Protocol',
    transforms: [cellWidth(10) as any],
    props: {}
  },
  {
    title: '',
    props: {}
  }
];

export const GATEWAY = 'Gateway';
export const GATEWAYS = 'gateways';

const protocols = ['HTTP', 'HTTPS', 'GRPC', 'HTTP2', 'MONGO', 'TCP', 'TLS'];

const noGatewayServerStyle = style({
  marginTop: 15,
  color: PfColors.Red100
});

const hostsHelperText = 'One or more valid FQDN host separated by comma.';

type Props = {
  gateway: GatewayState;
  onChange: (gateway: GatewayState) => void;
};

export type GatewayServer = {
  hosts: string[];
  portNumber: string;
  portName: string;
  portProtocol: string;
};

// Gateway and Sidecar states are consolidated in the parent page
export type GatewayState = {
  gatewayServers: GatewayServer[];
  addGatewayServer: GatewayServer;
  validHosts: boolean;
};

export const initGateway = (): GatewayState => ({
  gatewayServers: [],
  addGatewayServer: {
    hosts: [],
    portNumber: '80',
    portName: 'http',
    portProtocol: 'HTTP'
  },
  validHosts: false
});

export const isGatewayStateValid = (g: GatewayState): boolean => {
  return g.gatewayServers.length > 0;
};

class GatewayForm extends React.Component<Props, GatewayState> {
  constructor(props: Props) {
    super(props);
    this.state = initGateway();
  }

  componentDidMount() {
    this.setState(this.props.gateway);
  }

  // @ts-ignore
  actionResolver = (rowData, { rowIndex }) => {
    const removeAction = {
      title: 'Remove Server',
      // @ts-ignore
      onClick: (event, rowIndex, rowData, extraData) => {
        this.setState(
          prevState => {
            prevState.gatewayServers.splice(rowIndex, 1);
            return {
              gatewayServers: prevState.gatewayServers
            };
          },
          () => this.props.onChange(this.state)
        );
      }
    };
    if (rowIndex < this.state.gatewayServers.length) {
      return [removeAction];
    }
    return [];
  };

  onAddHosts = (value: string, _) => {
    const hosts = value.trim().length === 0 ? [] : value.split(',').map(host => host.trim());
    this.setState(prevState => ({
      addGatewayServer: {
        hosts: hosts,
        portNumber: prevState.addGatewayServer.portNumber,
        portName: prevState.addGatewayServer.portName,
        portProtocol: prevState.addGatewayServer.portProtocol
      },
      validHosts: this.areValidHosts(hosts)
    }));
  };

  onAddPortNumber = (value: string, _) => {
    this.setState(prevState => ({
      addGatewayServer: {
        hosts: prevState.addGatewayServer.hosts,
        portNumber: value.trim(),
        portName: prevState.addGatewayServer.portName,
        portProtocol: prevState.addGatewayServer.portProtocol
      }
    }));
  };

  onAddPortName = (value: string, _) => {
    this.setState(prevState => ({
      addGatewayServer: {
        hosts: prevState.addGatewayServer.hosts,
        portNumber: prevState.addGatewayServer.portNumber,
        portName: value.trim(),
        portProtocol: prevState.addGatewayServer.portProtocol
      }
    }));
  };

  onAddPortProtocol = (value: string, _) => {
    this.setState(prevState => ({
      addGatewayServer: {
        hosts: prevState.addGatewayServer.hosts,
        portNumber: prevState.addGatewayServer.portNumber,
        portName: prevState.addGatewayServer.portName,
        portProtocol: value.trim()
      }
    }));
  };

  onAddServer = () => {
    this.setState(
      prevState => {
        prevState.gatewayServers.push(prevState.addGatewayServer);
        return {
          gatewayServers: prevState.gatewayServers,
          addGatewayServer: {
            hosts: [],
            portNumber: '80',
            portName: 'http',
            portProtocol: 'HTTP'
          }
        };
      },
      () => this.props.onChange(this.state)
    );
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

  rows() {
    return this.state.gatewayServers
      .map((gw, i) => ({
        key: 'gatewayServer' + i,
        cells: [
          <>
            {gw.hosts.map((host, j) => (
              <div key={'gwHost_' + i + '_' + j}>{host}</div>
            ))}
          </>,
          <>{gw.portNumber}</>,
          <>{gw.portName}</>,
          <>{gw.portProtocol}</>,
          ''
        ]
      }))
      .concat([
        {
          key: 'gwNew',
          cells: [
            <>
              <TextInput
                value={this.state.addGatewayServer.hosts.join(',')}
                type="text"
                id="addHosts"
                key="addHosts"
                aria-describedby="add hosts"
                name="addHosts"
                onChange={this.onAddHosts}
                isValid={this.state.validHosts}
              />
              {!this.state.validHosts && (
                <div key="hostsHelperText" className={noGatewayServerStyle}>
                  {hostsHelperText}
                </div>
              )}
            </>,
            <>
              <TextInput
                value={this.state.addGatewayServer.portNumber}
                type="number"
                id="addPortNumber"
                aria-describedby="add port number"
                name="addPortNumber"
                onChange={this.onAddPortNumber}
                isValid={
                  this.state.addGatewayServer.portNumber.length > 0 &&
                  !isNaN(Number(this.state.addGatewayServer.portNumber))
                }
              />
            </>,
            <>
              <TextInput
                value={this.state.addGatewayServer.portName}
                type="text"
                id="addPortName"
                aria-describedby="add port name"
                name="addPortName"
                onChange={this.onAddPortName}
                isValid={this.state.addGatewayServer.portName.length > 0}
              />
            </>,
            <>
              <FormSelect
                value={this.state.addGatewayServer.portProtocol}
                id="addPortProtocol"
                name="addPortProtocol"
                onChange={this.onAddPortProtocol}
              >
                {protocols.map((option, index) => (
                  <FormSelectOption isDisabled={false} key={'p' + index} value={option} label={option} />
                ))}
              </FormSelect>
            </>,
            <>
              <Button
                id="addServerBtn"
                variant="secondary"
                isDisabled={
                  !this.state.validHosts ||
                  this.state.addGatewayServer.portNumber.length === 0 ||
                  this.state.addGatewayServer.portName.length === 0 ||
                  isNaN(Number(this.state.addGatewayServer.portNumber))
                }
                onClick={this.onAddServer}
              >
                Add Server
              </Button>
            </>
          ]
        }
      ]);
  }

  render() {
    return (
      <>
        Servers defined:
        <Table
          aria-label="Gateway Servers"
          cells={headerCells}
          rows={this.rows()}
          // @ts-ignore
          actionResolver={this.actionResolver}
        >
          <TableHeader />
          <TableBody />
        </Table>
        {this.state.gatewayServers.length === 0 && (
          <div className={noGatewayServerStyle}>Gateway has no Servers Defined</div>
        )}
      </>
    );
  }
}

export default GatewayForm;
