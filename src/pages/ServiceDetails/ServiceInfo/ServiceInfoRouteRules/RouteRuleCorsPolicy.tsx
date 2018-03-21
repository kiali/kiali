import * as React from 'react';
import { CorsPolicy } from '../../../../types/ServiceInfo';

interface RouteRuleCorsPolicyProps {
  corsPolicy: CorsPolicy;
}

class RouteRuleCorsPolicy extends React.Component<RouteRuleCorsPolicyProps> {
  constructor(props: RouteRuleCorsPolicyProps) {
    super(props);
  }

  render() {
    let allowOrigin;
    if (this.props.corsPolicy.allowOrigin) {
      allowOrigin = <li>[allowOrigin] {this.props.corsPolicy.allowOrigin.join(',')}</li>;
    }

    let allowMethods;
    if (this.props.corsPolicy.allowMethods) {
      allowMethods = <li>[allowMethods] {this.props.corsPolicy.allowMethods.join(',')}</li>;
    }

    let allowHeaders;
    if (this.props.corsPolicy.allowHeaders) {
      allowHeaders = <li>[allowHeaders] {this.props.corsPolicy.allowHeaders.join(',')}</li>;
    }

    let exposeHeaders;
    if (this.props.corsPolicy.exposeHeaders) {
      exposeHeaders = <li>[exposeHeaders] {this.props.corsPolicy.exposeHeaders.join(',')}</li>;
    }

    let maxAge;
    if (this.props.corsPolicy.maxAge) {
      maxAge = <li>[maxAge] {this.props.corsPolicy.maxAge}</li>;
    }

    let allowCredentials;
    if (this.props.corsPolicy.allowCredentials) {
      allowCredentials = <li>[allowCredentials] {this.props.corsPolicy.allowCredentials}</li>;
    }

    return (
      <div>
        <strong>Cors Policy</strong>:
        <ul style={{ listStyleType: 'none' }}>
          {allowOrigin}
          {allowMethods}
          {allowHeaders}
          {exposeHeaders}
          {maxAge}
          {allowCredentials}
        </ul>
      </div>
    );
  }
}

export default RouteRuleCorsPolicy;
