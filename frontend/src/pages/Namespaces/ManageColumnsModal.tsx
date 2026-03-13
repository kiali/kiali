import * as React from 'react';
import { Button, ButtonVariant, Checkbox } from '@patternfly/react-core';
import { Modal, ModalVariant } from '@patternfly/react-core/deprecated';
import { kialiStyle } from 'styles/StyleUtils';
import { t } from 'utils/I18nUtils';

export type ManagedColumn = {
  id: string;
  isDisabled?: boolean;
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
  gap: '0.5rem',
  padding: '0.5rem 0.75rem',
  border: '1px solid var(--pf-t--global--border--color--default)',
  borderRadius: 'var(--pf-t--global--border--radius--small)',
  backgroundColor: 'var(--pf-t--global--background--color--primary--default)'
});

const titleStyle = kialiStyle({
  flex: 1,
  userSelect: 'none'
});

export const ManageColumnsModal: React.FC<Props> = (props: Props) => {
  const [draft, setDraft] = React.useState<ManagedColumn[]>(props.columns);

  React.useEffect(() => {
    if (props.isOpen) {
      setDraft(props.columns);
    }
  }, [props.isOpen, props.columns]);

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
        {draft.map(col => (
          <div key={col.id} className={rowStyle} aria-label={t('Column {{column}}', { column: col.title })}>
            <Checkbox
              id={`manage-column-${col.id}`}
              isChecked={col.isShown}
              isDisabled={!!col.isDisabled}
              onChange={(_e, checked) => setShown(col.id, checked)}
              label={<span className={titleStyle}>{col.title}</span>}
            />
          </div>
        ))}
      </div>
    </Modal>
  );
};
