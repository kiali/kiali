import * as React from 'react';
import {
  ActionGroup,
  Alert,
  Button,
  List,
  ListItem,
  Popover,
  TextArea,
  TextInput,
  Title,
  TitleSizes,
  Tooltip
} from '@patternfly/react-core';
import { Modal, ModalVariant } from '@patternfly/react-core/deprecated';
import { Table, TableVariant, Tbody, Th, Thead, Tr } from '@patternfly/react-table';
import { KialiIcon } from 'config/KialiIcon';
import { kialiStyle } from 'styles/StyleUtils';
import { t } from 'utils/I18nUtils';

export interface WorkloadAnnotationsWizardProps {
  canEdit: boolean;
  controllerAnnotations: Record<string, string>;
  isOpen: boolean;
  onClose: () => void;
  onSave: (controller: Record<string, string>, template: Record<string, string>) => void;
  templateAnnotations: Record<string, string>;
}

type Entry = [string, string];

const addMoreStyle = kialiStyle({
  marginTop: '0.5rem',
  marginLeft: '1rem'
});

const clearButtonStyle = kialiStyle({
  marginLeft: '0.5rem'
});

const alertStyle = kialiStyle({
  marginTop: '1rem'
});

const sectionStyle = kialiStyle({
  marginBottom: '1.5rem'
});

const popoverTextAreaStyle = kialiStyle({
  fontFamily: 'var(--pf-t--global--font--family--mono)',
  fontSize: 'var(--pf-t--global--font--size--sm)',
  minHeight: '20rem',
  width: '100%',
  resize: 'vertical'
});

const toEntries = (record: Record<string, string>): Entry[] => {
  const entries = Object.entries(record);
  return entries.length > 0 ? entries : [['', '']];
};

const toRecord = (entries: Entry[]): Record<string, string> => {
  const result: Record<string, string> = {};
  for (const [key, value] of entries) {
    if (key.length > 0) {
      result[key] = value;
    }
  }
  return result;
};

const validateSection = (entries: Entry[], sectionName: string): string[] => {
  const errors: string[] = [];
  const keys = entries.map(e => e[0]);
  if (keys.some(k => k.length === 0 && entries.length > 1)) {
    errors.push(t('Empty keys found in {{section}}.', { section: sectionName }));
  }
  if (keys.filter(k => k.length > 0).some((k, i, arr) => arr.indexOf(k) !== i)) {
    errors.push(t('Duplicate keys found in {{section}}.', { section: sectionName }));
  }
  return errors;
};

interface EditValuePopoverProps {
  entryKey: string;
  id: string;
  onChange: (value: string) => void;
  value: string;
}

const popoverActionsStyle = kialiStyle({
  display: 'flex',
  gap: '0.25rem',
  position: 'absolute',
  top: 'var(--pf-t--global--spacer--sm)',
  right: 'var(--pf-t--global--spacer--md)'
});

const EditValuePopover: React.FC<EditValuePopoverProps> = ({ entryKey, id, onChange, value }) => {
  const [draft, setDraft] = React.useState(value);
  const [isVisible, setIsVisible] = React.useState(false);

  return (
    <Popover
      appendTo={() =>
        (document.querySelector('[aria-labelledby="workload-annotations-wizard-title"]') as HTMLElement) ||
        document.body
      }
      headerContent={entryKey || t('Value')}
      bodyContent={
        <>
          <div className={popoverActionsStyle}>
            <Tooltip content={t('Save')}>
              <Button
                variant="plain"
                size="sm"
                icon={<KialiIcon.Check />}
                onClick={() => {
                  onChange(draft);
                  setIsVisible(false);
                }}
              />
            </Tooltip>
            <Tooltip content={t('Cancel')}>
              <Button
                variant="plain"
                size="sm"
                icon={<KialiIcon.Close />}
                onClick={() => {
                  setDraft(value);
                  setIsVisible(false);
                }}
              />
            </Tooltip>
          </div>
          <TextArea className={popoverTextAreaStyle} id={id} onChange={(_event, v) => setDraft(v)} value={draft} />
        </>
      }
      isVisible={isVisible}
      shouldOpen={() => {
        setDraft(value);
        setIsVisible(true);
      }}
      shouldClose={() => {
        setDraft(value);
        setIsVisible(false);
      }}
      minWidth="40rem"
      position="left"
      showClose={false}
    >
      <Button variant="plain" icon={<KialiIcon.PencilAlt />} size="sm" />
    </Popover>
  );
};

interface SectionProps {
  canEdit: boolean;
  entries: Entry[];
  onAdd: () => void;
  onChange: (index: number, entry: Entry) => void;
  onRemove: (index: number) => void;
  sectionId: string;
  title: string;
}

