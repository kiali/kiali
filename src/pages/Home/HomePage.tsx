import * as React from 'react';
import { RouteComponentProps } from 'react-router-dom';

const logo = require('../../logo.svg');

interface HomeState {
  alertVisible: boolean;
}

class HomePage extends React.Component<RouteComponentProps<any>, HomeState> {
  constructor(props: any) {
    super(props);

    console.log('Starting HomePage');
    this.state = {
      alertVisible: true
    };
  }

  dismissSuccess() {
    this.setState({ alertVisible: false });
  }

  render() {
    return (
      <div>
        <div className="container-fluid container-pf-nav-pf-vertical">
          <div className="page-header">
            <h2>Home Page</h2>
          </div>
          <div className="App-body">
            <div className="App-intro">
              <img src={logo} className="App-logo" alt="logo" />
              <h2>Welcome to SWS UI</h2>
            </div>
          </div>
        </div>
      </div>
    );
  }
}

export default HomePage;
