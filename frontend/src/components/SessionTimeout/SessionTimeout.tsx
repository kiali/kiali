import * as React from 'react';
import { Modal, Button, ButtonVariant } from '@patternfly/react-core';
import { WarningTriangleIcon } from '@patternfly/react-icons';
import { AuthStrategy } from '../../types/Auth';
import { LoginSession } from '../../store/Store';
import authenticationConfig from '../../config/AuthenticationConfig';
import { PFColors } from 'components/Pf/PfColors';

type SessionTimeoutProps = {
  onLogout: () => void;
  onExtendSession: (session: LoginSession) => void;
  onDismiss: () => void;
  show: boolean;
  timeOutCountDown: number;
};

export class SessionTimeout extends React.Component<SessionTimeoutProps, {}> {
  render() {
    const defaultAction = this.props.onDismiss;
    const buttons = [
      <Button autoFocus={true} variant={ButtonVariant.primary} onClick={this.props.onDismiss}>
        OK
      </Button>,
      <Button key="confirm" variant={ButtonVariant.secondary} onClick={this.props.onLogout}>
        Log Out
      </Button>
    ];
    return (
      <Modal isOpen={this.props.show} onClose={defaultAction} actions={buttons} title={'Session Timeout'} width={'40%'}>
        <span>
          <WarningTriangleIcon size={'xl'} color={PFColors.Warning} />
        </span>
        <span style={{ float: 'right', width: '80%' }} className={'lead'}>
          {this.textForAuthStrategy(authenticationConfig.strategy)}
        </span>
      </Modal>
    );
  }

  private textForAuthStrategy = (_strategy: AuthStrategy) => {
    const line1 =
      this.props.timeOutCountDown <= 0
        ? 'Your session has expired.'
        : `Your session will expire in ${this.props.timeOutCountDown.toFixed()} seconds.`;

    const line2 = 'You will need to re-login. Please save your changes, if any.';

    return (
      <>
        {line1}
        <br />
        {line2}
      </>
    );
  };
}
