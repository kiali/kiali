import * as React from 'react';
import Iframe from 'react-iframe';
import * as API from '../../services/Api';
import { EmptyState, EmptyStateTitle, EmptyStateIcon } from 'patternfly-react';
import * as MessageCenter from '../../utils/MessageCenter';
import { authentication } from '../../utils/Authentication';
import { RouteComponentProps } from 'react-router-dom';

type ServiceJaegerState = {
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

class ServiceJaegerPage extends React.Component<RouteComponentProps<{}>, ServiceJaegerState> {
  constructor(props: RouteComponentProps<{}>) {
    super(props);
    this.state = { jaegerURL: '', error: false };
  }

  componentDidMount() {
    API.getJaegerInfo(authentication())
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

  render() {
    let frameUrl = this.state.jaegerURL;
    const urlParams = new URLSearchParams(this.props.location.search);

    if (frameUrl.length > 0 && urlParams.has('path')) {
      frameUrl += urlParams.get('path');
    }

    return (
      <>
        {this.state.error ? <EmptyStatePage /> : null}
        <div className="container-fluid container-cards-pf" style={{ height: 'calc(100vh - 100px)' }}>
          <Iframe url={frameUrl} position="inherit" allowFullScreen={true} />
        </div>
      </>
    );
  }
}

export default ServiceJaegerPage;
