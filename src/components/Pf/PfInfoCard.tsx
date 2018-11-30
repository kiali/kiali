import * as React from 'react';
import { Icon } from 'patternfly-react';
import MissingSidecar from '../../components/MissingSidecar/MissingSidecar';

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

  render() {
    return (
      <div className="card-pf">
        <div className="card-pf-heading">
          <h2 className="card-pf-title">
            <Icon type={this.props.iconType} name={this.props.iconName} style={{ marginRight: '10px' }} />
            {this.props.title}
            {!this.props.istio && (
              <span style={{ marginLeft: '10px' }}>
                <MissingSidecar />
              </span>
            )}
          </h2>
        </div>
        <div className="card-pf-body">{this.props.items}</div>
      </div>
    );
  }
}

export default PfInfoCard;
