import * as React from 'react';
import Iframe from 'react-iframe';
import * as API from '../../services/Api';
import { EmptyState, EmptyStateTitle, EmptyStateIcon } from 'patternfly-react';
import * as MessageCenter from '../../utils/MessageCenter';

type ServiceJaegerState = {
  height: string;
  width: string;
  jaegerURL: string;
  error: boolean;
};

const EmptyStatePage = () => (
  <>
    <h2>Distributed Tracing</h2>
    <EmptyState>
      <EmptyStateIcon name="info" />
      <EmptyStateTitle>
        Distributed Tracing is not available.
        <br />
        This could mean that we couldn't communicate to the service.
      </EmptyStateTitle>
    </EmptyState>
  </>
);

class ServiceJaegerPage extends React.Component<{}, ServiceJaegerState> {
  constructor(props: {}) {
    super(props);
    this.state = { width: '0 px', jaegerURL: '', height: '0 px', error: false };
    this.updateWindowDimensions = this.updateWindowDimensions.bind(this);
  }

  componentDidMount() {
    this.updateWindowDimensions();
    window.addEventListener('resize', this.updateWindowDimensions);

    API.getJaegerInfo()
      .then(response => {
        let data = response['data'];
        this.setState({
          jaegerURL: data.url
        });
      })
      .catch(error => {
        MessageCenter.add(API.getErrorMsg('Could not fetch Jaeger info', error));
        this.setState({ error: true });
        console.log(error);
      });
  }

  componentWillUnmount() {
    window.removeEventListener('resize', this.updateWindowDimensions);
  }

  updateWindowDimensions() {
    this.setState({ width: window.innerWidth - 300 + 'px', height: window.innerHeight - 100 + 'px' });
  }

  render() {
    return (
      <div className="container-fluid container-pf-nav-pf-vertical">
        {this.state.error ? <EmptyStatePage /> : null}
        <div className="container-fluid container-cards-pf">
          <Iframe
            url={this.state.jaegerURL}
            width={this.state.width}
            height={this.state.height}
            id="jaegerUI"
            display="block"
            allowFullScreen={true}
            style={{ verticalOverflow: false }}
          />
        </div>
      </div>
    );
  }
}

export default ServiceJaegerPage;
