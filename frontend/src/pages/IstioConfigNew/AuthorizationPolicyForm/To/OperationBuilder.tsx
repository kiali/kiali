import * as React from 'react';
import { cellWidth, ICell, Table, TableBody, TableHeader } from '@patternfly/react-table';
// Use TextInputBase like workaround while PF4 team work in https://github.com/patternfly/patternfly-react/issues/4072
import {
  Button,
  ButtonVariant,
  FormSelect,
  FormSelectOption,
  TextInputBase as TextInput
} from '@patternfly/react-core';
import { PlusCircleIcon } from '@patternfly/react-icons';

type Props = {
  onAddTo: (operation: { [key: string]: string[] }) => void;
};

type State = {
  operationFields: string[];
  operation: {
    [key: string]: string[];
  };
  newOperationField: string;
  newValues: string;
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

const headerCells: ICell[] = [
  {
    title: 'Operation Field',
    transforms: [cellWidth(20) as any],
    props: {}
  },
  {
    title: 'Values',
    transforms: [cellWidth(80) as any],
    props: {}
  },
  {
    title: '',
    props: {}
  }
];

class OperationBuilder extends React.Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = {
      operationFields: Object.assign([], INIT_OPERATION_FIELDS),
      operation: {},
      newOperationField: INIT_OPERATION_FIELDS[0],
      newValues: ''
    };
  }

  onAddNewOperationField = (value: string, _) => {
    this.setState({
      newOperationField: value
    });
  };

  onAddNewValues = (value: string, _) => {
    this.setState({
      newValues: value
    });
  };

  onAddOperation = () => {
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

  onAddOperationToList = () => {
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

  // @ts-ignore
  actionResolver = (rowData, { rowIndex }) => {
    const removeAction = {
      title: 'Remove Field',
      // @ts-ignore
      onClick: (event, rowIndex, rowData, extraData) => {
        // Fetch sourceField from rowData, it's a fixed string on children
        const removeOperationField = rowData.cells[0].props.children.toString();
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
      }
    };
    if (rowIndex < Object.keys(this.state.operation).length) {
      return [removeAction];
    }
    return [];
  };

  rows = () => {
    const operatorRows = Object.keys(this.state.operation).map((operationField, i) => {
      return {
        key: 'operationKey' + i,
        cells: [<>{operationField}</>, <>{this.state.operation[operationField].join(',')}</>, <></>]
      };
    });
    if (this.state.operationFields.length > 0) {
      return operatorRows.concat([
        {
          key: 'operationKeyNew',
          cells: [
            <>
              <FormSelect
                value={this.state.newOperationField}
                id="addNewOperationField"
                name="addNewOperationField"
                onChange={this.onAddNewOperationField}
              >
                {this.state.operationFields.map((option, index) => (
                  <FormSelectOption isDisabled={false} key={'operation' + index} value={option} label={option} />
                ))}
              </FormSelect>
            </>,
            <>
              <TextInput
                value={this.state.newValues}
                type="text"
                id="addNewValues"
                key="addNewValues"
                aria-describedby="add new operation values"
                name="addNewValues"
                onChange={this.onAddNewValues}
              />
            </>,
            <>
              {this.state.operationFields.length > 0 && (
                <Button variant={ButtonVariant.link} icon={<PlusCircleIcon />} onClick={this.onAddOperation} />
              )}
            </>
          ]
        }
      ]);
    }
    return operatorRows;
  };

  render() {
    return (
      <>
        <Table
          aria-label="Operation Builder"
          cells={headerCells}
          rows={this.rows()}
          // @ts-ignore
          actionResolver={this.actionResolver}
        >
          <TableHeader />
          <TableBody />
        </Table>
        <Button
          variant={ButtonVariant.link}
          icon={<PlusCircleIcon />}
          isDisabled={Object.keys(this.state.operation).length === 0}
          onClick={this.onAddOperationToList}
        >
          Add Operation to To List
        </Button>
      </>
    );
  }
}

export default OperationBuilder;
