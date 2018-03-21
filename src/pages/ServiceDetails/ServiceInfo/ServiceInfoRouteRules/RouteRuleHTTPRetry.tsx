import * as React from 'react';
import { HTTPRetry } from '../../../../types/ServiceInfo';

interface RouteRuleHTTPRetryProps {
  httpReqRetries: HTTPRetry;
}

class RouteRuleHTTPRetry extends React.Component<RouteRuleHTTPRetryProps> {
  constructor(props: RouteRuleHTTPRetryProps) {
    super(props);
  }

  render() {
    let attempts;
    let perTryTimeout;
    let overrideHeaderName;
    if (this.props.httpReqRetries.simpleRetry) {
      if (this.props.httpReqRetries.simpleRetry.attempts) {
        attempts = <li>[timeout] {this.props.httpReqRetries.simpleRetry.attempts}</li>;
      }
      if (this.props.httpReqRetries.simpleRetry.perTryTimeout) {
        perTryTimeout = <li>[perTryTimeout] {this.props.httpReqRetries.simpleRetry.perTryTimeout}</li>;
      }
      if (this.props.httpReqRetries.simpleRetry.overrideHeaderName) {
        overrideHeaderName = <li>[overrideHeaderName] {this.props.httpReqRetries.simpleRetry.overrideHeaderName}</li>;
      }
    }

    let custom;
    if (this.props.httpReqRetries.custom) {
      custom = <li>[custom] {this.props.httpReqRetries.custom}</li>;
    }

    return (
      <div>
        <strong>HTTP Retry</strong>:
        <ul style={{ listStyleType: 'none' }}>
          {attempts}
          {perTryTimeout}
          {overrideHeaderName}
          {custom}
        </ul>
      </div>
    );
  }
}

export default RouteRuleHTTPRetry;
