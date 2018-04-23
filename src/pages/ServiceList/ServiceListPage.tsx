import * as React from 'react';
import { Alert } from 'patternfly-react';
import ServiceListComponent from './ServiceListComponent';

type ServiceListState = {
  alertVisible: boolean;
  alertDetails: string;
};

type ServiceListProps = {
  // none yet
};

class ServiceListPage extends React.Component<ServiceListProps, ServiceListState> {
  constructor(props: ServiceListProps) {
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
        <h2>Services</h2>
        {alertsDiv}
        <ServiceListComponent onError={this.handleError} />
      </div>
    );
  }
}

export default ServiceListPage;
