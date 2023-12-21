import * as React from 'react';
import { Modal, Button, ButtonVariant, Icon } from '@patternfly/react-core';
import { WarningTriangleIcon } from '@patternfly/react-icons';
import { AuthStrategy } from '../../types/Auth';
import { LoginSession } from '../../store/Store';
import { authenticationConfig } from '../../config/AuthenticationConfig';
import { PFColors } from 'components/Pf/PfColors';
import { kialiStyle } from 'styles/StyleUtils';

type SessionTimeoutProps = {
  onLogout: () => void;
  onExtendSession: (session: LoginSession) => void;
  onDismiss: () => void;
  show: boolean;
  timeOutCountDown: number;
};

const sessionTimeoutStyle = kialiStyle({
  marginBottom: '25px',
  fontSize: '21px',
  lineHeight: 1.4
});

export class SessionTimeout extends React.Component<SessionTimeoutProps, {}> {
  render() {
    const defaultAction = this.props.onDismiss;
    const buttons = [
      <Button autoFocus={true} variant={ButtonVariant.primary} onClick={this.props.onDismiss}>
        {$t('OK')}
      </Button>,
      <Button key="confirm" variant={ButtonVariant.secondary} onClick={this.props.onLogout}>
        {$t('LogOut', 'Log Out')}
      </Button>
    ];
    return (
      <Modal
        isOpen={this.props.show}
        onClose={defaultAction}
        actions={buttons}
        title={$t('SessionTimeout', 'Session Timeout')}
        width={'40%'}
      >
        <span>
          <Icon size="xl" color={PFColors.Warning}>
            <WarningTriangleIcon />
          </Icon>
        </span>
        <span style={{ float: 'right', width: '80%' }} className={sessionTimeoutStyle}>
          {this.textForAuthStrategy(authenticationConfig.strategy)}
        </span>
      </Modal>
    );
  }

  private textForAuthStrategy = (_strategy: AuthStrategy) => {
    const line1 =
      this.props.timeOutCountDown <= 0
        ? $t('login.sessionHasExpired', 'Your session has expired.')
        : `${$t('login.sessionExpireIn', 'Your session will expire in ')} ${this.props.timeOutCountDown.toFixed()} ${$t(
            'seconds'
          )}.`;

    const line2 = $t('login.failed.retry', 'You will need to re-login. Please save your changes, if any.');

    return (
      <>
        {line1}
        <br />
        {line2}
      </>
    );
  };
}
