import * as React from 'react';
import ServiceListComponent from './ServiceListComponent';

type ServiceListState = {
  alertVisible: boolean;
};

type ServiceListProps = {
  // none yet
};

class ServiceListPage extends React.Component<ServiceListProps, ServiceListState> {
  constructor(props: ServiceListProps) {
    super(props);

    console.log('Starting ServiceListPage');
    this.state = {
      alertVisible: true
    };
  }

  dismissSuccess() {
    this.setState({ alertVisible: false });
  }

  render() {
    return (
      <div className="container-fluid container-pf-nav-pf-vertical">
        <div className="page-header">
          <h2>Services</h2>
        </div>
        <ServiceListComponent />
      </div>
    );
  }
}

export default ServiceListPage;
