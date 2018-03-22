import * as React from 'react';
import { HTTPRewrite } from '../../../../types/ServiceInfo';

interface RouteRuleRewriteProps {
  rewrite: HTTPRewrite;
}

class RouteRuleRewrite extends React.Component<RouteRuleRewriteProps> {
  constructor(props: RouteRuleRewriteProps) {
    super(props);
  }

  render() {
    let uri;
    if (this.props.rewrite.uri) {
      uri = <li>[uri] {this.props.rewrite.uri}</li>;
    }

    let authority;
    if (this.props.rewrite.authority) {
      authority = <li>[authority] {this.props.rewrite.authority}</li>;
    }

    return (
      <div>
        <strong>Rewrite</strong>:
        <ul style={{ listStyleType: 'none' }}>
          {uri}
          {authority}
        </ul>
      </div>
    );
  }
}

export default RouteRuleRewrite;
