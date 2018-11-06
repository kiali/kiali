import * as React from 'react';
import { Link } from 'react-router-dom';
import { FilterSelected } from '../Filters/StatefulFilters';
import history from '../../app/History';
import NamespaceFilter from '../Filters/NamespaceFilter';

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
  static navigateTo(target: TargetPage, namespace?: string) {
    const info = ListPageLink.buildLinkInfo(target, namespace);
    info.updateFilters();
    history.push(info.to);
  }

  private static buildLinkInfo(target: TargetPage, namespace?: string) {
    if (namespace) {
      return {
        to: `/${target}?namespace=${encodeURIComponent(namespace)}`,
        updateFilters: () => {
          FilterSelected.setSelected([
            {
              category: NamespaceFilter.category,
              value: namespace
            }
          ]);
        }
      };
    }
    return {
      to: `/${target}`,
      updateFilters: () => {
        FilterSelected.setSelected([]);
      }
    };
  }

  constructor(props: Props) {
    super(props);
  }

  render() {
    const info = ListPageLink.buildLinkInfo(this.props.target, this.props.namespace);
    const onClick = () => {
      info.updateFilters();
      if (this.props.onClick) {
        this.props.onClick();
      }
    };
    return (
      <Link to={info.to} title={this.props.title} onClick={onClick}>
        {this.props.children}
      </Link>
    );
  }
}
