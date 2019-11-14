import * as React from 'react';
import { Modal, Button } from '@patternfly/react-core';
import { WarningTriangleIcon } from '@patternfly/react-icons';
import { AuthStrategy } from '../../types/Auth';
import { LoginSession } from '../../store/Store';
import * as API from '../../services/Api';
import authenticationConfig from '../../config/AuthenticationConfig';
import { PFAlertColor } from 'components/Pf/PfColors';

type SessionTimeoutProps = {
  onLogout: () => void;
  onExtendSession: (session: LoginSession) => void;
  onDismiss: () => void;
  show: boolean;
  timeOutCountDown: number;
};

export class SessionTimeout extends React.Component<SessionTimeoutProps, {}> {
  render() {
    const defaultAction =
      authenticationConfig.strategy === AuthStrategy.login ? this.extendSessionHandler : this.props.onDismiss;
    const buttons = [
      <Button key="confirm" variant="link" onClick={this.props.onLogout}>
        Log Out
      </Button>,
      authenticationConfig.strategy === AuthStrategy.login ? (
        <Button autoFocus={true} variant="primary" onClick={this.extendSessionHandler}>
          Continue Session
        </Button>
      ) : (
        <Button autoFocus={true} variant="primary" onClick={this.props.onDismiss}>
          OK
        </Button>
      )
    ];
    return (
      <Modal isOpen={this.props.show} onClose={defaultAction} actions={buttons} title={'Session Timeout'} width={'40%'}>
        <span>
          <WarningTriangleIcon size={'xl'} color={PFAlertColor.Warning} />
        </span>
        <span style={{ float: 'right', width: '80%' }} className={'lead'}>
          {this.textForAuthStrategy(authenticationConfig.strategy)}
        </span>
      </Modal>
    );
  }

  private extendSessionHandler = async () => {
    try {
      const session = await API.extendSession();
      this.props.onExtendSession(session.data);
    } catch (err) {
      console.error(err);
    }
  };

  private textForAuthStrategy = (strategy: AuthStrategy) => {
    const line1 =
      this.props.timeOutCountDown <= 0
        ? 'Your session has expired.'
        : `Your session will expire in ${this.props.timeOutCountDown.toFixed()} seconds.`;

    const line2 =
      strategy === AuthStrategy.openshift
        ? 'You will need to re-login with your cluster credentials. Please save your changes, if any.'
        : 'Would you like to extend your session?';

    return (
      <>
        {line1}
        <br />
        {line2}
      </>
    );
  };
}
