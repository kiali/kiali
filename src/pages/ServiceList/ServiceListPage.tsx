import * as React from 'react';

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
          <h2>Welcome to SWS UI</h2>
        </div>
        <div className="App-body">
          <div className="App-intro">
            <h2>Service List Page</h2>
          </div>
        </div>
      </div>
    );
  }
}

export default ServiceListPage;
