import * as React from 'react';
import { Link } from 'react-router-dom';
import { FilterSelected } from '../Filters/StatefulFilters';
import history from '../../app/History';
import NamespaceFilter from '../Filters/NamespaceFilter';
import { ActiveFilter } from 'src/types/Filters';
import { healthFilter } from '../Filters/CommonFilters';

export enum TargetPage {
  APPLICATIONS = 'applications',
  SERVICES = 'services',
  WORKLOADS = 'workloads',
  ISTIO = 'istio'
}

type Props = {
  target: TargetPage;
  title?: string;
  namespace?: string;
  health?: string;
  onClick?: () => void;
};

export class ListPageLink extends React.PureComponent<Props, {}> {
  static navigateTo(target: TargetPage, namespace?: string, health?: string) {
    const info = ListPageLink.buildLinkInfo(target, namespace, health);
    info.updateFilters();
    history.push(info.to);
  }

  private static buildLinkInfo(target: TargetPage, namespace?: string, health?: string) {
    const filters: (ActiveFilter & { id: string })[] = [];
    if (namespace) {
      filters.push({
        id: NamespaceFilter.id,
        category: NamespaceFilter.category,
        value: encodeURIComponent(namespace)
      });
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
    const info = ListPageLink.buildLinkInfo(this.props.target, this.props.namespace, this.props.health);
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
