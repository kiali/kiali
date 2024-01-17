import * as React from 'react';
import { IRow, ThProps } from '@patternfly/react-table';
import { Button, ButtonVariant, FormSelect, FormSelectOption, TextInput } from '@patternfly/react-core';
import { isValidIp } from '../../../../utils/IstioConfigUtils';
import { kialiStyle } from 'styles/StyleUtils';
import { PFColors } from '../../../../components/Pf/PfColors';
import { isValid } from 'utils/Common';
import { SimpleTable } from 'components/SimpleTable';
import { KialiIcon } from 'config/KialiIcon';

type Props = {
  onAddFrom: (source: { [key: string]: string[] }) => void;
};

type State = {
  newSourceField: string;
  newValues: string;
  source: {
    [key: string]: string[];
  };
  sourceFields: string[];
};

const INIT_SOURCE_FIELDS = [
  'principals',
  'notPrincipals',
  'requestPrincipals',
  'notRequestPrincipals',
  'namespaces',
  'notNamespaces',
  'ipBlocks',
  'notIpBlocks'
].sort();

const noSourceStyle = kialiStyle({
  color: PFColors.Red100
});

const columns: ThProps[] = [
  {
    title: 'Source Field',
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

export class SourceBuilder extends React.Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = {
      sourceFields: Object.assign([], INIT_SOURCE_FIELDS),
      source: {},
      newSourceField: INIT_SOURCE_FIELDS[0],
      newValues: ''
    };
  }

  onAddNewSourceField = (_event: React.FormEvent, value: string): void => {
    this.setState({
      newSourceField: value
    });
  };

  onAddNewValues = (_event: React.FormEvent, value: string): void => {
    this.setState({
      newValues: value
    });
  };

  onAddSource = (): void => {
    this.setState(prevState => {
      const i = prevState.sourceFields.indexOf(prevState.newSourceField);

      if (i > -1) {
        prevState.sourceFields.splice(i, 1);
      }

      prevState.source[prevState.newSourceField] = prevState.newValues.split(',');

      return {
        sourceFields: prevState.sourceFields,
        source: prevState.source,
        newSourceField: prevState.sourceFields[0],
        newValues: ''
      };
    });
  };

  onAddSourceFromList = (): void => {
    const fromItem = this.state.source;

    this.setState(
      {
        sourceFields: Object.assign([], INIT_SOURCE_FIELDS),
        source: {},
        newSourceField: INIT_SOURCE_FIELDS[0],
        newValues: ''
      },
      () => {
        this.props.onAddFrom(fromItem);
      }
    );
  };

  // Helper to identify when some values are valid
  isValidSource = (): [boolean, string] => {
    if (this.state.newSourceField === 'ipBlocks' || this.state.newSourceField === 'notIpBlocks') {
      const validIp = this.state.newValues.split(',').every(ip => isValidIp(ip));

      if (!validIp) {
        return [false, 'Not valid IP'];
      }
    }

    const emptyValues = this.state.newValues.split(',').every(v => v.length === 0);

    if (emptyValues) {
      return [false, 'Empty value'];
    }

    return [true, ''];
  };

  onRemoveSource = (removeSourceField: string): void => {
    this.setState(prevState => {
      prevState.sourceFields.push(removeSourceField);
      delete prevState.source[removeSourceField];
      const newSourceFields = prevState.sourceFields.sort();

      return {
        sourceFields: newSourceFields,
        source: prevState.source,
        newSourceField: newSourceFields[0],
        newValues: ''
      };
    });
  };

  rows = (): IRow[] => {
    const [isValidSource, invalidText] = this.isValidSource();

    const sourceRows = Object.keys(this.state.source).map((sourceField, i) => {
      return {
        key: `sourceKey_${i}`,
        cells: [
          <>{sourceField}</>,
          <>{this.state.source[sourceField].join(',')}</>,
          <Button
            id="removeSourceBtn"
            variant={ButtonVariant.link}
            icon={<KialiIcon.Delete />}
            onClick={() => this.onRemoveSource(sourceField)}
          />
        ]
      };
    });

    if (this.state.sourceFields.length > 0) {
      return sourceRows.concat([
        {
          key: 'sourceKeyNew',
          cells: [
            <FormSelect
              value={this.state.newSourceField}
              id="addNewSourceField"
              name="addNewSourceField"
              onChange={this.onAddNewSourceField}
            >
              {this.state.sourceFields.map((option, index) => (
                <FormSelectOption isDisabled={false} key={`source_${index}`} value={option} label={option} />
              ))}
            </FormSelect>,
            <>
              <TextInput
                value={this.state.newValues}
                type="text"
                id="addNewValues"
                key="addNewValues"
                aria-describedby="add new source values"
                name="addNewValues"
                onChange={this.onAddNewValues}
                validated={isValid(isValidSource)}
              />

              {!isValidSource && (
                <div key="hostsHelperText" className={noSourceStyle}>
                  {invalidText}
                </div>
              )}
            </>,
            <>
              {this.state.sourceFields.length > 0 && (
                <Button
                  variant={ButtonVariant.link}
                  icon={<KialiIcon.AddMore />}
                  onClick={this.onAddSource}
                  isDisabled={!isValidSource}
                />
              )}
            </>
          ]
        }
      ]);
    }

    return sourceRows;
  };

  render() {
    return (
      <>
        <SimpleTable label="Source Builder" columns={columns} rows={this.rows()} />

        <Button
          variant={ButtonVariant.link}
          icon={<KialiIcon.AddMore />}
          isDisabled={Object.keys(this.state.source).length === 0}
          onClick={this.onAddSourceFromList}
        >
          Add Source to From List
        </Button>
      </>
    );
  }
}
