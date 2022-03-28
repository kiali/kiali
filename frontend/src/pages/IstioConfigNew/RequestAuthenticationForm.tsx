import * as React from 'react';
import { FormGroup, Switch } from '@patternfly/react-core';
import { TextInputBase as TextInput } from '@patternfly/react-core/dist/js/components/TextInput/TextInput';
import { JWTRule } from '../../types/IstioObjects';
import JwtRuleBuilder from './RequestAuthorizationForm/JwtRuleBuilder';
import JwtRuleList from './RequestAuthorizationForm/JwtRuleList';
import { isValid } from 'utils/Common';

type Props = {
  requestAuthentication: RequestAuthenticationState;
  onChange: (requestAuthentication: RequestAuthenticationState) => void;
};

export type RequestAuthenticationState = {
  workloadSelector: string;
  jwtRules: JWTRule[];
  addWorkloadSelector: boolean;
  workloadSelectorValid: boolean;
  addJWTRules: boolean;
};

export const REQUEST_AUTHENTICATION = 'RequestAuthentication';
export const REQUEST_AUTHENTICATIONS = 'requestauthentications';

export const initRequestAuthentication = (): RequestAuthenticationState => ({
  workloadSelector: '',
  jwtRules: [],
  addWorkloadSelector: false,
  workloadSelectorValid: false,
  addJWTRules: false
});

export const isRequestAuthenticationStateValid = (ra: RequestAuthenticationState): boolean => {
  const workloadSelectorRule = ra.addWorkloadSelector ? ra.workloadSelectorValid : true;
  const jwtRulesRule = ra.addJWTRules ? ra.jwtRules.length > 0 : true;
  // Not yet used
  return workloadSelectorRule && jwtRulesRule;
};

class RequestAuthenticationForm extends React.Component<Props, RequestAuthenticationState> {
  constructor(props: Props) {
    super(props);
    this.state = initRequestAuthentication();
  }

  componentDidMount() {
    this.setState({
      workloadSelector: this.props.requestAuthentication.workloadSelector,
      jwtRules: this.props.requestAuthentication.jwtRules,
      addWorkloadSelector: this.props.requestAuthentication.addWorkloadSelector,
      workloadSelectorValid: this.props.requestAuthentication.workloadSelectorValid,
      addJWTRules: this.props.requestAuthentication.addJWTRules
    });
  }

  onRequestAuthenticationChange = () => {
    this.props.onChange(this.state);
  };

  onChangeWorkloadSelector = () => {
    this.setState(
      prevState => {
        return {
          addWorkloadSelector: !prevState.addWorkloadSelector
        };
      },
      () => this.onRequestAuthenticationChange()
    );
  };

  onChangeJwtRules = () => {
    this.setState(
      prevState => {
        return {
          addJWTRules: !prevState.addJWTRules
        };
      },
      () => this.onRequestAuthenticationChange()
    );
  };

  addWorkloadLabels = (value: string, _) => {
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

  onAddJwtRule = (jwtRule: JWTRule) => {
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

  onRemoveJwtRule = (index: number) => {
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
            helperText="One or more labels to select a workload where the RequestAuthentication is applied."
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
        <FormGroup label="JWT Rules" fieldId="addJWTRules">
          <Switch
            id="addJWTRules"
            label={' '}
            labelOff={' '}
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

export default RequestAuthenticationForm;
