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
import { t, useKialiTranslation } from 'utils/I18nUtils';

export type AuthorizationPolicyState = {
  action: string;
  addWorkloadSelector: boolean;
  // Used to identify DENY_ALL, ALLOW_ALL or RULES
  policy: string;
  rules: Rule[];
  workloadSelector: string;
  workloadSelectorValid: boolean;
};

type Props = {
  authorizationPolicy: AuthorizationPolicyState;
  onChange: (authorizationPolicy: AuthorizationPolicyState) => void;
};

export const DENY_ALL = 'DENY_ALL';
export const ALLOW_ALL = 'ALLOW_ALL';
export const RULES = 'RULES';
export const ALLOW = 'ALLOW';
export const DENY = 'DENY';

const HELPER_TEXT = {
  ALLOW_ALL: t('Allows all requests to workloads in given namespace(s)'),
  DENY_ALL: t('Denies all requests to workloads in given namespace(s)'),
  RULES: t('Builds an Authorization Policy based on Rules')
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

export const AuthorizationPolicyForm: React.FC<Props> = (props: Props) => {
  const { t } = useKialiTranslation();

  const {
    action,
    addWorkloadSelector,
    policy,
    rules,
    workloadSelector,
    workloadSelectorValid
  } = props.authorizationPolicy;

  const onRulesFormChange = (_event: React.FormEvent, value: string): void => {
    onAuthorizationChange({ policy: value });
  };

  const onChangeWorkloadSelector = (_event: React.FormEvent, value: boolean): void => {
    onAuthorizationChange({ addWorkloadSelector: value });
  };

  const addWorkloadLabels = (_event: React.FormEvent, value: string): void => {
    if (value.length === 0) {
      onAuthorizationChange({ workloadSelector: '', workloadSelectorValid: false });

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

    onAuthorizationChange({ workloadSelector: value, workloadSelectorValid: isValid });
  };

  const onActionChange = (_event: React.FormEvent, value: string): void => {
    onAuthorizationChange({ action: value });
  };

  const onAddRule = (rule: Rule): void => {
    const newRules = [...rules];
    newRules.push(rule);

    onAuthorizationChange({ rules: newRules });
  };

  const onRemoveRule = (index: number): void => {
    const newRules = [...rules];
    newRules.splice(index, 1);

    onAuthorizationChange({ rules: newRules });
  };

  const onAuthorizationChange = (authorizationPolicy: Partial<AuthorizationPolicyState>): void => {
    props.onChange({ ...props.authorizationPolicy, ...authorizationPolicy });
  };

  return (
    <>
      <FormGroup label={t('Policy')} fieldId="rules-form">
        <FormSelect value={policy} onChange={onRulesFormChange} id="rules-form" name="rules-form">
          {rulesFormValues.map((option, index) => (
            <FormSelectOption key={index} value={option} label={option} />
          ))}
        </FormSelect>
        <FormHelperText>
          <HelperText>
            <HelperTextItem>{t(HELPER_TEXT[policy])}</HelperTextItem>
          </HelperText>
        </FormHelperText>
      </FormGroup>

      {policy === RULES && (
        <FormGroup label={t('Workload Selector')} fieldId="workloadSelectorSwitch">
          <Switch
            id="workloadSelectorSwitch"
            label=" "
            
            isChecked={addWorkloadSelector}
            onChange={onChangeWorkloadSelector}
          />
        </FormGroup>
      )}

      {addWorkloadSelector && (
        <FormGroup label={t('Labels')} fieldId="workloadLabels">
          <TextInput
            id="gwHosts"
            name="gwHosts"
            isDisabled={!addWorkloadSelector}
            value={workloadSelector}
            onChange={addWorkloadLabels}
            validated={isValid(workloadSelectorValid)}
          />

          <FormHelperText>
            <HelperText>
              <HelperTextItem>
                {isValid(workloadSelectorValid)
                  ? t('One or more labels to select a workload where the AuthorizationPolicy is applied.')
                  : t('Enter a label in the format <label>=<value>. Enter one or multiple labels separated by comma.')}
              </HelperTextItem>
            </HelperText>
          </FormHelperText>
        </FormGroup>
      )}

      {policy === RULES && (
        <FormGroup label={t('Action')} fieldId="action-form">
          <FormSelect value={action} onChange={onActionChange} id="action-form" name="action-form">
            {actions.map((option, index) => (
              <FormSelectOption key={index} value={option} label={option} />
            ))}
          </FormSelect>
        </FormGroup>
      )}

      {policy === RULES && <RuleBuilder onAddRule={onAddRule} />}

      {policy === RULES && (
        <FormGroup label={t('Rule List')} fieldId="apRuleList">
          <RuleList action={action} ruleList={rules} onRemoveRule={onRemoveRule} />
        </FormGroup>
      )}
    </>
  );
};
