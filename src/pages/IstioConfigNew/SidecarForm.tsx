import * as React from 'react';
import { cellWidth, ICell, Table, TableBody, TableHeader } from '@patternfly/react-table';
import { style } from 'typestyle';
import { PfColors } from '../../components/Pf/PfColors';
import { Button, FormGroup, Switch, TextInput } from '@patternfly/react-core';
import { isServerHostValid } from '../../utils/IstioConfigUtils';

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
  color: PfColors.Red100
});

const hostsHelperText = 'Enter a valid FQDN host.';

export type EgressHost = {
  host: string;
};

type Props = {
  egressHosts: EgressHost[];
  addWorkloadSelector: boolean;
  workloadSelectorLabels: string;
  onAddEgressHost: (host: EgressHost) => void;
  onChangeSelector: (
    addWorkloadSelector: boolean,
    workloadSelectorValid: boolean,
    workloadSelectorLabels: string
  ) => void;
  onRemoveEgressHost: (index: number) => void;
};

// Gateway and Sidecar states are consolidated in the parent page
export type SidecarState = {
  egressHosts: EgressHost[];
  addWorkloadSelector: boolean;
  workloadSelectorValid: boolean;
  workloadSelectorLabels: string;
};

type State = {
  addEgressHost: EgressHost;
  addWorkloadSelector: boolean;
  workloadSelectorValid: boolean;
  workloadSelectorLabels: string;
  validEgressHost: boolean;
};

class SidecarForm extends React.Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = {
      addEgressHost: {
        host: ''
      },
      addWorkloadSelector: false,
      workloadSelectorValid: false,
      workloadSelectorLabels: '',
      validEgressHost: false
    };
  }

  // @ts-ignore
  actionResolver = (rowData, { rowIndex }) => {
    const removeAction = {
      title: 'Remove Server',
      // @ts-ignore
      onClick: (event, rowIndex, _rowData, _extraData) => {
        this.props.onRemoveEgressHost(rowIndex);
      }
    };
    if (rowIndex < this.props.egressHosts.length) {
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
      validEgressHost: isServerHostValid(host)
    });
  };

  onAddEgressHost = () => {
    this.props.onAddEgressHost(this.state.addEgressHost);
    this.setState({
      addEgressHost: {
        host: ''
      }
    });
  };

  addWorkloadLabels = (value: string, _) => {
    if (value.length === 0) {
      this.setState({
        workloadSelectorValid: false,
        workloadSelectorLabels: ''
      });
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
      () => {
        this.props.onChangeSelector(
          this.state.addWorkloadSelector,
          this.state.workloadSelectorValid,
          this.state.workloadSelectorLabels
        );
      }
    );
  };

  rows() {
    return this.props.egressHosts
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
                isValid={this.state.validEgressHost}
              />
              {!this.state.validEgressHost && (
                <div key="hostsHelperText" className={noEgressHostsStyle}>
                  {hostsHelperText}
                </div>
              )}
            </>,
            <>
              <Button variant="secondary" isDisabled={!this.state.validEgressHost} onClick={this.onAddEgressHost}>
                Add Egress Host
              </Button>
            </>
          ]
        }
      ]);
  }

  render() {
    return (
      <>
        Egress hosts defined:
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
        <FormGroup label="Add Workload Selector" fieldId="workloadSelectorSwitch">
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
                () => {
                  this.props.onChangeSelector(
                    this.state.addWorkloadSelector,
                    this.state.workloadSelectorValid,
                    this.state.workloadSelectorLabels
                  );
                }
              );
            }}
          />
        </FormGroup>
        {this.state.addWorkloadSelector && (
          <FormGroup
            fieldId="workloadLabels"
            label="Labels"
            helperText="One or more labels to select a workload where Sidecar is applied. Enter a label in the format <label>=<value>. Enter one or multiple labels separated by comma."
            helperTextInvalid="Invalid labels format: One or more labels to select a workload where Sidecar is applied. Enter a label in the format <label>=<value>. Enter one or multiple labels separated by comma."
            isValid={this.state.workloadSelectorValid}
          >
            <TextInput
              id="gwHosts"
              name="gwHosts"
              isDisabled={!this.state.addWorkloadSelector}
              value={this.state.workloadSelectorLabels}
              onChange={this.addWorkloadLabels}
              isValid={this.state.workloadSelectorValid}
            />
          </FormGroup>
        )}
        {this.props.egressHosts.length === 0 && (
          <div className={noEgressHostsStyle}>Sidecar has no Egress Hosts Defined</div>
        )}
      </>
    );
  }
}

export default SidecarForm;
