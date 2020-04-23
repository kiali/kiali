import * as React from 'react';
import { cellWidth, ICell, Table, TableBody, TableHeader } from '@patternfly/react-table';
// Use TextInputBase like workaround while PF4 team work in https://github.com/patternfly/patternfly-react/issues/4072
import { Button, TextInputBase as TextInput } from '@patternfly/react-core';
import { PlusCircleIcon } from '@patternfly/react-icons';

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
      prevState.condition.values = value.split(',');
      return {
        condition: prevState.condition
      };
    });
  };

  onAddNewNotValues = (notValues: string, _) => {
    this.setState(prevState => {
      prevState.condition.notValues = notValues.split(',');
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

  rows = () => {
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
            />
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
          </>
        ]
      }
    ];
  };

  render() {
    return (
      <>
        <Table aria-label="Condition Builder" cells={headerCells} rows={this.rows()}>
          <TableHeader />
          <TableBody />
        </Table>
        <Button
          variant="link"
          icon={<PlusCircleIcon />}
          isDisabled={this.state.condition.key.length === 0}
          onClick={this.onAddConditionToList}
        >
          Add Condition to When List
        </Button>
      </>
    );
  }
}

export default ConditionBuilder;
