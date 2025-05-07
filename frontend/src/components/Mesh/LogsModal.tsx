import * as React from 'react';
import { LogLine } from '../../types/TracingInfo';
import { Button, Modal, ModalVariant } from '@patternfly/react-core';
import { kialiStyle } from '../../styles/StyleUtils';
import { useKialiTranslation } from '../../utils/I18nUtils';

type LogsModalProps = {
  isOpen: boolean;
  logs: LogLine[];
  onClose: () => void;
};

const modalStyle = kialiStyle({
  overflowY: 'hidden',
  $nest: {
    '& .pf-v5-c-tab-content': {
      height: '1525px',
      overflowY: 'auto'
    }
  }
});

const containerStyle = kialiStyle({
  fontFamily: 'Courier New, Courier, monospace',
  margin: 0,
  padding: '0',
  resize: 'none',
  whiteSpace: 'pre',
  width: '100%',
  overflowX: 'scroll'
});

const blueDisplay = kialiStyle({
  color: 'rgb(25 116 116);'
});

const blueDarkDisplay = kialiStyle({
  color: 'rgb(1 53 98);',
  padding: '0 0.5em'
});

export const LogsModal: React.FC<LogsModalProps> = (props: LogsModalProps) => {
  const { t } = useKialiTranslation();

  if (!props.isOpen) {
    return null;
  }

  return (
    <Modal
      className={modalStyle}
      variant={ModalVariant.medium}
      isOpen={props.isOpen}
      onClose={props.onClose}
      title={t('Tracing diagnostic logs')}
      actions={[
        <Button key="close" onClick={props.onClose}>
          {t('Close')}
        </Button>
      ]}
    >
      <div className={containerStyle}>
        {props.logs.map(log => (
          <>
            <div>
              <span>
                <span className={blueDisplay}>{log.time.substring(0, 19)}</span>
                <span className={blueDarkDisplay}>[{log.test}]</span>
                {log.result}
              </span>
            </div>
          </>
        ))}
      </div>
    </Modal>
  );
};
