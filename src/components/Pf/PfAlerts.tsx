import * as React from 'react';
import { Alert } from 'patternfly-react';

type PfAlertsProps = {
  alerts: string[];
  isVisible: boolean;
  onDismiss?: () => void;
};

export default class PfAlerts extends React.Component<PfAlertsProps> {
  constructor(props: PfAlertsProps) {
    super(props);
  }

  render() {
    if (!this.props.isVisible || this.props.alerts.length === 0) {
      return null;
    }

    let alertsUi: JSX.Element;
    if (this.props.alerts.length === 1) {
      alertsUi = <>{this.props.alerts[0]}</>;
    } else {
      alertsUi = (
        <ul>
          {this.props.alerts.map(alert => {
            return <li key={alert}>{alert}</li>;
          })}
        </ul>
      );
    }

    return <Alert onDismiss={this.dismissAlert}>{alertsUi}</Alert>;
  }

  private dismissAlert = () => {
    if (this.props.onDismiss) {
      this.props.onDismiss();
    }
  };
}
