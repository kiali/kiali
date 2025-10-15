import * as React from 'react';
import {
  Button,
  ButtonVariant,
  FormGroup,
  FormHelperText,
  HelperText,
  HelperTextItem,
  MenuToggle,
  MenuToggleElement,
  Select,
  SelectList,
  SelectOption,
  Switch,
  TextInput
} from '@patternfly/react-core';
import { PeerAuthenticationMutualTLSMode } from '../../types/IstioObjects';
import { IRow, ThProps } from '@patternfly/react-table';
import { kialiStyle } from 'styles/StyleUtils';
import { PFColors } from '../../components/Pf/PfColors';
import { isValid } from 'utils/Common';
import { KialiIcon } from 'config/KialiIcon';
import { SimpleTable } from 'components/Table/SimpleTable';

const noPortMtlsStyle = kialiStyle({
  marginTop: '1rem',
  color: PFColors.Red100
});

const columns: ThProps[] = [
  {
    title: 'Port Number',
    width: 20
  },
  {
    title: 'Mutual TLS Mode',
    width: 20
  },
  {
    title: ''
  }
];

type Props = {
  onChange: (peerAuthentication: PeerAuthenticationState) => void;
  peerAuthentication: PeerAuthenticationState;
};

export type PortMtls = {
  mtls: string;
  port: string;
};

export type PeerAuthenticationState = {
  addNewPortMtls: PortMtls;
  addPortMtls: boolean;
  addWorkloadSelector: boolean;
  isMtlsSelectOpen: boolean;
  isPortMtlsSelectOpen: boolean;
  mtls: string;
  portLevelMtls: PortMtls[];
  workloadSelector: string;
  workloadSelectorValid: boolean;
};

export const initPeerAuthentication = (): PeerAuthenticationState => ({
  addNewPortMtls: {
    port: '',
    mtls: PeerAuthenticationMutualTLSMode.UNSET
  },
  addPortMtls: false,
  addWorkloadSelector: false,
  isMtlsSelectOpen: false,
  isPortMtlsSelectOpen: false,
  mtls: PeerAuthenticationMutualTLSMode.UNSET,
  portLevelMtls: [],
  workloadSelector: '',
  workloadSelectorValid: false
});

export const isPeerAuthenticationStateValid = (pa: PeerAuthenticationState): boolean => {
  const workloadSelectorRule = pa.addWorkloadSelector ? pa.workloadSelectorValid : true;
  const validPortsMtlsRule = pa.addPortMtls ? pa.workloadSelectorValid && pa.portLevelMtls.length > 0 : true;
  return workloadSelectorRule && validPortsMtlsRule;
};

