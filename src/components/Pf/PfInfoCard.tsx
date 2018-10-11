import * as React from 'react';
import { Icon } from 'patternfly-react';
import { IstioLogo } from '../../logos';

interface CardProps {
  iconType?: string;
  iconName?: string;
  title?: string;
  items?: any;
  istio?: boolean;
}

class PfInfoCard extends React.Component<CardProps> {
  constructor(props: CardProps) {
    super(props);
  }

  istoIcon() {
    let istioElement;
    if (this.props.istio) {
      istioElement = <img className="IstioLogo" src={IstioLogo} alt="Istio sidecar" />;
    }

    return istioElement;
  }

  render() {
    return (
      <div className="card-pf">
        <div className="card-pf-heading">
          <h2 className="card-pf-title">
            <Icon type={this.props.iconType} name={this.props.iconName} style={{ marginRight: '10px' }} />
            {this.istoIcon()}
            {this.props.title}
          </h2>
        </div>
        <div className="card-pf-body">{this.props.items}</div>
      </div>
    );
  }
}

export default PfInfoCard;
