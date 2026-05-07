import * as React from 'react';
import {
  Button,
  Card,
  CardBody,
  CardHeader,
  Flex,
  FlexItem,
  Label,
  LabelGroup,
  Title,
  TitleSizes,
  Tooltip
} from '@patternfly/react-core';
import { KialiIcon } from 'config/KialiIcon';
import { kialiStyle } from 'styles/StyleUtils';
import { t } from 'utils/I18nUtils';

type EditableLabelsCardProps = {
  canEdit: boolean;
  isCompact?: boolean;
  isVertical?: boolean;
  labels: Record<string, string>;
  numLabels?: number;
  onLabelClick?: (key: string, value: string) => void;
  onSave: (labels: Record<string, string>) => void;
  title: string;
};

const noLabelsStyle = kialiStyle({
  color: 'var(--pf-t--global--color--nonstatus--gray--default)',
  fontStyle: 'italic'
});

const headerActionsStyle = kialiStyle({
  display: 'flex',
  alignItems: 'center',
  gap: 'var(--pf-t--global--spacer--xs)'
});

const editableLabelStyle = kialiStyle({
  maxWidth: 'none !important',
  $nest: {
    '& .pf-v6-c-label__content': {
      maxWidth: 'none !important'
    },
    '& .pf-v6-c-label__editable-text': {
      maxWidth: 'none !important'
    }
  }
});

const NEW_LABEL_PLACEHOLDER = 'key=value';

const formatLabel = (key: string, value: string): string => {
  if (key.length === 0 && value.length === 0) {
    return NEW_LABEL_PLACEHOLDER;
  }
  return value.length > 0 ? `${key}=${value}` : key;
};

const parseLabel = (text: string): [string, string] | undefined => {
  const eqIdx = text.indexOf('=');
  if (eqIdx < 1) {
    return undefined;
  }
  return [text.substring(0, eqIdx).trim(), text.substring(eqIdx + 1).trim()];
};

type LabelEntry = { key: string; value: string };

export const EditableLabelsCard: React.FC<EditableLabelsCardProps> = ({
  canEdit,
  isCompact = false,
  isVertical = true,
  labels,
  numLabels = 5,
  onLabelClick,
  onSave,
  title
}) => {
  const [editing, setEditing] = React.useState(false);
  const [editLabels, setEditLabels] = React.useState<LabelEntry[]>([]);
  const [validationError, setValidationError] = React.useState<string | undefined>();

  const handleStartEditing = (): void => {
    setEditLabels(Object.entries(labels ?? {}).map(([key, value]) => ({ key, value })));
    setValidationError(undefined);
    setEditing(true);
  };

  const handleCancelEditing = (): void => {
    setEditing(false);
    setValidationError(undefined);
  };

  const validate = (entries: LabelEntry[]): string | undefined => {
    const keys = entries.map(e => e.key);
    if (keys.some(k => k.length === 0)) {
      return t('Labels must have non-empty keys');
    }
    if (new Set(keys).size !== keys.length) {
      return t('Duplicate label keys are not allowed');
    }
    return undefined;
  };

  const handleSave = (): void => {
    const nonEmpty = editLabels.filter(e => !(e.key.length === 0 && e.value.length === 0));
    const err = validate(nonEmpty);
    if (err) {
      setValidationError(err);
      return;
    }
    const result: Record<string, string> = {};
    nonEmpty.forEach(e => {
      result[e.key] = e.value;
    });
    onSave(result);
    setEditing(false);
    setValidationError(undefined);
  };

  const handleEditComplete = (idx: number, _event: MouseEvent | KeyboardEvent, newText: string): void => {
    const trimmed = newText.trim();
    if (trimmed === NEW_LABEL_PLACEHOLDER || trimmed.length === 0) {
      return;
    }
    const parsed = parseLabel(trimmed);
    if (!parsed) {
      return;
    }
    setEditLabels(prev => prev.map((entry, i) => (i === idx ? { key: parsed[0], value: parsed[1] } : entry)));
  };

  const handleClose = (idx: number): void => {
    setEditLabels(prev => prev.filter((_, i) => i !== idx));
  };

  const handleAdd = (): void => {
    setEditLabels(prev => [...prev, { key: '', value: '' }]);
  };

  const labelEntries = Object.entries(labels ?? {});
  const hasLabels = labelEntries.length > 0;

  const headerActions = canEdit ? (
    <div className={headerActionsStyle}>
      {editing ? (
        <>
          <Tooltip content={t('Save')}>
            <Button variant="plain" size="sm" onClick={handleSave} icon={<KialiIcon.Check />} />
          </Tooltip>
          <Tooltip content={t('Cancel')}>
            <Button variant="plain" size="sm" onClick={handleCancelEditing} icon={<KialiIcon.Close />} />
          </Tooltip>
        </>
      ) : (
        <Tooltip content={t('Edit labels')}>
          <Button variant="plain" size="sm" onClick={handleStartEditing} icon={<KialiIcon.PencilAlt />} />
        </Tooltip>
      )}
    </div>
  ) : undefined;

  return (
    <Card isCompact>
      <CardHeader actions={headerActions ? { actions: headerActions, hasNoOffset: true } : undefined}>
        <Title headingLevel="h4" size={TitleSizes.md}>
          {title}
        </Title>
      </CardHeader>
      <CardBody>
        {validationError && (
          <Flex style={{ marginBottom: 'var(--pf-t--global--spacer--sm)' }}>
            <FlexItem>
              <span style={{ color: 'var(--pf-t--global--color--nonstatus--red--default)' }}>{validationError}</span>
            </FlexItem>
          </Flex>
        )}
        {editing ? (
          <LabelGroup
            isVertical={isVertical}
            numLabels={numLabels}
            isEditable
            addLabelControl={
              <Label variant="add" onClick={handleAdd}>
                {t('Add label')}
              </Label>
            }
          >
            {editLabels.map((entry, idx) => (
              <Label
                key={idx}
                className={editableLabelStyle}
                isEditable
                onEditComplete={(event, newText) => handleEditComplete(idx, event, newText)}
                onClose={() => handleClose(idx)}
                isCompact={isCompact}
              >
                {formatLabel(entry.key, entry.value)}
              </Label>
            ))}
          </LabelGroup>
        ) : hasLabels ? (
          <LabelGroup isVertical={isVertical} numLabels={numLabels}>
            {labelEntries.map(([key, value]) => (
              <Label
                key={`${key}=${value}`}
                isCompact={isCompact}
                textMaxWidth="500px"
                tooltipPosition="top"
                onClick={onLabelClick ? () => onLabelClick(key, value) : undefined}
              >
                {formatLabel(key, value)}
              </Label>
            ))}
          </LabelGroup>
        ) : (
          <span className={noLabelsStyle}>{t('No labels')}</span>
        )}
      </CardBody>
    </Card>
  );
};
