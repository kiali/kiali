import * as React from 'react';
import { FormGroup, FormHelperText, HelperText, HelperTextItem, Switch, TextInput } from '@patternfly/react-core';
import { JWTRule } from '../../types/IstioObjects';
import { JwtRuleBuilder } from './RequestAuthorizationForm/JwtRuleBuilder';
import { JwtRuleList } from './RequestAuthorizationForm/JwtRuleList';
import { isValid } from 'utils/Common';

type Props = {
  onChange: (requestAuthentication: RequestAuthenticationState) => void;
  requestAuthentication: RequestAuthenticationState;
};

export type RequestAuthenticationState = {
  addJWTRules: boolean;
  addWorkloadSelector: boolean;
  jwtRules: JWTRule[];
  workloadSelector: string;
  workloadSelectorValid: boolean;
};

export const initRequestAuthentication = (): RequestAuthenticationState => ({
  addJWTRules: false,
  addWorkloadSelector: false,
  jwtRules: [],
  workloadSelectorValid: false,
  workloadSelector: ''
});

export const isRequestAuthenticationStateValid = (ra: RequestAuthenticationState): boolean => {
  const workloadSelectorRule = ra.addWorkloadSelector ? ra.workloadSelectorValid : true;
  const jwtRulesRule = ra.addJWTRules ? ra.jwtRules.length > 0 : true;
  // Not yet used
  return workloadSelectorRule && jwtRulesRule;
};

export class RequestAuthenticationForm extends React.Component<Props, RequestAuthenticationState> {
  constructor(props: Props) {
    super(props);
    this.state = initRequestAuthentication();
  }

  componentDidMount(): void {
    this.setState({
      workloadSelector: this.props.requestAuthentication.workloadSelector,
      jwtRules: this.props.requestAuthentication.jwtRules,
      addWorkloadSelector: this.props.requestAuthentication.addWorkloadSelector,
      workloadSelectorValid: this.props.requestAuthentication.workloadSelectorValid,
      addJWTRules: this.props.requestAuthentication.addJWTRules
    });
  }

  onRequestAuthenticationChange = (): void => {
    this.props.onChange(this.state);
  };

  onChangeWorkloadSelector = (_event: React.FormEvent, _value: boolean): void => {
    this.setState(
      prevState => {
        return {
          addWorkloadSelector: !prevState.addWorkloadSelector
        };
      },
      () => this.onRequestAuthenticationChange()
    );
  };

  onChangeJwtRules = (_event: React.FormEvent, _value: boolean): void => {
    this.setState(
      prevState => {
        return {
          addJWTRules: !prevState.addJWTRules
        };
      },
      () => this.onRequestAuthenticationChange()
    );
  };

  addWorkloadLabels = (_event: React.FormEvent, value: string): void => {
    if (value.length === 0) {
      this.setState(
        {
          workloadSelectorValid: false,
          workloadSelector: ''
        },
        () => this.onRequestAuthenticationChange()
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
      () => this.onRequestAuthenticationChange()
    );
  };

  onAddJwtRule = (jwtRule: JWTRule): void => {
    this.setState(
      prevState => {
        prevState.jwtRules.push(jwtRule);

        return {
          jwtRules: prevState.jwtRules
        };
      },
      () => this.onRequestAuthenticationChange()
    );
  };

  onRemoveJwtRule = (index: number): void => {
    this.setState(
      prevState => {
        prevState.jwtRules.splice(index, 1);

        return {
          jwtRules: prevState.jwtRules
        };
      },
      () => this.onRequestAuthenticationChange()
    );
  };

  render(): React.ReactNode {
    return (
      <>
        <FormGroup label="Workload Selector" fieldId="workloadSelectorSwitch">
          <Switch
            id="workloadSelectorSwitch"
            label=" "
            
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
                    ? 'One or more labels to select a workload where the RequestAuthentication is applied.'
                    : 'Enter a label in the format <label>=<value>. Enter one or multiple labels separated by comma.'}
                </HelperTextItem>
              </HelperText>
            </FormHelperText>
          </FormGroup>
        )}

        <FormGroup label="JWT Rules" fieldId="addJWTRules">
          <Switch
            id="addJWTRules"
            label=" "
            
            isChecked={this.state.addJWTRules}
            onChange={this.onChangeJwtRules}
          />
        </FormGroup>

        {this.state.addJWTRules && (
          <>
            <FormGroup label="JWT Rule Builder" fieldId="jwtRulesBuilder">
              <JwtRuleBuilder onAddJwtRule={this.onAddJwtRule} />
            </FormGroup>

            <FormGroup label="JWT Rules List" fieldId="jwtRulesList">
              <JwtRuleList jwtRules={this.state.jwtRules} onRemoveJwtRule={this.onRemoveJwtRule} />
            </FormGroup>
          </>
        )}
      </>
    );
  }
}
