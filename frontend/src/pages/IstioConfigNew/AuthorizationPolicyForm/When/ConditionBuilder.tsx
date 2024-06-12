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

export type Condition = {
  key: string;
  notValues?: string[];
  values?: string[];
};

type Props = {
  onAddCondition: (condition: Condition) => void;
};

type State = {
  condition: Condition;
};

const columns: ThProps[] = [
  {
    title: 'Condition Key',
    width: 30
  },
  {
    title: 'Values',
    width: 30
  },
  {
    title: 'Not Values',
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

export class ConditionBuilder extends React.Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = {
      condition: {
        key: ''
      }
    };
  }

  onAddNewConditionKey = (_event: React.FormEvent, key: string): void => {
    this.setState(prevState => {
      prevState.condition.key = key;
      return {
        condition: prevState.condition
      };
    });
  };

  onAddNewValues = (_event: React.FormEvent, value: string): void => {
    this.setState(prevState => {
      prevState.condition.values = value.length === 0 ? [] : value.split(',');
      return {
        condition: prevState.condition
      };
    });
  };

  onAddNewNotValues = (_event: React.FormEvent, notValues: string): void => {
    this.setState(prevState => {
      prevState.condition.notValues = notValues.length === 0 ? [] : notValues.split(',');
      return {
        condition: prevState.condition
      };
    });
  };

  onAddConditionToList = (): void => {
    const conditionItem = this.state.condition;
    this.setState(
      {
        condition: {
          key: ''
        }
      },
      () => {
        this.props.onAddCondition(conditionItem);
      }
    );
  };

  isValidKey = (key: string): boolean => {
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
  isValidCondition = (): [boolean, boolean, boolean, string] => {
    const key = this.state.condition.key;
    const isValidKey = this.isValidKey(key);

    if (!isValidKey) {
      return [false, true, true, 'Condition Key not supported'];
    }

    const values = this.state.condition.values;
    const notValues = this.state.condition.notValues;

    if ((!values || values.length === 0) && (!notValues || notValues.length === 0)) {
      return [true, false, false, 'Values and NotValues cannot be empty'];
    }

    if (conditionIpAddressKeys.includes(key)) {
      // If some value is not an IP, then is not valid
      const valuesValid = values ? !values.some(value => !isValidIp(value)) : true;
      const notValuesValid = notValues ? !notValues.some(value => !isValidIp(value)) : true;
      return [true, valuesValid, notValuesValid, 'Not valid IP'];
    }

    return [true, true, true, ''];
  };

  rows = (validKey: boolean, validValues: boolean, validNotValues: boolean, validText: string): IRow[] => {
    return [
      {
        key: 'conditionKeyNew',
        cells: [
          <>
            <TextInput
              value={this.state.condition.key}
              type="text"
              id="addNewConditionKey"
              key="addNewConditionKey"
              aria-describedby="add new condition key"
              name="addNewConditionKey"
              onChange={this.onAddNewConditionKey}
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
              value={this.state.condition.values ? this.state.condition.values.join(',') : ''}
              type="text"
              id="addNewValues"
              key="addNewValues"
              aria-describedby="add new condition values"
              name="addNewConditionValues"
              onChange={this.onAddNewValues}
            />

            {!validValues && (
              <div key="hostsHelperText" className={noValidKeyStyle}>
                {validText}
              </div>
            )}
          </>,
          <>
            <TextInput
              value={this.state.condition.notValues ? this.state.condition.notValues.join(',') : ''}
              type="text"
              id="addNewNotValues"
              key="addNewNotValues"
              aria-describedby="add new condition not values"
              name="addNewNotValues"
              onChange={this.onAddNewNotValues}
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

  render(): React.ReactNode {
    const [validKey, validValues, validNotValues, validText] = this.isValidCondition();
    const validCondition = validKey && validValues && validNotValues;

    return (
      <>
        <SimpleTable
          label="Condition Builder"
          columns={columns}
          rows={this.rows(validKey, validValues, validNotValues, validText)}
        />

        <Button
          variant={ButtonVariant.link}
          icon={<KialiIcon.AddMore />}
          isDisabled={!validCondition}
          onClick={this.onAddConditionToList}
        >
          Add Condition to When List
        </Button>
      </>
    );
  }
}
