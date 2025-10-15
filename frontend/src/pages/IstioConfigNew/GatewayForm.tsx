import * as React from 'react';
import { FormGroup, FormHelperText, HelperText, HelperTextItem, Switch, TextInput } from '@patternfly/react-core';
import { ServerList } from './GatewayForm/ServerList';
import { MAX_PORT, Server, ServerForm, ServerTLSSettings, MIN_PORT } from '../../types/IstioObjects';
import { isValid } from 'utils/Common';
import { areValidHosts } from './GatewayForm/ServerBuilder';
import { defaultGatewayLabel, defaultGatewayLabelValue } from 'config/Constants';

type Props = {
  gateway: GatewayState;
  onChange: (gateway: GatewayState) => void;
};

// Gateway and Sidecar states are consolidated in the parent page
export type GatewayState = {
  addWorkloadSelector: boolean;
  gatewayServers: Server[];
  serversForm: ServerForm[];
  workloadSelectorLabels: string;
  workloadSelectorValid: boolean;
};

export const initGateway = (): GatewayState => ({
  addWorkloadSelector: false,
  gatewayServers: [],
  serversForm: [],
  workloadSelectorLabels: `${defaultGatewayLabel}=${defaultGatewayLabelValue}`,
  workloadSelectorValid: true
});

export const isGatewayStateValid = (g: GatewayState): boolean => {
  return g.workloadSelectorValid && g.gatewayServers.length > 0 && areValidGateways(g.gatewayServers);
};

const areValidGateways = (servers: Server[]): boolean => {
  return servers.every((s: Server) => {
    return (
      areValidHosts(s.hosts) &&
      s.port.name !== '' &&
      s.port.number >= MIN_PORT &&
      s.port.number <= MAX_PORT &&
      isValidTLS(s.port.protocol, s.tls)
    );
  });
};

const isValidTLS = (protocol: string, tls: ServerTLSSettings | undefined): boolean => {
  if (tls !== undefined) {
    const tlsRequired = protocol === 'HTTPS' || protocol === 'TLS';
    const certsValid = tlsRequired
      ? tls.mode === 'SIMPLE' || tls.mode === 'MUTUAL'
        ? tls.serverCertificate !== undefined &&
          tls.serverCertificate?.length > 0 &&
          tls.privateKey !== undefined &&
          tls.privateKey?.length > 0
        : true
      : true;
    const caValid =
      tlsRequired && tls.mode === 'MUTUAL' ? tls.caCertificates !== undefined && tls.caCertificates?.length > 0 : true;

    return certsValid && caValid;
  }
  return true;
};

export class GatewayForm extends React.Component<Props, GatewayState> {
  constructor(props: Props) {
    super(props);
    this.state = initGateway();
  }

  componentDidMount(): void {
    this.setState(this.props.gateway);
  }

  addWorkloadLabels = (_event: React.FormEvent, value: string): void => {
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

  onChangeServer = (servers: Server[], serversForm: ServerForm[]): void => {
    this.setState({ gatewayServers: servers, serversForm: serversForm }, () => this.props.onChange(this.state));
  };

  render(): React.ReactNode {
    return (
      <>
        <FormGroup label="Workload Selector" fieldId="workloadSelectorSwitch">
          <Switch
            id="workloadSelectorSwitch"
            label=" "
            
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
          <FormGroup fieldId="workloadLabels" label="Labels">
            <TextInput
              id="gwHosts"
              name="gwHosts"
              isDisabled={!this.state.addWorkloadSelector}
              value={this.state.workloadSelectorLabels}
              onChange={this.addWorkloadLabels}
              validated={isValid(this.state.workloadSelectorValid)}
            />

            <FormHelperText>
              <HelperText>
                <HelperTextItem>
                  {isValid(this.state.workloadSelectorValid)
                    ? 'One or more labels to select a workload where the Gateway is applied.'
                    : 'Enter a label in the format <label>=<value>. Enter one or multiple labels separated by comma.'}
                </HelperTextItem>
              </HelperText>
            </FormHelperText>
          </FormGroup>
        )}

        <FormGroup label="Server List" fieldId="gwServerList" isRequired={true}>
          <ServerList
            serverList={this.state.gatewayServers}
            serverForm={this.state.serversForm}
            onChange={this.onChangeServer}
          />
        </FormGroup>
      </>
    );
  }
}
