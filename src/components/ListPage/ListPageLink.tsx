import * as React from 'react';
import { Link } from 'react-router-dom';
import { FilterSelected } from '../Filters/StatefulFilters';
import history from '../../app/History';
import NamespaceFilter from '../Filters/NamespaceFilter';
import { ActiveFilter } from '../../types/Filters';
import { healthFilter } from '../Filters/CommonFilters';
import Namespace from '../../types/Namespace';

export enum TargetPage {
  APPLICATIONS = 'applications',
  SERVICES = 'services',
  WORKLOADS = 'workloads',
  ISTIO = 'istio'
}

type Props = {
  target: TargetPage;
  title?: string;
  namespaces?: Namespace[];
  health?: string;
  onClick?: () => void;
};

export class ListPageLink extends React.PureComponent<Props, {}> {
  static navigateTo(target: TargetPage, namespaces?: Namespace[], health?: string) {
    const info = ListPageLink.buildLinkInfo(target, namespaces, health);
    info.updateFilters();
    history.push(info.to);
  }

  private static buildLinkInfo(target: TargetPage, namespaces?: Namespace[], health?: string) {
    const filters: (ActiveFilter & { id: string })[] = [];
    if (namespaces) {
      for (const namespace of namespaces) {
        filters.push({
          id: NamespaceFilter.id,
          category: NamespaceFilter.category,
          value: encodeURIComponent(namespace.name)
        });
      }
    }
    if (health) {
      filters.push({
        id: healthFilter.id,
        category: healthFilter.title,
        value: health
      });
    }
    return {
      to: `/${target}?${filters.map(f => f.id + '=' + f.value).join('&')}`,
      updateFilters: () => FilterSelected.setSelected(filters)
    };
  }

  constructor(props: Props) {
    super(props);
  }

  render() {
    const info = ListPageLink.buildLinkInfo(this.props.target, this.props.namespaces, this.props.health);
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
