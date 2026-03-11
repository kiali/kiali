import * as React from 'react';
import { Button, ButtonVariant, Checkbox } from '@patternfly/react-core';
import { Modal, ModalVariant } from '@patternfly/react-core/deprecated';
import { kialiStyle } from 'styles/StyleUtils';
import { t } from 'utils/I18nUtils';
import { classes } from 'typestyle';
import { GripVerticalIcon } from '@patternfly/react-icons';

export type ManagedColumn = {
  id: string;
  isShown: boolean;
  title: string;
};

type Props = {
  columns: ManagedColumn[];
  isOpen: boolean;
  onApply: (columns: ManagedColumn[]) => void;
  onClose: () => void;
};

const listStyle = kialiStyle({
  display: 'flex',
  flexDirection: 'column',
  gap: '0.5rem'
});

const rowStyle = kialiStyle({
  display: 'flex',
  alignItems: 'center',
  gap: '0.75rem',
  padding: '0.5rem 0.75rem',
  border: '1px solid var(--pf-t--global--border--color--default)',
  borderRadius: 'var(--pf-t--global--border--radius--small)',
  backgroundColor: 'var(--pf-t--global--background--color--primary--default)'
});

const rowDraggingStyle = kialiStyle({
  opacity: 0.65
});

const handleStyle = kialiStyle({
  display: 'inline-flex',
  alignItems: 'center',
  cursor: 'grab'
});

const titleStyle = kialiStyle({
  flex: 1,
  userSelect: 'none'
});

const moveItem = <T,>(arr: T[], fromIndex: number, toIndex: number): T[] => {
  const next = arr.slice();
  const [moved] = next.splice(fromIndex, 1);
  next.splice(toIndex, 0, moved);
  return next;
};

export const ManageColumnsModal: React.FC<Props> = (props: Props) => {
  const [draft, setDraft] = React.useState<ManagedColumn[]>(props.columns);
  const [draggingIndex, setDraggingIndex] = React.useState<number | null>(null);
  const dragFromRef = React.useRef<number | null>(null);

  React.useEffect(() => {
    if (props.isOpen) {
      setDraft(props.columns);
      setDraggingIndex(null);
      dragFromRef.current = null;
    }
  }, [props.isOpen, props.columns]);

  const onDragStart = (idx: number) => (e: React.DragEvent<HTMLDivElement>): void => {
    dragFromRef.current = idx;
    setDraggingIndex(idx);
    e.dataTransfer.effectAllowed = 'move';
    // Required for Firefox to start dragging.
    e.dataTransfer.setData('text/plain', String(idx));
  };

  const onDragOver = (_idx: number) => (e: React.DragEvent<HTMLDivElement>): void => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
  };

  const onDrop = (idx: number) => (e: React.DragEvent<HTMLDivElement>): void => {
    e.preventDefault();
    const from = dragFromRef.current;
    if (from === null || from === idx) {
      setDraggingIndex(null);
      dragFromRef.current = null;
      return;
    }
    setDraft(prev => moveItem(prev, from, idx));
    setDraggingIndex(null);
    dragFromRef.current = null;
  };

  const onDragEnd = (): void => {
    setDraggingIndex(null);
    dragFromRef.current = null;
  };

  const setShown = (id: string, isShown: boolean): void => {
    setDraft(prev => prev.map(c => (c.id === id ? { ...c, isShown } : c)));
  };

  return (
    <Modal
      title={t('Manage columns')}
      variant={ModalVariant.small}
      isOpen={props.isOpen}
      onClose={props.onClose}
      actions={[
        <Button
          key="save"
          variant={ButtonVariant.primary}
          onClick={() => props.onApply(draft)}
          data-test="manage-columns-save"
        >
          {t('Save')}
        </Button>,
        <Button key="cancel" variant={ButtonVariant.link} onClick={props.onClose} data-test="manage-columns-cancel">
          {t('Cancel')}
        </Button>
      ]}
    >
      <div style={{ marginBottom: '0.75rem' }}>{t('Selected columns will be displayed in the table.')}</div>
      <div className={listStyle} data-test="manage-columns-list">
        {draft.map((col, idx) => (
          <div
            key={col.id}
            className={classes(rowStyle, draggingIndex === idx ? rowDraggingStyle : undefined)}
            draggable={true}
            onDragStart={onDragStart(idx)}
            onDragOver={onDragOver(idx)}
            onDrop={onDrop(idx)}
            onDragEnd={onDragEnd}
            aria-label={t('Column {{column}}', { column: col.title })}
          >
            <span className={handleStyle} aria-hidden="true">
              <GripVerticalIcon />
            </span>
            <Checkbox
              id={`manage-column-${col.id}`}
              isChecked={col.isShown}
              onChange={(_e, checked) => setShown(col.id, checked)}
              label={<span className={titleStyle}>{col.title}</span>}
            />
          </div>
        ))}
      </div>
    </Modal>
  );
};
