import * as React from 'react';
import { Icon } from 'patternfly-react';
import MissingSidecar from '../../components/MissingSidecar/MissingSidecar';
import { Link } from 'react-router-dom';

interface CardProps {
  iconType?: string;
  iconName?: string;
  title?: string;
  items?: any;
  istio?: boolean;
  showOnGraphLink?: string;
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
            {this.props.title && this.props.istio !== undefined && !this.props.istio && (
              <span style={{ marginLeft: '10px' }}>
                <MissingSidecar />
              </span>
            )}
            {this.props.title && this.props.showOnGraphLink && (
              <>
                {'  '}(<Link to={this.props.showOnGraphLink}>Show on graph</Link>)
              </>
            )}
          </h2>
        </div>
        <div className="card-pf-body">{this.props.items}</div>
      </div>
    );
  }
}

export default PfInfoCard;
