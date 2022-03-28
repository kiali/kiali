import * as React from 'react';
// Use TextInputBase like workaround while PF4 team work in https://github.com/patternfly/patternfly-react/issues/4072
import { FormGroup, Switch, TextInputBase as TextInput } from '@patternfly/react-core';
import { isGatewayHostValid } from '../../utils/IstioConfigUtils';
import ServerBuilder from './GatewayForm/ServerBuilder';
import ServerList from './GatewayForm/ServerList';
import { Server } from '../../types/IstioObjects';
import { isValid } from 'utils/Common';

export const GATEWAY = 'Gateway';
export const GATEWAYS = 'gateways';

type Props = {
  gateway: GatewayState;
  onChange: (gateway: GatewayState) => void;
};

// Gateway and Sidecar states are consolidated in the parent page
export type GatewayState = {
  addWorkloadSelector: boolean;
  workloadSelectorValid: boolean;
  workloadSelectorLabels: string;
  gatewayServers: Server[];
  addGatewayServer: Server;
  validHosts: boolean;
};

export const initGateway = (): GatewayState => ({
  addWorkloadSelector: false,
  workloadSelectorLabels: 'istio=ingressgateway',
  workloadSelectorValid: true,
  gatewayServers: [],
  addGatewayServer: {
    hosts: [],
    port: {
      number: 80,
      name: 'http',
      protocol: 'HTTP'
    }
  },
  validHosts: false
});

export const isGatewayStateValid = (g: GatewayState): boolean => {
  return g.workloadSelectorValid && g.gatewayServers.length > 0;
};

class GatewayForm extends React.Component<Props, GatewayState> {
  constructor(props: Props) {
    super(props);
    this.state = initGateway();
  }

  componentDidMount() {
    this.setState(this.props.gateway);
  }

  addWorkloadLabels = (value: string, _) => {
    if (value.length === 0) {
      this.setState(
        {
          workloadSelectorValid: false,
          workloadSelectorLabels: ''
        },
        () => this.props.onChange(this.state)
      );
      return;
    }
    value = value.trim();
    const labels: string[] = value.split(',');
    let isValid = true;
    // Some smoke validation rules for the labels
    for (let i = 0; i < labels.length; i++) {
      const label = labels[i];
      if (label.indexOf('=') < 0) {
        isValid = false;
        break;
      }
      const splitLabel: string[] = label.split('=');
      if (splitLabel.length !== 2) {
        isValid = false;
        break;
      }
      if (splitLabel[0].trim().length === 0 || splitLabel[1].trim().length === 0) {
        isValid = false;
        break;
      }
    }
    this.setState(
      {
        workloadSelectorValid: isValid,
        workloadSelectorLabels: value
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

  onAddServer = () => {
    this.setState(
      prevState => {
        prevState.gatewayServers.push(prevState.addGatewayServer);
        return {
          gatewayServers: prevState.gatewayServers,
          addGatewayServer: {
            hosts: [],
            port: {
              number: 80,
              name: 'http',
              protocol: 'HTTP'
            }
          }
        };
      },
      () => this.props.onChange(this.state)
    );
  };

  onRemoveServer = (index: number) => {
    this.setState(
      prevState => {
        prevState.gatewayServers.splice(index, 1);
        return {
          gatewayServers: prevState.gatewayServers
        };
      },
      () => this.props.onChange(this.state)
    );
  };

  render() {
    return (
      <>
        <FormGroup label="Workload Selector" fieldId="workloadSelectorSwitch">
          <Switch
            id="workloadSelectorSwitch"
            label={' '}
            labelOff={' '}
            isChecked={this.state.addWorkloadSelector}
            onChange={() => {
              this.setState(
                prevState => ({
                  addWorkloadSelector: !prevState.addWorkloadSelector
                }),
                () => this.props.onChange(this.state)
              );
            }}
          />
        </FormGroup>
        {this.state.addWorkloadSelector && (
          <FormGroup
            fieldId="workloadLabels"
            label="Labels"
            helperText="One or more labels to select a workload where the Gateway is applied."
            helperTextInvalid="Enter a label in the format <label>=<value>. Enter one or multiple labels separated by comma."
            validated={isValid(this.state.workloadSelectorValid)}
          >
            <TextInput
              id="gwHosts"
              name="gwHosts"
              isDisabled={!this.state.addWorkloadSelector}
              value={this.state.workloadSelectorLabels}
              onChange={this.addWorkloadLabels}
              validated={isValid(this.state.workloadSelectorValid)}
            />
          </FormGroup>
        )}
        <ServerBuilder
          onAddServer={server => {
            this.setState(
              {
                addGatewayServer: server
              },
              () => this.onAddServer()
            );
          }}
        />
        <FormGroup label="Server List" fieldId="gwServerList">
          <ServerList serverList={this.state.gatewayServers} onRemoveServer={this.onRemoveServer} />
        </FormGroup>
      </>
    );
  }
}

export default GatewayForm;
