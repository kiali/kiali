import * as React from 'react';
import { Alert } from 'patternfly-react';
import IstioRuleListComponent from './IstioRuleListComponent';

type IstioRuleListState = {
  alertVisible: boolean;
  alertDetails: string;
};

type IstioRuleListProps = {
  // none yet
};

class IstioRuleListPage extends React.Component<IstioRuleListProps, IstioRuleListState> {
  constructor(props: IstioRuleListProps) {
    super(props);

    this.dismissAlert = this.dismissAlert.bind(this);
    this.handleError = this.handleError.bind(this);
    this.state = {
      alertVisible: false,
      alertDetails: ''
    };
  }

  handleError(error: string) {
    this.setState({ alertVisible: true, alertDetails: error });
  }

  dismissAlert() {
    this.setState({ alertVisible: false });
  }

  render() {
    let alertsDiv = <div />;
    if (this.state.alertVisible) {
      alertsDiv = (
        <div>
          <Alert onDismiss={this.dismissAlert}>{this.state.alertDetails.toString()}</Alert>
        </div>
      );
    }
    return (
      <div className="container-fluid container-pf-nav-pf-vertical">
        <h2>Istio Mixer Rules</h2>
        {alertsDiv}
        <IstioRuleListComponent onError={this.handleError} />
      </div>
    );
  }
}

export default IstioRuleListPage;
