import * as React from 'react';
import { Button, ButtonVariant, FormGroup, FormSelect, FormSelectOption, Switch } from '@patternfly/react-core';
import { TextInputBase as TextInput } from '@patternfly/react-core/dist/js/components/TextInput/TextInput';
import { PeerAuthenticationMutualTLSMode } from '../../types/IstioObjects';
import { cellWidth, ICell, Table, TableBody, TableHeader } from '@patternfly/react-table';
import { style } from 'typestyle';
import { PFColors } from '../../components/Pf/PfColors';
import { PlusCircleIcon } from '@patternfly/react-icons';
import { isValid } from 'utils/Common';

const noPortMtlsStyle = style({
  marginTop: 15,
  color: PFColors.Red100
});

const headerCells: ICell[] = [
  {
    title: 'Port Number',
    transforms: [cellWidth(20) as any],
    props: {}
  },
  {
    title: 'Mutual TLS Mode',
    transforms: [cellWidth(20) as any],
    props: {}
  },
  {
    title: '',
    props: {}
  }
];

type Props = {
  peerAuthentication: PeerAuthenticationState;
  onChange: (peerAuthentication: PeerAuthenticationState) => void;
};

export type PortMtls = {
  port: string;
  mtls: string;
};

export type PeerAuthenticationState = {
  workloadSelector: string;
  mtls: string;
  portLevelMtls: PortMtls[];
  addWorkloadSelector: boolean;
  workloadSelectorValid: boolean;
  addPortMtls: boolean;
  addNewPortMtls: PortMtls;
};

export const PEER_AUTHENTICATION = 'PeerAuthentication';
export const PEER_AUTHENTICATIONS = 'peerauthentications';

export const initPeerAuthentication = (): PeerAuthenticationState => ({
  workloadSelector: '',
  mtls: PeerAuthenticationMutualTLSMode.UNSET,
  portLevelMtls: [],
  addWorkloadSelector: false,
  workloadSelectorValid: false,
  addPortMtls: false,
  addNewPortMtls: {
    port: '',
    mtls: PeerAuthenticationMutualTLSMode.UNSET
  }
});

export const isPeerAuthenticationStateValid = (pa: PeerAuthenticationState): boolean => {
  const workloadSelectorRule = pa.addWorkloadSelector ? pa.workloadSelectorValid : true;
  const validPortsMtlsRule = pa.addPortMtls ? pa.workloadSelectorValid && pa.portLevelMtls.length > 0 : true;
  return workloadSelectorRule && validPortsMtlsRule;
};

class PeerAuthenticationForm extends React.Component<Props, PeerAuthenticationState> {
  constructor(props: Props) {
    super(props);
    this.state = {
      addWorkloadSelector: false,
      workloadSelectorValid: false,
      workloadSelector: this.props.peerAuthentication.workloadSelector,
      mtls: this.props.peerAuthentication.mtls,
      addPortMtls: false,
      portLevelMtls: this.props.peerAuthentication.portLevelMtls,
      addNewPortMtls: {
        port: '',
        mtls: PeerAuthenticationMutualTLSMode.UNSET
      }
    };
  }

  componentDidMount() {
    this.setState({
      addWorkloadSelector: this.props.peerAuthentication.addWorkloadSelector,
      workloadSelectorValid: this.props.peerAuthentication.workloadSelectorValid,
      workloadSelector: this.props.peerAuthentication.workloadSelector,
      mtls: this.props.peerAuthentication.mtls,
      addPortMtls: this.props.peerAuthentication.addPortMtls,
      portLevelMtls: this.props.peerAuthentication.portLevelMtls,
      addNewPortMtls: this.props.peerAuthentication.addNewPortMtls
    });
  }

  onChangeWorkloadSelector = () => {
    this.setState(
      prevState => {
        return {
          addWorkloadSelector: !prevState.addWorkloadSelector
        };
      },
      () => this.onPeerAuthenticationChange()
    );
  };

  onChangeAddPortMtls = () => {
    this.setState(
      prevState => {
        return {
          addPortMtls: !prevState.addPortMtls
        };
      },
      () => this.onPeerAuthenticationChange()
    );
  };

  addWorkloadLabels = (value: string, _) => {
    if (value.length === 0) {
      this.setState(
        {
          workloadSelectorValid: false,
          workloadSelector: ''
        },
        () => this.onPeerAuthenticationChange()
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
        workloadSelector: value
      },
      () => this.onPeerAuthenticationChange()
    );
  };

  onPeerAuthenticationChange = () => {
    this.props.onChange(this.state);
  };

  onMutualTlsChange = (value, _) => {
    this.setState(
      {
        mtls: value
      },
      () => this.onPeerAuthenticationChange()
    );
  };

  onAddPortNumber = (value: string, _) => {
    this.setState(
      prevState => {
        return {
          addNewPortMtls: {
            port: value.trim(),
            mtls: prevState.addNewPortMtls.mtls
          }
        };
      },
      () => this.onPeerAuthenticationChange()
    );
  };

