import * as React from 'react';
import { IstioService } from '../../../../types/ServiceInfo';
import ServiceInfoBadge from '../ServiceInfoBadge';

interface RouteRuleIstioServiceProps {
  name: string;
  service: IstioService;
}

class RouteRuleIstioService extends React.Component<RouteRuleIstioServiceProps> {
  constructor(props: RouteRuleIstioServiceProps) {
    super(props);
  }

  render() {
    let name;
    if (this.props.service.name) {
      name = <li>Name{': ' + this.props.service.name}</li>;
    }

    let namespace;
    if (this.props.service.namespace) {
      namespace = <li>Namespace{': ' + this.props.service.namespace}</li>;
    }

    let domain;
    if (this.props.service.domain) {
      domain = <li>Domain{': ' + this.props.service.domain}</li>;
    }

    let service;
    if (this.props.service.service) {
      service = <li>Service{': ' + this.props.service.service}</li>;
    }

    let labels;
    if (this.props.service.labels) {
      labels = (
        <li>
          <ul style={{ listStyleType: 'none' }}>
            {Object.keys(this.props.service.labels || new Map()).map((key, n) => (
              <li key={'route_label_' + this.props.name + '_n_' + n}>
                <ServiceInfoBadge
                  scale={0.8}
                  style="plastic"
                  color="green"
                  leftText={key}
                  rightText={this.props.service.labels ? this.props.service.labels[key] : ''}
                />
              </li>
            ))}
          </ul>
        </li>
      );
    }

    return (
      <div>
        <strong>{this.props.name}</strong>:
        <ul style={{ listStyleType: 'none' }}>
          {name}
          {namespace}
          {domain}
          {service}
          {labels}
        </ul>
      </div>
    );
  }
}

export default RouteRuleIstioService;
