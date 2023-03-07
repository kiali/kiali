import * as React from 'react';
import { Alert, AlertProps, AlertActionCloseButton } from '@patternfly/react-core';
import { NotificationMessage } from 'types/MessageCenter';

const DEFAULT_TTLMS = 8000; // PF recommended default

type AlertToastProps = AlertProps & {
  message: NotificationMessage;
  style?: React.CSSProperties;
  ttlms?: number;

  onClose?: () => void;
  onTtl?: () => void;
};

export default class AlertToast extends React.Component<AlertToastProps> {
  ttlTimer: NodeJS.Timeout | undefined;

  componentDidMount() {
    if (this.props.onTtl) {
      this.ttlTimer = setInterval(
        () => {
          this.props.onTtl!();
        },
        this.props.ttlms ? this.props.ttlms : DEFAULT_TTLMS
      );
    }
  }

  componentWillUnmount() {
    if (this.ttlTimer) {
      clearInterval(this.ttlTimer);
    }
  }

  private getAction = () => {
    return this.props.onClose ? <AlertActionCloseButton onClose={this.props.onClose} /> : <></>;
  };
  render() {
    return (
      <Alert
        style={this.props.style ? this.props.style : {}}
        key={this.props.message.id}
        variant={this.props.variant}
        title={this.props.message.content}
        actionClose={this.getAction()}
      />
    );
  }
}