  onAddPortMtlsMode = (value: string, _) => {
    this.setState(
      prevState => {
        return {
          addNewPortMtls: {
            port: prevState.addNewPortMtls.port,
            mtls: value
          }
        };
      },
      () => this.onPeerAuthenticationChange()
    );
  };

  onAddPortMtls = () => {
    this.setState(
      prevState => {
        prevState.portLevelMtls.push(prevState.addNewPortMtls);
        return {
          portLevelMtls: prevState.portLevelMtls,
          addNewPortMtls: {
            port: '',
            mtls: PeerAuthenticationMutualTLSMode.UNSET
          }
        };
      },
      () => this.onPeerAuthenticationChange()
    );
  };

  // @ts-ignore
  actionResolver = (rowData, { rowIndex }) => {
    const removeAction = {
      title: 'Remove Port MTLS',
      // @ts-ignore
      onClick: (event, rowIndex, rowData, extraData) => {
        this.setState(
          prevState => {
            prevState.portLevelMtls.splice(rowIndex, 1);
            return {
              portLevelMtls: prevState.portLevelMtls
            };
          },
          () => this.onPeerAuthenticationChange()
        );
      }
    };
    if (rowIndex < this.props.peerAuthentication.portLevelMtls.length) {
      return [removeAction];
    }
    return [];
  };

  rows() {
    return this.props.peerAuthentication.portLevelMtls
      .map((pmtls, i) => ({
        key: 'portMtls' + i,
        cells: [<>{pmtls.port}</>, <>{pmtls.mtls}</>, '']
      }))
      .concat([
        {
          key: 'pmtlsNew',
          cells: [
            <>
              <TextInput
                value={this.state.addNewPortMtls.port}
                id="addPortNumber"
                aria-describedby="add port number"
                name="addPortNumber"
                onChange={this.onAddPortNumber}
                validated={isValid(
                  this.state.addNewPortMtls.port.length > 0 && !isNaN(Number(this.state.addNewPortMtls.port))
                )}
              />
            </>,
            <>
              <FormSelect
                value={this.state.addNewPortMtls.mtls}
                id="addPortMtlsMode"
                name="addPortMtlsMode"
                onChange={this.onAddPortMtlsMode}
              >
                {Object.keys(PeerAuthenticationMutualTLSMode).map((option, index) => (
                  <FormSelectOption key={'p' + index} value={option} label={option} />
                ))}
              </FormSelect>
            </>,
            <>
              <Button
                id="addServerBtn"
                variant={ButtonVariant.link}
                icon={<PlusCircleIcon />}
                isDisabled={
                  this.state.addNewPortMtls.port.length === 0 || isNaN(Number(this.state.addNewPortMtls.port))
                }
                onClick={this.onAddPortMtls}
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
            onChange={this.onChangeWorkloadSelector}
          />
        </FormGroup>
        {this.state.addWorkloadSelector && (
          <FormGroup
            fieldId="workloadLabels"
            label="Labels"
            helperText="One or more labels to select a workload where the PeerAuthentication is applied."
            helperTextInvalid="Enter a label in the format <label>=<value>. Enter one or multiple labels separated by comma."
            validated={isValid(this.state.workloadSelectorValid)}
          >
            <TextInput
              id="gwHosts"
              name="gwHosts"
              isDisabled={!this.state.addWorkloadSelector}
              value={this.state.workloadSelector}
              onChange={this.addWorkloadLabels}
              validated={isValid(this.state.workloadSelectorValid)}
            />
          </FormGroup>
        )}
        <FormGroup label="Mutual TLS Mode" fieldId="mutualTls">
          <FormSelect value={this.state.mtls} onChange={this.onMutualTlsChange} id="mutualTls" name="rules-form">
            {Object.keys(PeerAuthenticationMutualTLSMode).map((option, index) => (
              <FormSelectOption key={index} value={option} label={option} />
            ))}
          </FormSelect>
        </FormGroup>
        <FormGroup label="Port Mutual TLS" fieldId="addPortMtls">
          <Switch
            id="addPortMtls"
            label={' '}
            labelOff={' '}
            isChecked={this.state.addPortMtls}
            onChange={this.onChangeAddPortMtls}
          />
        </FormGroup>
        {this.state.addPortMtls && (
          <FormGroup label="Port Level MTLS" fieldId="portMtlsList">
            <Table
              aria-label="Port Level MTLS"
              cells={headerCells}
              rows={this.rows()}
              // @ts-ignore
              actionResolver={this.actionResolver}
            >
              <TableHeader />
              <TableBody />
            </Table>
            {this.props.peerAuthentication.portLevelMtls.length === 0 && (
              <div className={noPortMtlsStyle}>PeerAuthentication has no Port Mutual TLS defined</div>
            )}
            {!this.state.addWorkloadSelector && (
              <div className={noPortMtlsStyle}>Port Mutual TLS requires a Workload Selector</div>
            )}
          </FormGroup>
        )}
      </>
    );
  }
}

export default PeerAuthenticationForm;
