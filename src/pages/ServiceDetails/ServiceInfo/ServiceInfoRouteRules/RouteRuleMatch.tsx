import * as React from 'react';
import { MatchCondition } from '../../../../types/ServiceInfo';
import RouteRuleIstioService from './RouteRuleIstioService';

interface RouteRuleMatchProps {
  match: MatchCondition;
}

class RouteRuleMatch extends React.Component<RouteRuleMatchProps> {
  constructor(props: RouteRuleMatchProps) {
    super(props);
  }

  render() {
    let source;
    if (this.props.match.source) {
      source = (
        <li>
          <RouteRuleIstioService name="Source" service={this.props.match.source} />
        </li>
      );
    }

    let tcp;
    if (this.props.match.tcp) {
      tcp = (
        <li>
          <div>
            <strong>TCP source</strong>
            {': ' + this.props.match.tcp.sourceSubnet.join(',')}
          </div>
          <div>
            <strong>TCP destination</strong>
            {': ' + this.props.match.tcp.destinationSubnet.join(', ')}
          </div>
        </li>
      );
    }

    let udp;
    if (this.props.match.udp) {
      udp = (
        <li>
          <div>
            <strong>UDP source</strong>
            {': ' + this.props.match.udp.sourceSubnet.join(',')}
          </div>
          <div>
            <strong>UDP destination</strong>
            {': ' + this.props.match.udp.destinationSubnet.join(', ')}
          </div>
        </li>
      );
    }

    let request;
    if (this.props.match.request) {
      let headers: any = [];
      Object.keys(this.props.match.request.headers || new Map()).forEach((key, u) => {
        let match;
        if (this.props.match.request) {
          let sMatch = this.props.match.request.headers[key];
          match = (
            <div>
              {sMatch.exact ? (
                <div>
                  [exact] {'   '} {sMatch.exact}
                </div>
              ) : null}
              {sMatch.regex ? (
                <div>
                  [regex] {'   '} {sMatch.regex}
                </div>
              ) : null}
              {sMatch.prefix ? (
                <div>
                  [prefix] {'   '} {sMatch.prefix}
                </div>
              ) : null}
            </div>
          );
        }
        headers.push(
          <li key={'request_' + u}>
            <strong>{key}</strong>
            {match}
          </li>
        );
      });
      request = (
        <li>
          <strong>Headers:</strong>
          <ul style={{ listStyleType: 'none' }}>{headers}</ul>
        </li>
      );
    }
    return (
      <div>
        <strong>Match</strong>:
        <ul style={{ listStyleType: 'none' }}>
          {source}
          {tcp}
          {udp}
          {request}
        </ul>
      </div>
    );
  }
}

export default RouteRuleMatch;
