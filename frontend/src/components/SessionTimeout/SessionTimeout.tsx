import * as React from 'react';
import {
	Button,
	ButtonVariant
} from '@patternfly/react-core';
import {
	Modal
} from '@patternfly/react-core/deprecated';
import { AuthStrategy } from '../../types/Auth';
import { LoginSession } from '../../store/Store';
import { authenticationConfig } from '../../config/AuthenticationConfig';
import { PFColors } from 'components/Pf/PfColors';
import { kialiStyle } from 'styles/StyleUtils';
import { KialiIcon } from 'config/KialiIcon';

type SessionTimeoutProps = {
  onDismiss: () => void;
  onExtendSession: (session: LoginSession) => void;
  onLogout: () => void;
  show: boolean;
  timeOutCountDown: number;
};

const sessionTimeoutStyle = kialiStyle({
  marginBottom: '1.5rem',
  fontSize: '18px',
  lineHeight: 1.4
});

export const SessionTimeout: React.FC<SessionTimeoutProps> = (props: SessionTimeoutProps) => {
  const textForAuthStrategy = (_strategy: AuthStrategy): React.ReactNode => {
    const line1 =
      props.timeOutCountDown <= 0
        ? 'Your session has expired.'
        : `Your session will expire in ${props.timeOutCountDown.toFixed()} seconds.`;

    const line2 = 'You will need to re-login. Please save your changes, if any.';

    return (
      <>
        <div>{line1}</div>
        <div>{line2}</div>
      </>
    );
  };

  const defaultAction = props.onDismiss;

  const buttons = [
    <Button autoFocus={true} variant={ButtonVariant.primary} onClick={props.onDismiss}>
      OK
    </Button>,
    <Button
      data-test="session-timeout-logout-btn"
      key="confirm"
      variant={ButtonVariant.secondary}
      onClick={props.onLogout}
    >
      Log Out
    </Button>
  ];

  return (
    <Modal
      data-test="session-timeout-modal"
      isOpen={props.show}
      onClose={defaultAction}
      actions={buttons}
      title="Session Timeout"
      width="40%"
    >
      <span>
        <KialiIcon.Warning size="xl" color={PFColors.Warning} />
      </span>

      <span style={{ float: 'right', width: '80%' }} className={sessionTimeoutStyle}>
        {textForAuthStrategy(authenticationConfig.strategy)}
      </span>
    </Modal>
  );
};
