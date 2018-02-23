import * as React from 'react';
type ServiceGraphState = {
  alertVisible: boolean;
};

type ServiceGraphProps = {
  // none yet
};

class ServiceGraphPage extends React.Component<ServiceGraphProps, ServiceGraphState> {
  constructor(props: ServiceGraphProps) {
    super(props);

    console.log('Starting ServiceGraphPage');
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
          <h2>Service Graph</h2>
        </div>
        <div className="App-body">
          <div className="App-intro">
            <h2>Services Graph Page</h2>
          </div>
        </div>
      </div>
    );
  }
}

export default ServiceGraphPage;
