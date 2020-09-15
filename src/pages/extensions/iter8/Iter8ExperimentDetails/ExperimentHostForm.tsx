import { ICell, Table, TableBody, TableHeader, wrappable } from '@patternfly/react-table';
import { Criteria, Host, initCriteria } from '../../../../types/Iter8';
import * as React from 'react';
import { Button, FormSelect, FormSelectOption } from '@patternfly/react-core';

const headerCells: ICell[] = [
  {
    title: 'Gateway name',
    transforms: [wrappable],
    props: {}
  },
  {
    title: 'Host name',
    transforms: [wrappable],
    props: {}
  },
  {
    title: '',
    props: {}
  }
];

type Props = {
  hosts: Host[];
  hostsOfGateway: Host[];
  gateways: string[];
  onAdd: (criteria: Criteria, host: Host) => void;
  onRemove: (type: string, index: number) => void;
};

export type HostState = {
  addHost: Host;
  validName: boolean;
};

export const initHost = (gw: string): HostState => ({
  addHost: {
    name: '',
    gateway: gw
  },
  validName: false
});

// Create Success Criteria, can be multiple with same metric, but different sampleSize, etc...
class ExperimentHostForm extends React.Component<Props, HostState> {
  constructor(props: Props) {
    super(props);
    if (this.props.gateways.length > 0) {
      this.state = initHost(this.props.gateways[0]);
    } else {
      this.state = initHost('');
    }
  }

  // @ts-ignore
  actionResolver = (rowData, { rowIndex }) => {
    const removeAction = {
      title: 'Remove Host',
      // @ts-ignore
      onClick: (event, rowIndex) => {
        this.props.onRemove('Host', rowIndex);
      }
    };
    if (rowIndex < this.props.hosts.length) {
      return [removeAction];
    }
    return [];
  };

  loadHostName = (gw: string) => {
    this.setState(prevState => ({
      addHost: {
        name: prevState.addHost.name,
        gateway: gw
      },
      validName: true
    }));
  };

  onAddName = (value: string) => {
    this.setState(prevState => ({
      addHost: {
        name: value.trim(),
        gateway: prevState.addHost.gateway
      },
      validName: true
    }));
  };

  onAddGateway = (value: string, _) => {
    this.setState(prevState => ({
      addHost: {
        name: prevState.addHost.name,
        gateway: value.trim()
      },
      validName: true
    }));
  };

  onAddHost = () => {
    this.props.onAdd(initCriteria(), this.state.addHost);
    this.setState({
      addHost: {
        name: '',
        gateway: ''
      }
    });
  };

  rows() {
    let hostlist: string[] = [];
    hostlist.push('-- select hostname --');
    if (this.props.hostsOfGateway.length > 0) {
      this.props.hostsOfGateway.forEach(hs => {
        if (this.state.addHost.gateway !== '') {
          if (hs.gateway === this.state.addHost.gateway) hostlist.push(hs.name);
        } else {
          if (hs.gateway === this.props.gateways[0]) hostlist.push(hs.name);
        }
      });
    }

    return this.props.hosts
      .map((host, i) => ({
        key: 'host' + i,
        cells: [<>{host.gateway}</>, <>{host.name}</>, '']
      }))
      .concat([
        {
          key: 'hostNew',
          cells: [
            <>
              <FormSelect
                id="gateway"
                value={this.state.addHost.gateway}
                placeholder="Baseline Deployment"
                onChange={gw => this.loadHostName(gw)}
              >
                {this.props.gateways.map((gw, index) => (
                  <FormSelectOption label={gw} key={'gateway' + index} value={gw} />
                ))}
              </FormSelect>
            </>,
            <>
              <FormSelect
                id="name"
                value={this.state.addHost.name}
                placeholder="Host"
                onChange={host => this.onAddName(host)}
              >
                {hostlist.map((host, index) => (
                  <FormSelectOption label={host} key={'host' + index} value={host} />
                ))}
              </FormSelect>
            </>,
            <>
              <Button
                id="addHostBtn"
                aria-label="slider-text"
                variant="secondary"
                isDisabled={this.state.addHost.gateway.length === 0 || this.state.addHost.name.length === 0}
                onClick={this.onAddHost}
              >
                Add this Host
              </Button>
            </>
          ]
        }
      ]);
  }

  render() {
    return (
      <>
        <Table
          aria-label="Host / Gateway"
          cells={headerCells}
          rows={this.rows()}
          // @ts-ignore
          actionResolver={this.actionResolver}
        >
          <TableHeader />
          <TableBody />
        </Table>
      </>
    );
  }
}

export default ExperimentHostForm;