export class PeerAuthenticationForm extends React.Component<Props, PeerAuthenticationState> {
  constructor(props: Props) {
    super(props);
    this.state = {
      addWorkloadSelector: false,
      isMtlsSelectOpen: false,
      isPortMtlsSelectOpen: false,
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

  componentDidMount(): void {
    this.setState({
      addWorkloadSelector: this.props.peerAuthentication.addWorkloadSelector,
      workloadSelectorValid: this.props.peerAuthentication.workloadSelectorValid,
      workloadSelector: this.props.peerAuthentication.workloadSelector,
      mtls: this.props.peerAuthentication.mtls,
      addPortMtls: this.props.peerAuthentication.addPortMtls,
      portLevelMtls: this.props.peerAuthentication.portLevelMtls,
      addNewPortMtls: this.props.peerAuthentication.addNewPortMtls,
      isMtlsSelectOpen: this.props.peerAuthentication.isMtlsSelectOpen,
      isPortMtlsSelectOpen: this.props.peerAuthentication.isPortMtlsSelectOpen
    });
  }

  onChangeWorkloadSelector = (_event: React.FormEvent, _: boolean): void => {
    this.setState(
      prevState => {
        return {
          addWorkloadSelector: !prevState.addWorkloadSelector
        };
      },
      () => this.onPeerAuthenticationChange()
    );
  };

  onChangeAddPortMtls = (_event: React.FormEvent, _: boolean): void => {
    this.setState(
      prevState => {
        return {
          addPortMtls: !prevState.addPortMtls
        };
      },
      () => this.onPeerAuthenticationChange()
    );
  };

  addWorkloadLabels = (_event: React.FormEvent, value: string): void => {
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

  onPeerAuthenticationChange = (): void => {
    this.props.onChange(this.state);
  };

  onAddPortNumber = (_event: React.FormEvent, value: string): void => {
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
  onAddPortMtls = (): void => {
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

  onRemovePortMtls = (rowIndex: number): void => {
    this.setState(
      prevState => {
        prevState.portLevelMtls.splice(rowIndex, 1);
        return {
          portLevelMtls: prevState.portLevelMtls
        };
      },
      () => this.onPeerAuthenticationChange()
    );
  };

  rows = (): IRow[] => {
    return this.props.peerAuthentication.portLevelMtls
      .map((pmtls, index) => ({
        key: `portMtls_${index}`,
        cells: [
          <>{pmtls.port}</>,
          <>{pmtls.mtls}</>,
          <Button
            id="removePortMtlsBtn"
            variant={ButtonVariant.link}
            icon={<KialiIcon.Delete />}
            onClick={() => this.onRemovePortMtls(index)}
          />
        ]
      }))
      .concat([
        {
          key: 'pmtlsNew',
          cells: [
            <TextInput
              value={this.state.addNewPortMtls.port}
              id="addPortNumber"
              aria-describedby="add port number"
              name="addPortNumber"
              onChange={this.onAddPortNumber}
              validated={isValid(
                this.state.addNewPortMtls.port.length > 0 && !isNaN(Number(this.state.addNewPortMtls.port))
              )}
            />,

            <Select
              isOpen={this.state.isPortMtlsSelectOpen}
              selected={this.state.addNewPortMtls.mtls}
              onSelect={(_event, value) => {
                this.setState(
                  prevState => ({
                    addNewPortMtls: {
                      port: prevState.addNewPortMtls.port,
                      mtls: value as string
                    },
                    isPortMtlsSelectOpen: false
                  }),
                  () => this.onPeerAuthenticationChange()
                );
              }}
              id="addPortMtlsMode"
              onOpenChange={isPortMtlsSelectOpen => this.setState({ isPortMtlsSelectOpen })}
              toggle={(toggleRef: React.Ref<MenuToggleElement>) => (
                <MenuToggle
                  id="addPortMtlsMode-toggle"
                  ref={toggleRef}
                  onClick={() => this.setState({ isPortMtlsSelectOpen: !this.state.isPortMtlsSelectOpen })}
                  isExpanded={this.state.isPortMtlsSelectOpen}
                  isFullWidth
                >
                  {this.state.addNewPortMtls.mtls}
                </MenuToggle>
              )}
              aria-label="Port MTLS Mode Select"
            >
              <SelectList>
                {Object.keys(PeerAuthenticationMutualTLSMode).map((option, index) => (
                  <SelectOption
                    key={`p_${index}`}
                    value={option}
                    isSelected={option === this.state.addNewPortMtls.mtls}
                  >
                    {option}
                  </SelectOption>
                ))}
              </SelectList>
            </Select>,

            <Button
              id="addPortMtlsBtn"
              variant={ButtonVariant.link}
              icon={<KialiIcon.AddMore />}
              isDisabled={this.state.addNewPortMtls.port.length === 0 || isNaN(Number(this.state.addNewPortMtls.port))}
              onClick={this.onAddPortMtls}
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
            
            isChecked={this.state.addWorkloadSelector}
            onChange={this.onChangeWorkloadSelector}
          />
        </FormGroup>

        {this.state.addWorkloadSelector && (
          <FormGroup fieldId="workloadLabels" label="Labels">
            <TextInput
              id="gwHosts"
              name="gwHosts"
              isDisabled={!this.state.addWorkloadSelector}
              value={this.state.workloadSelector}
              onChange={this.addWorkloadLabels}
              validated={isValid(this.state.workloadSelectorValid)}
            />

            <FormHelperText>
              <HelperText>
                <HelperTextItem>
                  {isValid(this.state.workloadSelectorValid)
                    ? 'One or more labels to select a workload where the PeerAuthentication is applied.'
                    : 'Enter a label in the format <label>=<value>. Enter one or multiple labels separated by comma.'}
                </HelperTextItem>
              </HelperText>
            </FormHelperText>
          </FormGroup>
        )}

        <FormGroup label="Mutual TLS Mode" fieldId="mutualTls">
          <Select
            id="mutualTls"
            selected={this.state.mtls}
            onSelect={(_event, value) => {
              this.setState(
                {
                  mtls: value as string,
                  isMtlsSelectOpen: false
                },
                () => this.onPeerAuthenticationChange()
              );
            }}
            onOpenChange={isMtlsSelectOpen => this.setState({ isMtlsSelectOpen })}
            toggle={(toggleRef: React.Ref<MenuToggleElement>) => (
              <MenuToggle
                id="mutualTls-toggle"
                ref={toggleRef}
                onClick={() => this.setState({ isMtlsSelectOpen: !this.state.isMtlsSelectOpen })}
                isExpanded={this.state.isMtlsSelectOpen}
                isFullWidth
              >
                {this.state.mtls}
              </MenuToggle>
            )}
            isOpen={this.state.isMtlsSelectOpen}
            aria-label="Mutual TLS Mode Select"
          >
            <SelectList>
              {Object.keys(PeerAuthenticationMutualTLSMode).map((option, index) => (
                <SelectOption key={index} value={option} isSelected={option === this.state.mtls}>
                  {option}
                </SelectOption>
              ))}
            </SelectList>
          </Select>
        </FormGroup>

        <FormGroup label="Port Mutual TLS" fieldId="addPortMtls">
          <Switch
            id="addPortMtls"
            label={' '}
            
            isChecked={this.state.addPortMtls}
            onChange={this.onChangeAddPortMtls}
          />
        </FormGroup>

        {this.state.addPortMtls && (
          <FormGroup label="Port Level MTLS" fieldId="portMtlsList">
            <SimpleTable label="Port Level MTLS" columns={columns} rows={this.rows()} />

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
