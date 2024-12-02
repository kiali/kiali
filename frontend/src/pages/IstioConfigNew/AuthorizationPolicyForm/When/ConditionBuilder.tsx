import * as React from 'react';
import { IRow, ThProps } from '@patternfly/react-table';
import { Button, ButtonVariant, TextInput } from '@patternfly/react-core';
import { isValidRequestHeaderName, isValidRequestAuthClaimName } from '../../../../helpers/ValidationHelpers';
import { kialiStyle } from 'styles/StyleUtils';
import { PFColors } from '../../../../components/Pf/PfColors';
import { isValidIp } from '../../../../utils/IstioConfigUtils';
import { isValid } from 'utils/Common';
import { SimpleTable } from 'components/Table/SimpleTable';
import { KialiIcon } from 'config/KialiIcon';
import { t, useKialiTranslation } from 'utils/I18nUtils';

export type Condition = {
  key: string;
  notValues?: string[];
  values?: string[];
};

type Props = {
  onAddCondition: (condition: Condition) => void;
};

const columns: ThProps[] = [
  {
    title: t('Condition Key'),
    width: 30
  },
  {
    title: t('Values'),
    width: 30
  },
  {
    title: t('Not Values'),
    width: 30
  }
];

const noValidKeyStyle = kialiStyle({
  color: PFColors.Red100
});

const conditionFixedKeys = [
  'source.ip',
  'remote.ip',
  'source.namespace',
  'source.principal',
  'request.auth.principal',
  'request.auth.audiences',
  'request.auth.presenter',
  'destination.ip',
  'destination.port',
  'connection.sni'
];

const conditionIpAddressKeys = ['source.ip', 'remote.ip', 'destination.ip'];

export const ConditionBuilder: React.FC<Props> = (props: Props) => {
  const [condition, setCondition] = React.useState<Condition>({ key: '' });

  const { t } = useKialiTranslation();

  const onAddNewConditionKey = (_event: React.FormEvent, key: string): void => {
    const newCondition = { ...condition };
    newCondition.key = key;

    setCondition(newCondition);
  };

  const onAddNewValues = (_event: React.FormEvent, value: string): void => {
    const newCondition = { ...condition };
    newCondition.values = value.length === 0 ? [] : value.split(',');

    setCondition(newCondition);
  };

  const onAddNewNotValues = (_event: React.FormEvent, notValues: string): void => {
    const newCondition = { ...condition };
    newCondition.notValues = notValues.length === 0 ? [] : notValues.split(',');

    setCondition(newCondition);
  };

  const onAddConditionToList = (): void => {
    const conditionItem = condition;

    setCondition({ key: '' });
    props.onAddCondition(conditionItem);
  };

  const isValidKey = (key: string): boolean => {
    if (key.length === 0) {
      return false;
    }

    if (conditionFixedKeys.includes(key)) {
      return true;
    }

    if (key.startsWith('request.headers')) {
      return isValidRequestHeaderName(key);
    }

    if (key.startsWith('experimental.envoy.filters.')) {
      return true;
    }

    if (key.startsWith('request.auth.claims[')) {
      return isValidRequestAuthClaimName(key);
    }

    return false;
  };

  // Helper to mark invalid any of the fields: key, values, notValues with helper text
  const isValidCondition = (): [boolean, boolean, boolean, string] => {
    const key = condition.key;
    const isValid = isValidKey(key);

    if (!isValid) {
      return [false, true, true, t('Condition Key not supported')];
    }

    const values = condition.values;
    const notValues = condition.notValues;

    if ((!values || values.length === 0) && (!notValues || notValues.length === 0)) {
      return [true, false, false, t('Values and NotValues cannot be empty')];
    }

    if (conditionIpAddressKeys.includes(key)) {
      // If some value is not an IP, then is not valid
      const valuesValid = values ? !values.some(value => !isValidIp(value)) : true;
      const notValuesValid = notValues ? !notValues.some(value => !isValidIp(value)) : true;
      return [true, valuesValid, notValuesValid, t('Not valid IP')];
    }

    return [true, true, true, ''];
  };

  const rows = (validKey: boolean, validValues: boolean, validNotValues: boolean, validText: string): IRow[] => {
    return [
      {
        key: 'conditionKeyNew',
        cells: [
          <>
            <TextInput
              value={condition.key}
              type="text"
              id="addNewConditionKey"
              key="addNewConditionKey"
              aria-describedby={t('Add new condition key')}
              name="addNewConditionKey"
              onChange={onAddNewConditionKey}
              validated={isValid(validKey)}
            />

            {!validKey && (
              <div key="hostsHelperText" className={noValidKeyStyle}>
                {validText}
              </div>
            )}
          </>,
          <>
            <TextInput
              value={condition.values ? condition.values.join(',') : ''}
              type="text"
              id="addNewValues"
              key="addNewValues"
              aria-describedby={t('Add new condition values')}
              name="addNewConditionValues"
              onChange={onAddNewValues}
            />

            {!validValues && (
              <div key="hostsHelperText" className={noValidKeyStyle}>
                {validText}
              </div>
            )}
          </>,
          <>
            <TextInput
              value={condition.notValues ? condition.notValues.join(',') : ''}
              type="text"
              id="addNewNotValues"
              key="addNewNotValues"
              aria-describedby={t('Add new condition not values')}
              name="addNewNotValues"
              onChange={onAddNewNotValues}
            />

            {!validNotValues && (
              <div key="hostsHelperText" className={noValidKeyStyle}>
                {validText}
              </div>
            )}
          </>
        ]
      }
    ];
  };

  const [validKey, validValues, validNotValues, validText] = isValidCondition();
  const validCondition = validKey && validValues && validNotValues;

  return (
    <>
      <SimpleTable
        label={t('Condition Builder')}
        columns={columns}
        rows={rows(validKey, validValues, validNotValues, validText)}
      />

      <Button
        variant={ButtonVariant.link}
        icon={<KialiIcon.AddMore />}
        isDisabled={!validCondition}
        onClick={onAddConditionToList}
      >
        {t('Add Condition to When List')}
      </Button>
    </>
  );
};
