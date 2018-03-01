import * as React from 'react';
import { Icon } from 'patternfly-react';

interface CardProps {
  iconType?: string;
  iconName?: string;
  title?: string;
  items?: any;
}

class ServiceInfoCard extends React.Component<CardProps> {
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
          </h2>
        </div>
        <div className="card-pf-body">{this.props.items}</div>
      </div>
    );
  }
}

export default ServiceInfoCard;
