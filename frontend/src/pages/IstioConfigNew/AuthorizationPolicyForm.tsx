import * as React from 'react';
import {
  FormGroup,
  FormHelperText,
  FormSelect,
  FormSelectOption,
  HelperText,
  HelperTextItem,
  Switch,
  TextInput
} from '@patternfly/react-core';
import { RuleBuilder, Rule } from './AuthorizationPolicyForm/RuleBuilder';
import { RuleList } from './AuthorizationPolicyForm/RuleList';
import { isValid } from 'utils/Common';

type Props = {
  authorizationPolicy: AuthorizationPolicyState;
  onChange: (authorizationPolicy: AuthorizationPolicyState) => void;
};

export type AuthorizationPolicyState = {
  action: string;
  addWorkloadSelector: boolean;
  // Used to identify DENY_ALL, ALLOW_ALL or RULES
  policy: string;
  rules: Rule[];
  workloadSelector: string;
  workloadSelectorValid: boolean;
};

export const AUTHORIZACION_POLICY = 'AuthorizationPolicy';
export const AUTHORIZATION_POLICIES = 'authorizationpolicies';
export const DENY_ALL = 'DENY_ALL';
export const ALLOW_ALL = 'ALLOW_ALL';
export const RULES = 'RULES';
export const ALLOW = 'ALLOW';
export const DENY = 'DENY';

const HELPER_TEXT = {
  ALLOW_ALL: 'Allows all requests to workloads in given namespace(s)',
  DENY_ALL: 'Denies all requests to workloads in given namespace(s)',
  RULES: 'Builds an Authorization Policy based on Rules'
};

const rulesFormValues = [DENY_ALL, ALLOW_ALL, RULES];
const actions = [ALLOW, DENY];

export const initAuthorizationPolicy = (): AuthorizationPolicyState => ({
  policy: DENY_ALL,
  workloadSelector: '',
  action: ALLOW,
  rules: [],
  addWorkloadSelector: false,
  workloadSelectorValid: false
});

export const isAuthorizationPolicyStateValid = (ap: AuthorizationPolicyState): boolean => {
  const workloadSelectorRule = ap.addWorkloadSelector ? ap.workloadSelectorValid : true;
  const denyRule = ap.action === DENY ? ap.rules.length > 0 : true;

  return workloadSelectorRule && denyRule;
};

export class AuthorizationPolicyForm extends React.Component<Props, AuthorizationPolicyState> {
  constructor(props: Props) {
    super(props);
    this.state = initAuthorizationPolicy();
  }

  componentDidMount() {
    this.setState({
      policy: this.props.authorizationPolicy.policy,
      workloadSelector: this.props.authorizationPolicy.workloadSelector,
      action: this.props.authorizationPolicy.action,
      rules: [],
      addWorkloadSelector: this.props.authorizationPolicy.addWorkloadSelector,
      workloadSelectorValid: this.props.authorizationPolicy.workloadSelectorValid
    });
  }

  onRulesFormChange = (_event: React.FormEvent, value: string): void => {
    this.setState(
      {
        policy: value
      },
      () => this.onAuthorizationChange()
    );
  };

  onChangeWorkloadSelector = (_event: React.FormEvent, _value: boolean): void => {
    this.setState(
      prevState => {
        return {
          addWorkloadSelector: !prevState.addWorkloadSelector
        };
      },
      () => this.onAuthorizationChange()
    );
  };

  addWorkloadLabels = (_event: React.FormEvent, value: string): void => {
    if (value.length === 0) {
      this.setState(
        {
          workloadSelectorValid: false,
          workloadSelector: ''
        },
        () => this.onAuthorizationChange()
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
      () => this.onAuthorizationChange()
    );
  };

  onActionChange = (_event: React.FormEvent, value: string): void => {
    this.setState(
      {
        action: value
      },
      () => this.onAuthorizationChange()
    );
  };

  onAddRule = (rule: Rule): void => {
    this.setState(
      prevState => {
        prevState.rules.push(rule);
        return {
          rules: prevState.rules
        };
      },
      () => this.onAuthorizationChange()
    );
  };

  onRemoveRule = (index: number): void => {
    this.setState(
      prevState => {
        prevState.rules.splice(index, 1);
        return {
          rules: prevState.rules
        };
      },
      () => this.onAuthorizationChange()
    );
  };

  onAuthorizationChange = () => {
    this.props.onChange(this.state);
  };

  render() {
    return (
      <>
        <FormGroup label="Policy" fieldId="rules-form">
          <FormSelect value={this.state.policy} onChange={this.onRulesFormChange} id="rules-form" name="rules-form">
            {rulesFormValues.map((option, index) => (
              <FormSelectOption key={index} value={option} label={option} />
            ))}
          </FormSelect>
          <FormHelperText>
            <HelperText>
              <HelperTextItem>{HELPER_TEXT[this.state.policy]}</HelperTextItem>
            </HelperText>
          </FormHelperText>
        </FormGroup>

        {this.state.policy === RULES && (
          <FormGroup label="Workload Selector" fieldId="workloadSelectorSwitch">
            <Switch
              id="workloadSelectorSwitch"
              label=" "
              labelOff=" "
              isChecked={this.state.addWorkloadSelector}
              onChange={this.onChangeWorkloadSelector}
            />
          </FormGroup>
        )}

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
                    ? 'One or more labels to select a workload where the AuthorizationPolicy is applied.'
                    : 'Enter a label in the format <label>=<value>. Enter one or multiple labels separated by comma.'}
                </HelperTextItem>
              </HelperText>
            </FormHelperText>
          </FormGroup>
        )}

        {this.state.policy === RULES && (
          <FormGroup label="Action" fieldId="action-form">
            <FormSelect value={this.state.action} onChange={this.onActionChange} id="action-form" name="action-form">
              {actions.map((option, index) => (
                <FormSelectOption key={index} value={option} label={option} />
              ))}
            </FormSelect>
          </FormGroup>
        )}

        {this.state.policy === RULES && <RuleBuilder onAddRule={this.onAddRule} />}

        {this.state.policy === RULES && (
          <FormGroup label="Rule List" fieldId="apRuleList">
            <RuleList action={this.state.action} ruleList={this.state.rules} onRemoveRule={this.onRemoveRule} />
          </FormGroup>
        )}
      </>
    );
  }
}
