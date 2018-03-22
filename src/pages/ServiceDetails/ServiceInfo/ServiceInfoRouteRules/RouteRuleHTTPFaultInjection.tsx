import * as React from 'react';
import { HTTPFaultInjection } from '../../../../types/ServiceInfo';

interface RouteRuleHTTPFaultInjectionProps {
  httpFault: HTTPFaultInjection;
}

class RouteRuleHTTPFaultInjection extends React.Component<RouteRuleHTTPFaultInjectionProps> {
  constructor(props: RouteRuleHTTPFaultInjectionProps) {
    super(props);
  }

  render() {
    let delay;
    if (this.props.httpFault.delay) {
      let percent;
      if (this.props.httpFault.delay.percent) {
        percent = <li>[percent] {this.props.httpFault.delay.percent}</li>;
      }
      let fixedDelay;
      if (this.props.httpFault.delay.fixedDelay) {
        fixedDelay = <li>[fixedDelay] {this.props.httpFault.delay.fixedDelay}</li>;
      }
      let exponentialDelay;
      if (this.props.httpFault.delay.exponentialDelay) {
        exponentialDelay = <li>[exponentialDelay] {this.props.httpFault.delay.exponentialDelay}</li>;
      }
      let overrideHeaderName;
      if (this.props.httpFault.delay.overrideHeaderName) {
        overrideHeaderName = <li>[overrideHeaderName] {this.props.httpFault.delay.overrideHeaderName}</li>;
      }
      delay = (
        <li>
          <strong>Delay</strong>
          <ul style={{ listStyleType: 'none' }}>
            {percent}
            {fixedDelay}
            {exponentialDelay}
            {overrideHeaderName}
          </ul>
        </li>
      );
    }

    let abort;
    if (this.props.httpFault.abort) {
      let percent;
      if (this.props.httpFault.abort.percent) {
        percent = <li>[percent] {this.props.httpFault.abort.percent}</li>;
      }
      let grpcStatus;
      if (this.props.httpFault.abort.grpcStatus) {
        grpcStatus = <li>[grpcStatus] {this.props.httpFault.abort.grpcStatus}</li>;
      }
      let http2Error;
      if (this.props.httpFault.abort.http2Error) {
        http2Error = <li>[http2Error] {this.props.httpFault.abort.http2Error}</li>;
      }
      let httpStatus;
      if (this.props.httpFault.abort.httpStatus) {
        httpStatus = <li>[httpStatus] {this.props.httpFault.abort.httpStatus}</li>;
      }
      let overrideHeaderName;
      if (this.props.httpFault.abort.overrideHeaderName) {
        overrideHeaderName = <li>[overrideHeaderName] {this.props.httpFault.abort.overrideHeaderName}</li>;
      }
      abort = (
        <li>
          <strong>Abort</strong>
          <ul style={{ listStyleType: 'none' }}>
            {percent}
            {grpcStatus}
            {http2Error}
            {httpStatus}
            {overrideHeaderName}
          </ul>
        </li>
      );
    }

    return (
      <div>
        <strong>HTTP Fault</strong>:
        <ul style={{ listStyleType: 'none' }}>
          {delay}
          {abort}
        </ul>
      </div>
    );
  }
}

export default RouteRuleHTTPFaultInjection;
