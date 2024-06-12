import * as React from 'react';
import { IRow, ThProps } from '@patternfly/react-table';
import { Button, ButtonVariant, FormSelect, FormSelectOption, TextInput } from '@patternfly/react-core';
import { SimpleTable } from 'components/Table/SimpleTable';
import { KialiIcon } from 'config/KialiIcon';

type Props = {
  onAddTo: (operation: { [key: string]: string[] }) => void;
};

type State = {
  newOperationField: string;
  newValues: string;
  operation: {
    [key: string]: string[];
  };
  operationFields: string[];
};

const INIT_OPERATION_FIELDS = [
  'hosts',
  'notHosts',
  'ports',
  'notPorts',
  'methods',
  'notMethods',
  'paths',
  'notPaths'
].sort();

const columns: ThProps[] = [
  {
    title: 'Operation Field',
    width: 20
  },
  {
    title: 'Values',
    width: 80
  },
  {
    title: ''
  }
];

export class OperationBuilder extends React.Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = {
      operationFields: Object.assign([], INIT_OPERATION_FIELDS),
      operation: {},
      newOperationField: INIT_OPERATION_FIELDS[0],
      newValues: ''
    };
  }

  onAddNewOperationField = (_event: React.FormEvent, value: string): void => {
    this.setState({
      newOperationField: value
    });
  };

  onAddNewValues = (_event: React.FormEvent, value: string): void => {
    this.setState({
      newValues: value
    });
  };

  onAddOperation = (): void => {
    this.setState(prevState => {
      const i = prevState.operationFields.indexOf(prevState.newOperationField);

      if (i > -1) {
        prevState.operationFields.splice(i, 1);
      }

      prevState.operation[prevState.newOperationField] = prevState.newValues.split(',');

      return {
        operationFields: prevState.operationFields,
        operation: prevState.operation,
        newOperationField: prevState.operationFields[0],
        newValues: ''
      };
    });
  };

  onAddOperationToList = (): void => {
    const toItem = this.state.operation;

    this.setState(
      {
        operationFields: Object.assign([], INIT_OPERATION_FIELDS),
        operation: {},
        newOperationField: INIT_OPERATION_FIELDS[0],
        newValues: ''
      },
      () => {
        this.props.onAddTo(toItem);
      }
    );
  };

  onRemoveOperation = (removeOperationField: string): void => {
    this.setState(prevState => {
      prevState.operationFields.push(removeOperationField);
      delete prevState.operation[removeOperationField];
      const newOperationFields = prevState.operationFields.sort();

      return {
        operationFields: newOperationFields,
        operation: prevState.operation,
        newOperationField: newOperationFields[0],
        newValues: ''
      };
    });
  };

  rows = (): IRow[] => {
    const operatorRows = Object.keys(this.state.operation).map((operationField, i) => {
      return {
        key: `operationKey_${i}`,
        cells: [
          <>{operationField}</>,
          <>{this.state.operation[operationField].join(',')}</>,
          <Button
            id="removeSourceBtn"
            variant={ButtonVariant.link}
            icon={<KialiIcon.Delete />}
            onClick={() => this.onRemoveOperation(operationField)}
          />
        ]
      };
    });

    if (this.state.operationFields.length > 0) {
      return operatorRows.concat([
        {
          key: 'operationKeyNew',
          cells: [
            <FormSelect
              value={this.state.newOperationField}
              id="addNewOperationField"
              name="addNewOperationField"
              onChange={this.onAddNewOperationField}
            >
              {this.state.operationFields.map((option, index) => (
                <FormSelectOption isDisabled={false} key={`operation_${index}`} value={option} label={option} />
              ))}
            </FormSelect>,

            <TextInput
              value={this.state.newValues}
              type="text"
              id="addNewValues"
              key="addNewValues"
              aria-describedby="add new operation values"
              name="addNewValues"
              onChange={this.onAddNewValues}
            />,
            <>
              {this.state.operationFields.length > 0 && (
                <Button variant={ButtonVariant.link} icon={<KialiIcon.AddMore />} onClick={this.onAddOperation} />
              )}
            </>
          ]
        }
      ]);
    }
    return operatorRows;
  };

  render(): React.ReactNode {
    return (
      <>
        <SimpleTable label="Operation Builder" columns={columns} rows={this.rows()} />

        <Button
          variant={ButtonVariant.link}
          icon={<KialiIcon.AddMore />}
          isDisabled={Object.keys(this.state.operation).length === 0}
          onClick={this.onAddOperationToList}
        >
          Add Operation to To List
        </Button>
      </>
    );
  }
}
