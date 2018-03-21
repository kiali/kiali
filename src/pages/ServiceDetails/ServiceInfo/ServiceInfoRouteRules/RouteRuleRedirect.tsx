import * as React from 'react';
import { HTTPRedirect } from '../../../../types/ServiceInfo';

interface RouteRuleRedirectProps {
  redirect: HTTPRedirect;
}

class RouteRuleRedirect extends React.Component<RouteRuleRedirectProps> {
  constructor(props: RouteRuleRedirectProps) {
    super(props);
  }

  render() {
    let uri;
    if (this.props.redirect.uri) {
      uri = <li>[uri] {this.props.redirect.uri}</li>;
    }

    let authority;
    if (this.props.redirect.authority) {
      authority = <li>[authority] {this.props.redirect.authority}</li>;
    }

    return (
      <div>
        <strong>Redirect</strong>:
        <ul style={{ listStyleType: 'none' }}>
          {uri}
          {authority}
        </ul>
      </div>
    );
  }
}

export default RouteRuleRedirect;
