import * as React from 'react';
import { cellWidth, ICell, Table, TableBody, TableHeader } from '@patternfly/react-table';
// Use TextInputBase like workaround while PF4 team work in https://github.com/patternfly/patternfly-react/issues/4072
import { Button, TextInputBase as TextInput } from '@patternfly/react-core';
import { PlusCircleIcon } from '@patternfly/react-icons';
import { isValidRequestHeaderName } from '../../../../helpers/ValidationHelpers';
import { style } from 'typestyle';
import { PFColors } from '../../../../components/Pf/PfColors';
import { isValidIp } from '../../../../utils/IstioConfigUtils';
import { isValid } from 'utils/Common';

export type Condition = {
  key: string;
  values?: string[];
  notValues?: string[];
};

type Props = {
  onAddCondition: (condition: Condition) => void;
};

type State = {
  condition: Condition;
};

const headerCells: ICell[] = [
  {
    title: 'Condition Key',
    transforms: [cellWidth(30) as any],
    props: {}
  },
  {
    title: 'Values',
    transforms: [cellWidth(30) as any],
    props: {}
  },
  {
    title: 'Not Values',
    transforms: [cellWidth(30) as any],
    props: {}
  }
];

const noValidKeyStyle = style({
  color: PFColors.Red100
});

const conditionFixedKeys = [
  'source.ip',
  'source.namespace',
  'source.principal',
  'request.auth.principal',
  'request.auth.audiences',
  'request.auth.presenter',
  'destination.ip',
  'destination.port',
  'connection.sni'
];

class ConditionBuilder extends React.Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = {
      condition: {
        key: ''
      }
    };
  }

  onAddNewConditionKey = (key: string, _) => {
    this.setState(prevState => {
      prevState.condition.key = key;
      return {
        condition: prevState.condition
      };
    });
  };

  onAddNewValues = (value: string, _) => {
    this.setState(prevState => {
      prevState.condition.values = value.length === 0 ? [] : value.split(',');
      return {
        condition: prevState.condition
      };
    });
  };

  onAddNewNotValues = (notValues: string, _) => {
    this.setState(prevState => {
      prevState.condition.notValues = notValues.length === 0 ? [] : notValues.split(',');
      return {
        condition: prevState.condition
      };
    });
  };

  onAddConditionToList = () => {
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
    if (key === 'source.ip' || key === 'destination.ip') {
      // If some value is not an IP, then is not valid
      // @ts-ignore
      const valuesValid = values ? !values.some(value => !isValidIp(value)) : true;
      // @ts-ignore
      const notValuesValid = notValues ? !notValues.some(value => !isValidIp(value)) : true;
      return [true, valuesValid, notValuesValid, 'Not valid IP'];
    }
    return [true, true, true, ''];
  };

  rows = (validKey: boolean, validValues: boolean, validNotValues: boolean, validText: string) => {
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

  render() {
    const [validKey, validValues, validNotValues, validText] = this.isValidCondition();
    const validCondition = validKey && validValues && validNotValues;
    return (
      <>
        <Table
          aria-label="Condition Builder"
          cells={headerCells}
          rows={this.rows(validKey, validValues, validNotValues, validText)}
        >
          <TableHeader />
          <TableBody />
        </Table>
        <Button
          variant="link"
          icon={<PlusCircleIcon />}
          isDisabled={!validCondition}
          onClick={this.onAddConditionToList}
        >
          Add Condition to When List
        </Button>
      </>
    );
  }
}

export default ConditionBuilder;
