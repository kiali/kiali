import * as React from 'react';
import { Button, ButtonVariant, Modal, ModalBody, ModalFooter, ModalHeader } from '@patternfly/react-core';
import type { AuthStrategy } from '../../types/Auth';
import type { LoginSession } from '../../store/Store';
import { authenticationConfig } from '../../config/AuthenticationConfig';
import { PFColors } from 'components/Pf/PfColors';
import { kialiStyle } from 'styles/StyleUtils';
import { PFSpacer } from 'styles/PfSpacer';
import { PFFontSize } from 'styles/PfTypography';
import { KialiIcon } from 'config/KialiIcon';
import { useKialiTranslation } from 'utils/I18nUtils';

const sessionTimeoutModalTitleId = 'session-timeout-modal-title';

type SessionTimeoutProps = {
  onDismiss: () => void;
  onExtendSession: (session: LoginSession) => void;
  onLogout: () => void;
  show: boolean;
  timeOutCountDown: number;
};

const sessionTimeoutContentStyle = kialiStyle({
  alignItems: 'flex-start',
  display: 'flex',
  gap: PFSpacer.md
});

const sessionTimeoutIconStyle = kialiStyle({
  flexShrink: 0
});

const sessionTimeoutTextStyle = kialiStyle({
  flex: 1,
  fontSize: PFFontSize.default,
  marginBottom: PFSpacer.md
});

export const SessionTimeout: React.FC<SessionTimeoutProps> = (props: SessionTimeoutProps) => {
  const { t } = useKialiTranslation();
  const textForAuthStrategy = (_strategy: AuthStrategy): React.ReactNode => {
    const line1 =
      props.timeOutCountDown <= 0
        ? t('Your session has expired.')
        : t('Your session will expire in {{seconds}} seconds.', { seconds: props.timeOutCountDown.toFixed() });

    const line2 = t('You will need to re-login. Please save your changes, if any.');

    return (
      <>
        <div>{line1}</div>
        <div>{line2}</div>
      </>
    );
  };

  const defaultAction = props.onDismiss;

  const buttons = [
    <Button key="ok" variant={ButtonVariant.primary} onClick={props.onDismiss}>
      {t('OK')}
    </Button>,
    <Button
      data-test="session-timeout-logout-btn"
      key="confirm"
      variant={ButtonVariant.secondary}
      onClick={props.onLogout}
    >
      {t('Log Out')}
    </Button>
  ];

  return (
    <Modal
      aria-labelledby={sessionTimeoutModalTitleId}
      data-test="session-timeout-modal"
      isOpen={props.show}
      onClose={defaultAction}
      width="40%"
    >
      <ModalHeader labelId={sessionTimeoutModalTitleId} title={t('Session Timeout')} />
      <ModalBody className={sessionTimeoutContentStyle}>
        <span className={sessionTimeoutIconStyle}>
          <KialiIcon.Warning size="xl" color={PFColors.Warning} />
        </span>

        <span className={sessionTimeoutTextStyle}>{textForAuthStrategy(authenticationConfig.strategy)}</span>
      </ModalBody>
      <ModalFooter>{buttons}</ModalFooter>
    </Modal>
  );
};
