import * as React from 'react';
import { IRow, ThProps } from '@patternfly/react-table';
import { Button, ButtonVariant, FormSelect, FormSelectOption, TextInput } from '@patternfly/react-core';
import { isValidIp } from '../../../../utils/IstioConfigUtils';
import { kialiStyle } from 'styles/StyleUtils';
import { PFColors } from '../../../../components/Pf/PfColors';
import { isValid } from 'utils/Common';
import { SimpleTable } from 'components/Table/SimpleTable';
import { KialiIcon } from 'config/KialiIcon';
import { t, useKialiTranslation } from 'utils/I18nUtils';

type Props = {
  onAddFrom: (source: { [key: string]: string[] }) => void;
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
    title: t('Source Field'),
    width: 20
  },
  {
    title: t('Values'),
    width: 80
  },
  {
    title: ''
  }
];

export const SourceBuilder: React.FC<Props> = (props: Props) => {
  const [newSourceField, setNewSourceField] = React.useState<string>(INIT_SOURCE_FIELDS[0]);
  const [newValues, setNewValues] = React.useState<string>('');
  const [source, setSource] = React.useState<{ [key: string]: string[] }>({});
  const [sourceFields, setSourceFields] = React.useState<string[]>(INIT_SOURCE_FIELDS);

  const { t } = useKialiTranslation();

  const onAddNewSourceField = (_event: React.FormEvent, value: string): void => {
    setNewSourceField(value);
  };

  const onAddNewValues = (_event: React.FormEvent, value: string): void => {
    setNewValues(value);
  };

  const onAddSource = (): void => {
    const newSourceFields = [...sourceFields];
    const i = sourceFields.indexOf(newSourceField);

    if (i > -1) {
      newSourceFields.splice(i, 1);
    }

    const newSource = { ...source };
    newSource[newSourceField] = newValues.split(',');

    setSource(newSource);
    setSourceFields(newSourceFields);
    setNewSourceField(newSourceFields[0]);
    setNewValues('');
  };

  const onAddSourceFromList = (): void => {
    const fromItem = source;

    setSourceFields(INIT_SOURCE_FIELDS);
    setSource({});
    setNewSourceField(INIT_SOURCE_FIELDS[0]);
    setNewValues('');

    props.onAddFrom(fromItem);
  };

  // Helper to identify when some values are valid
  const isValidSource = (): [boolean, string] => {
    if (newSourceField === 'ipBlocks' || newSourceField === 'notIpBlocks') {
      const validIp = newValues.split(',').every(ip => isValidIp(ip));

      if (!validIp) {
        return [false, t('Not valid IP')];
      }
    }

    const emptyValues = newValues.split(',').every(v => v.length === 0);

    if (emptyValues) {
      return [false, t('Empty value')];
    }

    return [true, ''];
  };

  const onRemoveSource = (removeSourceField: string): void => {
    let newSourceFields = [...sourceFields];
    newSourceFields.push(removeSourceField);
    newSourceFields = newSourceFields.sort();

    const newSource = { ...source };
    delete newSource[removeSourceField];

    setSource(newSource);
    setSourceFields(newSourceFields);
    setNewSourceField(newSourceFields[0]);
    setNewValues('');
  };

  const rows = (): IRow[] => {
    const [validSource, invalidText] = isValidSource();

    const sourceRows = Object.keys(source).map((sourceField, i) => {
      return {
        key: `sourceKey_${i}`,
        cells: [
          <>{sourceField}</>,
          <>{source[sourceField].join(',')}</>,
          <Button
            id="removeSourceBtn"
            variant={ButtonVariant.link}
            icon={<KialiIcon.Delete />}
            onClick={() => onRemoveSource(sourceField)}
          />
        ]
      };
    });

    if (sourceFields.length > 0) {
      return sourceRows.concat([
        {
          key: 'sourceKeyNew',
          cells: [
            <FormSelect
              value={newSourceField}
              id="addNewSourceField"
              name="addNewSourceField"
              onChange={onAddNewSourceField}
            >
              {sourceFields.map((option, index) => (
                <FormSelectOption isDisabled={false} key={`source_${index}`} value={option} label={option} />
              ))}
            </FormSelect>,
            <>
              <TextInput
                value={newValues}
                type="text"
                id="addNewValues"
                key="addNewValues"
                aria-describedby={t('Add new source values')}
                name="addNewValues"
                onChange={onAddNewValues}
                validated={isValid(validSource)}
              />

              {!validSource && (
                <div key="hostsHelperText" className={noSourceStyle}>
                  {invalidText}
                </div>
              )}
            </>,
            <>
              {sourceFields.length > 0 && (
                <Button
                  variant={ButtonVariant.link}
                  icon={<KialiIcon.AddMore />}
                  onClick={onAddSource}
                  isDisabled={!validSource}
                />
              )}
            </>
          ]
        }
      ]);
    }

    return sourceRows;
  };

  return (
    <>
      <SimpleTable label={t('Source Builder')} columns={columns} rows={rows()} />

      <Button
        variant={ButtonVariant.link}
        icon={<KialiIcon.AddMore />}
        isDisabled={Object.keys(source).length === 0}
        onClick={onAddSourceFromList}
      >
        {t('Add Source to From List')}
      </Button>
    </>
  );
};
