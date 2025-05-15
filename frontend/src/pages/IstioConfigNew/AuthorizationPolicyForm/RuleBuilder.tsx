import * as React from 'react';
import { Button, ButtonVariant, FormGroup, Switch } from '@patternfly/react-core';
import { SourceBuilder } from './From/SourceBuilder';
import { SourceList } from './From/SourceList';
import { OperationBuilder } from './To/OperationBuilder';
import { OperationList } from './To/OperationList';
import { ConditionBuilder, Condition } from './When/ConditionBuilder';
import { ConditionList } from './When/ConditionList';
import { kialiStyle } from 'styles/StyleUtils';
import { PFColors } from '../../../components/Pf/PfColors';
import { KialiIcon } from 'config/KialiIcon';
import { useKialiTranslation } from 'utils/I18nUtils';

type Props = {
  onAddRule: (rule: Rule) => void;
};

export type Rule = {
  from: { [key: string]: string[] }[];
  to: { [key: string]: string[] }[];
  when: Condition[];
};

const warningStyle = kialiStyle({
  marginLeft: '1.5rem',
  color: PFColors.Red100,
  textAlign: 'center'
});

const addRuleStyle = kialiStyle({
  marginLeft: 0,
  paddingLeft: 0
});

export const RuleBuilder: React.FC<Props> = (props: Props) => {
  const [addFromSwitch, setAddFromSwitch] = React.useState<boolean>(false);
  const [addToSwitch, setAddToSwitch] = React.useState<boolean>(false);
  const [addWhenSwitch, setAddWhenSwitch] = React.useState<boolean>(false);
  const [conditionList, setConditionList] = React.useState<Condition[]>([]);
  const [fromList, setFromList] = React.useState<{ [key: string]: string[] }[]>([]);
  const [toList, setToList] = React.useState<{ [key: string]: string[] }[]>([]);

  const { t } = useKialiTranslation();

  const onAddFrom = (source: { [key: string]: string[] }): void => {
    const newFromList = [...fromList];
    newFromList.push(source);

    setFromList(newFromList);
  };

  const onRemoveFrom = (index: number): void => {
    const newFromList = [...fromList];
    newFromList.splice(index, 1);

    setFromList(newFromList);
  };

  const onAddTo = (operation: { [key: string]: string[] }): void => {
    const newToList = [...toList];
    newToList.push(operation);

    setToList(newToList);
  };

  const onRemoveTo = (index: number): void => {
    const newToList = [...toList];
    newToList.splice(index, 1);

    setToList(newToList);
  };

  const onAddCondition = (condition: Condition): void => {
    const newConditionList = [...conditionList];
    newConditionList.push(condition);

    setConditionList(newConditionList);
  };

  const onRemoveCondition = (index: number): void => {
    const newConditionList = [...conditionList];
    newConditionList.splice(index, 1);

    setConditionList(newConditionList);
  };

  const onAddRule = (): void => {
    const newRule: Rule = {
      from: [...fromList],
      to: [...toList],
      when: [...conditionList]
    };

    setAddFromSwitch(false);
    setAddToSwitch(false);
    setAddWhenSwitch(false);
    setFromList([]);
    setToList([]);
    setConditionList([]);

    props.onAddRule(newRule);
  };

  const canAddRule = (): boolean => {
    return fromList.length > 0 || toList.length > 0 || conditionList.length > 0;
  };

  return (
    <>
      <FormGroup label={t('From')} fieldId="addFromSwitch">
        <Switch
          id="addFromSwitch"
          label=" "
          
          isChecked={addFromSwitch}
          onChange={() => setAddFromSwitch(!addFromSwitch)}
        />
      </FormGroup>

      {addFromSwitch && (
        <>
          <FormGroup label={t('Source Builder')} fieldId="sourceBuilder">
            <SourceBuilder onAddFrom={onAddFrom} />
          </FormGroup>

          <FormGroup label={t('From List')} fieldId="sourceList">
            <SourceList fromList={fromList} onRemoveFrom={onRemoveFrom} />
          </FormGroup>
        </>
      )}

      <FormGroup label={t('To')} fieldId="addToSwitch">
        <Switch
          id="addToSwitch"
          label=" "
          
          isChecked={addToSwitch}
          onChange={() => setAddToSwitch(!addToSwitch)}
        />
      </FormGroup>

      {addToSwitch && (
        <>
          <FormGroup label={t('Operation Builder')} fieldId="operationBuilder">
            <OperationBuilder onAddTo={onAddTo} />
          </FormGroup>

          <FormGroup label={t('To List')} fieldId="operationList">
            <OperationList toList={toList} onRemoveTo={onRemoveTo} />
          </FormGroup>
        </>
      )}

      <FormGroup label={t('When')} fieldId="addWhenSwitch">
        <Switch
          id="addWhenSwitch"
          label=" "
          
          isChecked={addWhenSwitch}
          onChange={() => setAddWhenSwitch(!addWhenSwitch)}
        />
      </FormGroup>

      {addWhenSwitch && (
        <>
          <FormGroup label={t('Condition Builder')} fieldId="conditionBuilder">
            <ConditionBuilder onAddCondition={onAddCondition} />
          </FormGroup>

          <FormGroup label={t('When List')} fieldId="conditionList">
            <ConditionList conditionList={conditionList} onRemoveCondition={onRemoveCondition} />
          </FormGroup>
        </>
      )}

      <FormGroup fieldId="addRule">
        <Button
          variant={ButtonVariant.link}
          icon={<KialiIcon.AddMore />}
          onClick={onAddRule}
          isDisabled={!canAddRule()}
          className={addRuleStyle}
        >
          {t('Add Rule to Rule List')}
        </Button>

        {!canAddRule() && (
          <span className={warningStyle}>{t('A Rule needs at least an item in "From", "To" or "When" sections')}</span>
        )}
      </FormGroup>
    </>
  );
};
