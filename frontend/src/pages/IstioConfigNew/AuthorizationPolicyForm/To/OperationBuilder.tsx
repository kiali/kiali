import * as React from 'react';
import { IRow, ThProps } from '@patternfly/react-table';
import {
  Button,
  ButtonVariant,
  MenuToggle,
  MenuToggleElement,
  Select,
  SelectList,
  SelectOption,
  TextInput
} from '@patternfly/react-core';
import { SimpleTable } from 'components/Table/SimpleTable';
import { KialiIcon } from 'config/KialiIcon';
import { t, useKialiTranslation } from 'utils/I18nUtils';

type Props = {
  onAddTo: (operation: { [key: string]: string[] }) => void;
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
    title: t('Operation Field'),
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

export const OperationBuilder: React.FC<Props> = (props: Props) => {
  const [newOperationField, setNewOperationField] = React.useState<string>(INIT_OPERATION_FIELDS[0]);
  const [newValues, setNewValues] = React.useState<string>('');
  const [operation, setOperation] = React.useState<{ [key: string]: string[] }>({});
  const [operationFields, setOperationFields] = React.useState<string[]>(INIT_OPERATION_FIELDS);
  const [isOperationFieldSelectOpen, setIsOperationFieldSelectOpen] = React.useState<boolean>(false);

  const { t } = useKialiTranslation();

  const onAddNewOperationField = (value: string): void => {
    setIsOperationFieldSelectOpen(false);
    setNewOperationField(value);
  };

  const onAddNewValues = (_event: React.FormEvent, value: string): void => {
    setNewValues(value);
  };

  const onAddOperation = (): void => {
    const newOperationFields = [...operationFields];
    const i = operationFields.indexOf(newOperationField);

    if (i > -1) {
      newOperationFields.splice(i, 1);
    }

    const newOperation = { ...operation };
    newOperation[newOperationField] = newValues.split(',');

    setOperation(newOperation);
    setOperationFields(newOperationFields);
    setNewOperationField(newOperationFields[0]);
    setNewValues('');
  };

  const onAddOperationToList = (): void => {
    const toItem = operation;

    setOperationFields(INIT_OPERATION_FIELDS);
    setOperation({});
    setNewOperationField(INIT_OPERATION_FIELDS[0]);
    setNewValues('');

    props.onAddTo(toItem);
  };

  const onRemoveOperation = (removeOperationField: string): void => {
    let newOperationFields = [...operationFields];
    newOperationFields.push(removeOperationField);
    newOperationFields = newOperationFields.sort();

    const newOperation = { ...operation };
    delete newOperation[removeOperationField];

    setOperation(newOperation);
    setOperationFields(newOperationFields);
    setNewOperationField(newOperationFields[0]);
    setNewValues('');
  };

  const rows = (): IRow[] => {
    const operatorRows = Object.keys(operation).map((operationField, i) => {
      return {
        key: `operationKey_${i}`,
        cells: [
          <>{operationField}</>,
          <>{operation[operationField].join(',')}</>,
          <Button
            id="removeOperationBtn"
            variant={ButtonVariant.link}
            icon={<KialiIcon.Delete />}
            onClick={() => onRemoveOperation(operationField)}
          />
        ]
      };
    });

    if (operationFields.length > 0) {
      return operatorRows.concat([
        {
          key: 'operationKeyNew',
          cells: [
            <Select
              id="addNewOperationField"
              isOpen={isOperationFieldSelectOpen}
              selected={newOperationField}
              onSelect={(_event, value) => onAddNewOperationField(value as string)}
              onOpenChange={setIsOperationFieldSelectOpen}
              toggle={(toggleRef: React.Ref<MenuToggleElement>) => (
                <MenuToggle
                  id="addNewOperationField-toggle"
                  ref={toggleRef}
                  onClick={() => setIsOperationFieldSelectOpen(!isOperationFieldSelectOpen)}
                  isExpanded={isOperationFieldSelectOpen}
                  isFullWidth
                >
                  {newOperationField}
                </MenuToggle>
              )}
              aria-label="Operation Field Select"
            >
              <SelectList>
                {operationFields.map((option, index) => (
                  <SelectOption key={`operation_${index}`} value={option}>
                    {option}
                  </SelectOption>
                ))}
              </SelectList>
            </Select>,

            <TextInput
              value={newValues}
              type="text"
              id="addNewValues"
              key="addNewValues"
              aria-describedby={t('Add new operation values')}
              name="addNewValues"
              onChange={onAddNewValues}
            />,
            <>
              {operationFields.length > 0 && (
                <Button variant={ButtonVariant.link} icon={<KialiIcon.AddMore />} onClick={onAddOperation} />
              )}
            </>
          ]
        }
      ]);
    }
    return operatorRows;
  };

  return (
    <>
      <SimpleTable label={t('Operation Builder')} columns={columns} rows={rows()} />

      <Button
        variant={ButtonVariant.link}
        icon={<KialiIcon.AddMore />}
        isDisabled={Object.keys(operation).length === 0}
        onClick={onAddOperationToList}
      >
        {t('Add Operation to To List')}
      </Button>
    </>
  );
};
