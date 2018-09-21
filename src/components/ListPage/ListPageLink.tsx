import * as React from 'react';
import { Link } from 'react-router-dom';
import { FilterSelected } from '../Filters/StatefulFilters';

export enum TargetPage {
  APPLICATIONS = 'applications',
  SERVICES = 'services',
  WORKLOADS = 'workloads',
  ISTIO = 'istio'
}

type Props = {
  namespace?: string;
  title?: string;
  target: TargetPage;
  onClick?: () => void;
};

export class ListPageLink extends React.PureComponent<Props, {}> {
  constructor(props: Props) {
    super(props);
  }

  filterNamespace = () => {
    FilterSelected.setSelected([
      {
        category: 'Namespace',
        value: this.props.namespace!
      }
    ]);
    if (this.props.onClick) {
      this.props.onClick();
    }
  };

  clearNamespace = () => {
    FilterSelected.setSelected([]);
    if (this.props.onClick) {
      this.props.onClick();
    }
  };

  render() {
    if (this.props.namespace) {
      return (
        <Link
          to={`/${this.props.target}?namespace=${encodeURIComponent(this.props.namespace)}`}
          title={this.props.title}
          onClick={this.filterNamespace}
        >
          {this.props.children}
        </Link>
      );
    } else {
      return (
        <Link to={`/${this.props.target}`} title={this.props.title} onClick={this.clearNamespace}>
          {this.props.children}
        </Link>
      );
    }
  }
}
