import * as React from 'react';
import { FormGroup, FormSelect, FormSelectOption, Switch, TextInputBase as TextInput } from '@patternfly/react-core';
import RuleBuilder, { Rule } from './AuthorizationPolicyForm/RuleBuilder';
import RuleList from './AuthorizationPolicyForm/RuleList';

type Props = {
  authorizationPolicy: AuthorizationPolicyState;
  onChange: (authorizationPolicy: AuthorizationPolicyState) => void;
};

export type AuthorizationPolicyState = {
  policy: string;
  workloadSelector: string;
  action: string;
  rules: Rule[];
  // Used to identify DENY_ALL, ALLOW_ALL or RULES
  rulesForm: string;
  addWorkloadSelector: boolean;
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
  DENY_ALL: 'Denies all requests to workloads in given namespace(s)',
  ALLOW_ALL: 'Allows all requests to workloads in given namespace(s)',
  RULES: 'Builds an Authorization Policy based on Rules'
};

const rulesFormValues = [DENY_ALL, ALLOW_ALL, RULES];
const actions = [ALLOW, DENY];

export const initAuthorizationPolicy = (): AuthorizationPolicyState => ({
  policy: DENY,
  workloadSelector: '',
  action: ALLOW,
  rules: [],
  rulesForm: DENY_ALL,
  addWorkloadSelector: false,
  workloadSelectorValid: false
});

export const isAuthorizationPolicyStateValid = (ap: AuthorizationPolicyState): boolean => {
  const workloadSelectorRule = ap.addWorkloadSelector ? ap.workloadSelectorValid : true;
  const denyRule = ap.action === DENY ? ap.rules.length > 0 : true;

  return workloadSelectorRule && denyRule;
};

class AuthorizationPolicyForm extends React.Component<Props, AuthorizationPolicyState> {
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
      rulesForm: this.props.authorizationPolicy.rulesForm,
      addWorkloadSelector: this.props.authorizationPolicy.addWorkloadSelector,
      workloadSelectorValid: this.props.authorizationPolicy.workloadSelectorValid
    });
  }

  onRulesFormChange = (value, _) => {
    this.setState(
      {
        rulesForm: value
      },
      () => this.onAuthorizationChange()
    );
  };

  onChangeWorkloadSelector = () => {
    this.setState(
      prevState => {
        return {
          addWorkloadSelector: !prevState.addWorkloadSelector
        };
      },
      () => this.onAuthorizationChange()
    );
  };

  addWorkloadLabels = (value: string, _) => {
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

  onActionChange = (value, _) => {
    this.setState(
      {
        action: value
      },
      () => this.onAuthorizationChange()
    );
  };

  onAddRule = (rule: Rule) => {
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

  onRemoveRule = (index: number) => {
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
        <FormGroup label="Policy" fieldId="rules-form" helperText={HELPER_TEXT[this.state.rulesForm]}>
          <FormSelect value={this.state.rulesForm} onChange={this.onRulesFormChange} id="rules-form" name="rules-form">
            {rulesFormValues.map((option, index) => (
              <FormSelectOption key={index} value={option} label={option} />
            ))}
          </FormSelect>
        </FormGroup>
        {this.state.rulesForm === RULES && (
          <FormGroup label="Add Workload Selector" fieldId="workloadSelectorSwitch">
            <Switch
              id="workloadSelectorSwitch"
              label={' '}
              labelOff={' '}
              isChecked={this.state.addWorkloadSelector}
              onChange={this.onChangeWorkloadSelector}
            />
          </FormGroup>
        )}
        {this.state.addWorkloadSelector && (
          <FormGroup
            fieldId="workloadLabels"
            label="Labels"
            helperText="One or more labels to select a workload where AuthorizationPolicy is applied. Enter a label in the format <label>=<value>. Enter one or multiple labels separated by comma."
            helperTextInvalid="Invalid labels format: One or more labels to select a workload where AuthorizationPolicy is applied. Enter a label in the format <label>=<value>. Enter one or multiple labels separated by comma."
            isValid={this.state.workloadSelectorValid}
          >
            <TextInput
              id="gwHosts"
              name="gwHosts"
              isDisabled={!this.state.addWorkloadSelector}
              value={this.state.workloadSelector}
              onChange={this.addWorkloadLabels}
              isValid={this.state.workloadSelectorValid}
            />
          </FormGroup>
        )}
        {this.state.rulesForm === RULES && (
          <FormGroup label="Action" fieldId="action-form">
            <FormSelect value={this.state.action} onChange={this.onActionChange} id="action-form" name="action-form">
              {actions.map((option, index) => (
                <FormSelectOption key={index} value={option} label={option} />
              ))}
            </FormSelect>
          </FormGroup>
        )}
        {this.state.rulesForm === RULES && <RuleBuilder onAddRule={this.onAddRule} />}
        {this.state.rulesForm === RULES && (
          <RuleList action={this.state.action} ruleList={this.state.rules} onRemoveRule={this.onRemoveRule} />
        )}
      </>
    );
  }
}

export default AuthorizationPolicyForm;
