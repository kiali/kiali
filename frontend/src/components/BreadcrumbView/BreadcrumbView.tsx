import * as React from 'react';
import { isMultiCluster, Paths } from '../../config';
import { Link } from 'react-router-dom-v5-compat';
import { Breadcrumb, BreadcrumbItem } from '@patternfly/react-core';
import { FilterSelected } from '../Filters/StatefulFilters';
import { dicIstioType } from '../../types/IstioConfigList';
import { HistoryManager } from '../../app/History';

interface BreadCumbViewProps {
  location: {
    pathname: string;
    search: string;
  };
}

interface BreadcrumbViewState {
  cluster?: string;
  istioType?: string;
  item: string;
  itemName: string;
  namespace: string;
  pathItem: string;
}

const ItemNames = {
  applications: 'App',
  services: 'Service',
  workloads: 'Workload',
  istio: 'Istio Object'
};

const IstioName = 'Istio Config';
const namespaceRegex = /namespaces\/([a-z0-9-]+)\/([\w-.]+)\/([\w-.*]+)(\/([\w-.]+))?(\/([\w-.]+))?/;

export class BreadcrumbView extends React.Component<BreadCumbViewProps, BreadcrumbViewState> {
  static capitalize = (str: string): string => {
    return str.charAt(0).toUpperCase() + str.slice(1);
  };

  static istioType(rawType: string): string {
    const istioType = Object.keys(dicIstioType).find(key => dicIstioType[key] === rawType);
    return istioType ? istioType : this.capitalize(rawType);
  }

  constructor(props: BreadCumbViewProps) {
    super(props);
    this.state = this.updateItem();
  }

  updateItem = (): BreadcrumbViewState => {
    const match = this.props.location.pathname.match(namespaceRegex) || [];
    const ns = match[1];
    const page = Paths[match[2].toUpperCase()];
    const istioType = match[3];
    const urlParams = new URLSearchParams(this.props.location.search);
    let itemName = page !== 'istio' ? match[3] : match[5];

    return {
      cluster: HistoryManager.getClusterName(urlParams),
      istioType: istioType,
      item: itemName,
      itemName: ItemNames[page],
      namespace: ns,
      pathItem: page
    };
  };

  componentDidUpdate(
    prevProps: Readonly<BreadCumbViewProps>,
    _prevState: Readonly<BreadcrumbViewState>,
    _snapshot?: any
  ): void {
    if (prevProps.location !== this.props.location) {
      this.setState(this.updateItem());
    }
  }

  cleanFilters = (): void => {
    FilterSelected.resetFilters();
  };

  isIstio = (): boolean => {
    return this.state.pathItem === 'istio';
  };

  getItemPage = (): string => {
    let path = `/namespaces/${this.state.namespace}/${this.state.pathItem}/${this.state.item}`;

    if (this.state.cluster && isMultiCluster) {
      path += `?clusterName=${this.state.cluster}`;
    }

    return path;
  };

  render(): React.ReactNode {
    const { namespace, item, istioType, pathItem } = this.state;
    const isIstio = this.isIstio();

    const linkItem = isIstio ? (
      <BreadcrumbItem isActive={true}>{item}</BreadcrumbItem>
    ) : (
      <BreadcrumbItem isActive={true}>
        <Link to={this.getItemPage()} onClick={this.cleanFilters}>
          {item}
        </Link>
      </BreadcrumbItem>
    );

    return (
      <Breadcrumb>
        <BreadcrumbItem>
          <Link to={`/${pathItem}`} onClick={this.cleanFilters}>
            {isIstio ? IstioName : BreadcrumbView.capitalize(pathItem)}
          </Link>
        </BreadcrumbItem>

        <BreadcrumbItem>
          <Link to={`/${pathItem}?namespaces=${namespace}`} onClick={this.cleanFilters}>
            Namespace: {namespace}
          </Link>
        </BreadcrumbItem>

        {isIstio && (
          <BreadcrumbItem>
            <Link
              to={`/${pathItem}?namespaces=${namespace}&type=${dicIstioType[this.state.istioType || '']}`}
              onClick={this.cleanFilters}
            >
              {istioType ? BreadcrumbView.istioType(istioType) : istioType}
            </Link>
          </BreadcrumbItem>
        )}

        {linkItem}
      </Breadcrumb>
    );
  }
}
