import * as React from 'react';
import { IRow, ThProps } from '@patternfly/react-table';
import { kialiStyle } from 'styles/StyleUtils';
import { PFColors } from '../../components/Pf/PfColors';
import {
  Button,
  ButtonVariant,
  FormGroup,
  FormHelperText,
  HelperText,
  HelperTextItem,
  Switch,
  TextInput
} from '@patternfly/react-core';
import { isSidecarHostValid } from '../../utils/IstioConfigUtils';
import { isValid } from 'utils/Common';
import { KialiIcon } from 'config/KialiIcon';
import { SimpleTable } from 'components/Table/SimpleTable';

const columns: ThProps[] = [
  {
    title: 'Egress Host',
    width: 60
  },
  {
    title: ''
  }
];

const noEgressHostsStyle = kialiStyle({
  marginTop: '1rem',
  color: PFColors.Red100
});

const hostsHelperText = 'Enter a valid namespace/FQDN Egress host.';

export type EgressHost = {
  host: string;
};

type Props = {
  onChange: (sidecar: SidecarState) => void;
  sidecar: SidecarState;
};

// Gateway and Sidecar states are consolidated in the parent page
export type SidecarState = {
  addEgressHost: EgressHost;
  addWorkloadSelector: boolean;
  egressHosts: EgressHost[];
  validEgressHost: boolean;
  workloadSelectorLabels: string;
  workloadSelectorValid: boolean;
};

export const isSidecarStateValid = (s: SidecarState): boolean => {
  return s.egressHosts.length > 0 && (!s.addWorkloadSelector || (s.addWorkloadSelector && s.workloadSelectorValid));
};

export const initSidecar = (initHost: string): SidecarState => {
  return {
    addEgressHost: {
      host: ''
    },
    addWorkloadSelector: false,
    egressHosts: [
      {
        host: initHost
      }
    ],
    validEgressHost: false,
    workloadSelectorValid: false,
    workloadSelectorLabels: ''
  };
};

export class SidecarForm extends React.Component<Props, SidecarState> {
  constructor(props: Props) {
    super(props);
    this.state = initSidecar('');
  }

  componentDidMount(): void {
    this.setState(this.props.sidecar);
  }

  onAddHost = (_event: React.FormEvent, value: string): void => {
    const host = value.trim();

    this.setState({
      addEgressHost: {
        host: host
      },
      validEgressHost: isSidecarHostValid(host)
    });
  };

  onAddEgressHost = (): void => {
    this.setState(
      prevState => {
        prevState.egressHosts.push(this.state.addEgressHost);

        return {
          egressHosts: prevState.egressHosts,
          addEgressHost: {
            host: ''
          }
        };
      },
      () => this.props.onChange(this.state)
    );
  };

  onRemoveEgressHost = (rowIndex: number): void => {
    this.setState(
      prevState => {
        prevState.egressHosts.splice(rowIndex, 1);

        return {
          egressHosts: prevState.egressHosts
        };
      },
      () => this.props.onChange(this.state)
    );
  };

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

  rows = (): IRow[] => {
    return this.state.egressHosts
      .map((eHost, index) => ({
        key: `eH_${index}`,
        cells: [
          <>{eHost.host}</>,
          <Button
            variant={ButtonVariant.link}
            icon={<KialiIcon.Delete />}
            onClick={() => this.onRemoveEgressHost(index)}
          />
        ]
      }))
      .concat([
        {
          key: 'eHNew',
          cells: [
            <>
              <TextInput
                value={this.state.addEgressHost.host}
                type="text"
                id="addEgressHost"
                key="addEgressHost"
                aria-describedby="add egress host"
                name="addHost"
                onChange={this.onAddHost}
                validated={isValid(this.state.validEgressHost)}
              />

              {!this.state.validEgressHost && (
                <div key="hostsHelperText" className={noEgressHostsStyle}>
                  {hostsHelperText}
                </div>
              )}
            </>,
            <Button
              variant={ButtonVariant.link}
              icon={<KialiIcon.AddMore />}
              isDisabled={!this.state.validEgressHost}
              onClick={this.onAddEgressHost}
            />
          ]
        }
      ]);
  };

  render(): React.ReactNode {
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
                    ? 'One or more labels to select a workload where the Sidecar is applied.'
                    : 'Enter a label in the format <label>=<value>. Enter one or multiple labels separated by comma.'}
                </HelperTextItem>
              </HelperText>
            </FormHelperText>
          </FormGroup>
        )}

        <FormGroup label="Egress" fieldId="egressHostTable">
          <SimpleTable label="Egress Hosts" columns={columns} rows={this.rows()} />

          {this.state.egressHosts.length === 0 && (
            <div className={noEgressHostsStyle}>Sidecar has no Egress Hosts Defined</div>
          )}
        </FormGroup>
      </>
    );
  }
}
