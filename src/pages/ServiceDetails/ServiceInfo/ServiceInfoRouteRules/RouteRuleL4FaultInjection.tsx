import * as React from 'react';
import { L4FaultInjection } from '../../../../types/ServiceInfo';

interface RouteRuleL4FaultInjectionProps {
  l4Fault: L4FaultInjection;
}

class RouteRuleL4FaultInjection extends React.Component<RouteRuleL4FaultInjectionProps> {
  constructor(props: RouteRuleL4FaultInjectionProps) {
    super(props);
  }

  render() {
    let throttle;
    if (this.props.l4Fault.throttle) {
      let percent;
      if (this.props.l4Fault.throttle.percent) {
        percent = <li>[percent] {this.props.l4Fault.throttle.percent}</li>;
      }
      let downstreamLimitBps;
      if (this.props.l4Fault.throttle.downstreamLimitBps) {
        downstreamLimitBps = <li>[downstreamLimitBps] {this.props.l4Fault.throttle.downstreamLimitBps}</li>;
      }
      let upstreamLimitBps;
      if (this.props.l4Fault.throttle.upstreamLimitBps) {
        upstreamLimitBps = <li>[upstreamLimitBps] {this.props.l4Fault.throttle.upstreamLimitBps}</li>;
      }
      let throttleAfterPeriod;
      if (this.props.l4Fault.throttle.throttleAfterPeriod) {
        throttleAfterPeriod = <li>[throttleAfterPeriod] {this.props.l4Fault.throttle.throttleAfterPeriod}</li>;
      }
      let throttleAfterBytes;
      if (this.props.l4Fault.throttle.throttleAfterBytes) {
        throttleAfterBytes = <li>[throttleAfterBytes] {this.props.l4Fault.throttle.throttleAfterBytes}</li>;
      }
      let throttleForPeriod;
      if (this.props.l4Fault.throttle.throttleForPeriod) {
        throttleForPeriod = <li>[throttleForPeriod] {this.props.l4Fault.throttle.throttleForPeriod}</li>;
      }
      throttle = (
        <li>
          <strong>Throttle</strong>
          <ul style={{ listStyleType: 'none' }}>
            {percent}
            {downstreamLimitBps}
            {upstreamLimitBps}
            {throttleAfterPeriod}
            {throttleAfterBytes}
            {throttleForPeriod}
          </ul>
        </li>
      );
    }

    let terminate;
    if (this.props.l4Fault.terminate) {
      let percent;
      if (this.props.l4Fault.terminate.percent) {
        percent = <li>[percent] {this.props.l4Fault.terminate.percent}</li>;
      }
      let terminateAfterPeriod;
      if (this.props.l4Fault.terminate.terminateAfterPeriod) {
        terminateAfterPeriod = <li>[terminateAfterPeriod] {this.props.l4Fault.terminate.terminateAfterPeriod}</li>;
      }

      terminate = (
        <li>
          <strong>Terminate</strong>
          <ul style={{ listStyleType: 'none' }}>
            {percent}
            {terminateAfterPeriod}
          </ul>
        </li>
      );
    }

    return (
      <div>
        <strong>L4 Fault</strong>:
        <ul style={{ listStyleType: 'none' }}>
          {throttle}
          {terminate}
        </ul>
      </div>
    );
  }
}

export default RouteRuleL4FaultInjection;
