import * as React from 'react';
import ServiceListComponent from './ServiceListComponent';
import ServiceFilter from './ServiceFilter';
import ServicePagination from './ServicePagination';

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
        <h2>Services</h2>
        <ServiceFilter />
        <ServiceListComponent />
        <ServicePagination />
      </div>
    );
  }
}

export default ServiceListPage;
