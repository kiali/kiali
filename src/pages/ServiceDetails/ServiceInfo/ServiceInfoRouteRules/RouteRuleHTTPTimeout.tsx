import * as React from 'react';
import { HTTPTimeout } from '../../../../types/ServiceInfo';

interface RouteRuleHTTPTimeoutProps {
  timeout: HTTPTimeout;
}

class RouteRuleHTTPTimeout extends React.Component<RouteRuleHTTPTimeoutProps> {
  constructor(props: RouteRuleHTTPTimeoutProps) {
    super(props);
  }

  render() {
    let timeout;
    let overrideHeaderName;
    if (this.props.timeout.simpleTimeout) {
      if (this.props.timeout.simpleTimeout.timeout) {
        timeout = <li>[timeout] {this.props.timeout.simpleTimeout.timeout}</li>;
      }
      if (this.props.timeout.simpleTimeout.overrideHeaderName) {
        overrideHeaderName = <li>[overrideHeaderName] {this.props.timeout.simpleTimeout.overrideHeaderName}</li>;
      }
    }

    let custom;
    if (this.props.timeout.custom) {
      custom = <li>[custom] {this.props.timeout.custom}</li>;
    }

    return (
      <div>
        <strong>HTTP Timeout</strong>:
        <ul style={{ listStyleType: 'none' }}>
          {timeout}
          {overrideHeaderName}
          {custom}
        </ul>
      </div>
    );
  }
}

export default RouteRuleHTTPTimeout;