const AnnotationSection: React.FC<SectionProps> = ({
  canEdit,
  entries,
  onAdd,
  onChange,
  onRemove,
  sectionId,
  title
}) => (
  <div className={sectionStyle} data-test={`${sectionId}-section`}>
    <Title headingLevel="h3" size={TitleSizes.lg} style={{ marginBottom: '0.5rem' }}>
      {title}
    </Title>
    <Table variant={TableVariant.compact}>
      <Thead>
        <Tr>
          <Th dataLabel="Key">{t('Key')}</Th>
          <Th dataLabel="Value">{t('Value')}</Th>
          {canEdit && <Th></Th>}
        </Tr>
      </Thead>
      <Tbody>
        {entries.map(([key, value], index) =>
          canEdit ? (
            <Tr key={`${sectionId}_edit_${index}`}>
              <Th width={40}>
                <TextInput
                  aria-invalid={key === '' || entries.filter(e => e[0] === key).length > 1}
                  id={`${sectionId}_key_${index}`}
                  onChange={(_event, newKey) => onChange(index, [newKey, value])}
                  placeholder={t('Key')}
                  type="text"
                  value={key}
                />
              </Th>
              <Th width={40}>
                <TextInput
                  id={`${sectionId}_value_${index}`}
                  placeholder={t('Value')}
                  readOnlyVariant="plain"
                  type="text"
                  value={value}
                />
              </Th>
              <Th>
                <EditValuePopover
                  entryKey={key}
                  id={`${sectionId}_popover_value_${index}`}
                  onChange={v => onChange(index, [key, v])}
                  value={value}
                />
                <Button variant="plain" icon={<KialiIcon.Delete />} onClick={() => onRemove(index)} />
              </Th>
            </Tr>
          ) : (
            <Tr key={`${sectionId}_view_${index}`}>
              <Th dataLabel={key}>{key}</Th>
              <Th dataLabel={value}>{value}</Th>
            </Tr>
          )
        )}
      </Tbody>
    </Table>
    {canEdit && (
      <Button
        variant="link"
        className={addMoreStyle}
        data-test={`${sectionId}-add-more`}
        icon={<KialiIcon.AddMore />}
        onClick={onAdd}
        isInline
      >
        <span style={{ marginLeft: '0.25rem' }}>{t('Add more')}</span>
      </Button>
    )}
  </div>
);

export const WorkloadAnnotationsWizard: React.FC<WorkloadAnnotationsWizardProps> = ({
  canEdit,
  controllerAnnotations,
  isOpen,
  onClose,
  onSave,
  templateAnnotations
}) => {
  const [controllerEntries, setControllerEntries] = React.useState<Entry[]>(() => toEntries(controllerAnnotations));
  const [templateEntries, setTemplateEntries] = React.useState<Entry[]>(() => toEntries(templateAnnotations));
  const [validation, setValidation] = React.useState<string[]>([]);
  const wasOpen = React.useRef(false);

  React.useEffect(() => {
    if (isOpen && !wasOpen.current) {
      setControllerEntries(toEntries(controllerAnnotations));
      setTemplateEntries(toEntries(templateAnnotations));
      setValidation([]);
    }
    wasOpen.current = isOpen;
  }, [isOpen, controllerAnnotations, templateAnnotations]);

  const handleClear = (): void => {
    setControllerEntries(toEntries(controllerAnnotations));
    setTemplateEntries(toEntries(templateAnnotations));
    setValidation([]);
  };

  const handleClose = (): void => {
    handleClear();
    onClose();
  };

  const handleSave = (): void => {
    const errors = [
      ...validateSection(controllerEntries, t('Controller Annotations')),
      ...validateSection(templateEntries, t('Pod Template Annotations'))
    ];
    if (errors.length > 0) {
      setValidation(errors);
      return;
    }
    setValidation([]);
    onSave(toRecord(controllerEntries), toRecord(templateEntries));
  };

  const makeChangeHandler = (setter: React.Dispatch<React.SetStateAction<Entry[]>>) => (
    index: number,
    entry: Entry
  ): void => {
    setter(prev => prev.map((e, i) => (i === index ? entry : e)));
  };

  const makeRemoveHandler = (setter: React.Dispatch<React.SetStateAction<Entry[]>>) => (index: number): void => {
    setter(prev => prev.filter((_, i) => i !== index));
  };

  const makeAddHandler = (setter: React.Dispatch<React.SetStateAction<Entry[]>>) => (): void => {
    setter(prev => [...prev, ['', '']]);
  };

  const header = (
    <Title id="workload-annotations-wizard-title" headingLevel="h1" size={TitleSizes['2xl']}>
      {t('Annotations')}
    </Title>
  );

  const footer = (
    <ActionGroup>
      {canEdit ? (
        <>
          <Button variant="primary" onClick={handleSave} data-test="save-button">
            {t('Save')}
          </Button>
          <Button variant="secondary" className={clearButtonStyle} onClick={handleClear}>
            {t('Clear')}
          </Button>
          <Button variant="link" onClick={handleClose}>
            {t('Cancel')}
          </Button>
        </>
      ) : (
        <Button variant="primary" onClick={handleClose}>
          {t('Close')}
        </Button>
      )}
    </ActionGroup>
  );

  return (
    <Modal
      variant={ModalVariant.large}
      isOpen={isOpen}
      onClose={handleClose}
      header={header}
      aria-labelledby="workload-annotations-wizard-title"
      footer={footer}
    >
      <AnnotationSection
        canEdit={canEdit}
        entries={controllerEntries}
        onAdd={makeAddHandler(setControllerEntries)}
        onChange={makeChangeHandler(setControllerEntries)}
        onRemove={makeRemoveHandler(setControllerEntries)}
        sectionId="controller"
        title={t('Controller Annotations')}
      />
      <AnnotationSection
        canEdit={canEdit}
        entries={templateEntries}
        onAdd={makeAddHandler(setTemplateEntries)}
        onChange={makeChangeHandler(setTemplateEntries)}
        onRemove={makeRemoveHandler(setTemplateEntries)}
        sectionId="template"
        title={t('Pod Template Annotations')}
      />

      {validation.length > 0 && (
        <Alert variant="danger" className={alertStyle} isInline isExpandable title={t('An error occurred')}>
          <List isPlain>
            {validation.map((message, i) => (
              <ListItem key={`validation_${i}`}>{message}</ListItem>
            ))}
          </List>
        </Alert>
      )}
    </Modal>
  );
};
