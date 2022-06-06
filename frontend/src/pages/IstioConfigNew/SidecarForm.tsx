import * as React from 'react';
import { cellWidth, ICell, Table, TableBody, TableHeader } from '@patternfly/react-table';
import { style } from 'typestyle';
import { PFColors } from '../../components/Pf/PfColors';
// Use TextInputBase like workaround while PF4 team work in https://github.com/patternfly/patternfly-react/issues/4072
import { Button, ButtonVariant, FormGroup, Switch, TextInputBase as TextInput } from '@patternfly/react-core';
import { isSidecarHostValid } from '../../utils/IstioConfigUtils';
import { PlusCircleIcon } from '@patternfly/react-icons';
import { isValid } from 'utils/Common';

const headerCells: ICell[] = [
  {
    title: 'Egress Host',
    transforms: [cellWidth(60) as any],
    props: {}
  },
  {
    title: '',
    props: {}
  }
];

const noEgressHostsStyle = style({
  marginTop: 15,
  color: PFColors.Red100
});

const hostsHelperText = 'Enter a valid namespace/FQDN Egress host.';

export type EgressHost = {
  host: string;
};

type Props = {
  sidecar: SidecarState;
  onChange: (sidecar: SidecarState) => void;
};

export const SIDECAR = 'Sidecar';
export const SIDECARS = 'sidecars';

// Gateway and Sidecar states are consolidated in the parent page
export type SidecarState = {
  addEgressHost: EgressHost;
  addWorkloadSelector: boolean;
  egressHosts: EgressHost[];
  validEgressHost: boolean;
  workloadSelectorValid: boolean;
  workloadSelectorLabels: string;
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

class SidecarForm extends React.Component<Props, SidecarState> {
  constructor(props: Props) {
    super(props);
    this.state = initSidecar('');
  }

  componentDidMount() {
    this.setState(this.props.sidecar);
  }

  // @ts-ignore
  actionResolver = (rowData, { rowIndex }) => {
    const removeAction = {
      title: 'Remove Server',
      // @ts-ignore
      onClick: (event, rowIndex, _rowData, _extraData) => {
        this.setState(
          prevState => {
            prevState.egressHosts.splice(rowIndex, 1);
            return {
              egressHosts: prevState.egressHosts
            };
          },
          () => this.props.onChange(this.state)
        );
      }
    };
    if (rowIndex < this.state.egressHosts.length) {
      return [removeAction];
    }
    return [];
  };

  onAddHost = (value: string, _) => {
    const host = value.trim();
    this.setState({
      addEgressHost: {
        host: host
      },
      validEgressHost: isSidecarHostValid(host)
    });
  };

  onAddEgressHost = () => {
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

  rows() {
    return this.state.egressHosts
      .map((eHost, i) => ({
        key: 'eH' + i,
        cells: [<>{eHost.host}</>, '']
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
            <>
              <Button
                variant={ButtonVariant.link}
                icon={<PlusCircleIcon />}
                isDisabled={!this.state.validEgressHost}
                onClick={this.onAddEgressHost}
              />
            </>
          ]
        }
      ]);
  }

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
            helperText="One or more labels to select a workload where the Sidecar is applied."
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
        <FormGroup label="Egress" fieldId="egressHostTable">
          <Table
            aria-label="Egress Hosts"
            cells={headerCells}
            rows={this.rows()}
            // @ts-ignore
            actionResolver={this.actionResolver}
          >
            <TableHeader />
            <TableBody />
          </Table>
          {this.state.egressHosts.length === 0 && (
            <div className={noEgressHostsStyle}>Sidecar has no Egress Hosts Defined</div>
          )}
        </FormGroup>
      </>
    );
  }
}

export default SidecarForm;
