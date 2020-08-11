import * as React from 'react';
import { Paths } from '../../config';
import { Link } from 'react-router-dom';
import { Breadcrumb, BreadcrumbItem } from '@patternfly/react-core';
import { ActiveFiltersInfo, DEFAULT_LABEL_OPERATION } from '../../types/Filters';
import { FilterSelected } from '../Filters/StatefulFilters';
import { dicIstioType } from '../../types/IstioConfigList';

interface BreadCumbViewProps {
  location: {
    pathname: string;
    search: string;
  };
}

interface BreadCumbViewState {
  namespace: string;
  itemName: string;
  item: string;
  pathItem: string;
  istioType?: string;
}

const ItemNames = {
  applications: 'App',
  services: 'Service',
  workloads: 'Workload',
  istio: 'Istio Object'
};

const IstioName = 'Istio Config';

export class BreadcrumbView extends React.Component<BreadCumbViewProps, BreadCumbViewState> {
  static capitalize = (str: string) => {
    return str.charAt(0).toUpperCase() + str.slice(1);
  };

  static istioType(rawType: string) {
    const istioType = Object.keys(dicIstioType).find(key => dicIstioType[key] === rawType);
    return istioType ? istioType : this.capitalize(rawType);
  }

  constructor(props: BreadCumbViewProps) {
    super(props);
    this.state = this.updateItem();
  }

  updateItem = () => {
    const namespaceRegex = /namespaces\/([a-z0-9-]+)\/([a-z0-9-]+)\/([a-z0-9-]+)(\/([a-z0-9-.]+))?(\/([a-z0-9-]+))?/;
    const match = this.props.location.pathname.match(namespaceRegex) || [];
    const ns = match[1];
    const page = Paths[match[2].toUpperCase()];
    const istioType = match[3];
    let itemName = page !== 'istio' ? match[3] : match[5];
    return {
      namespace: ns,
      pathItem: page,
      item: itemName,
      itemName: ItemNames[page],
      istioType: istioType
    };
  };

  componentDidUpdate(
    prevProps: Readonly<BreadCumbViewProps>,
    _prevState: Readonly<BreadCumbViewState>,
    _snapshot?: any
  ): void {
    if (prevProps.location !== this.props.location) {
      this.setState(this.updateItem());
    }
  }

  cleanFilters = () => {
    FilterSelected.setSelected({ filters: [], op: DEFAULT_LABEL_OPERATION });
  };

  updateTypeFilter = () => {
    this.cleanFilters();
    // When updateTypeFilter is called, selected filters are already updated with namespace. Just push additional type obj
    const activeFilters: ActiveFiltersInfo = FilterSelected.getSelected();
    activeFilters.filters.push({
      id: 'Istio Type',
      title: 'Istio Type',
      value: dicIstioType[this.state.istioType || '']
    });
    FilterSelected.setSelected(activeFilters);
  };

  isIstio = () => {
    return this.state.pathItem === 'istio';
  };

  getItemPage = () => {
    return `/namespaces/${this.state.namespace}/${this.state.pathItem}/${this.state.item}`;
  };

  render() {
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
            <Link to={`/${pathItem}?namespaces=${namespace}`} onClick={this.updateTypeFilter}>
              {istioType ? BreadcrumbView.istioType(istioType) : istioType}
            </Link>
          </BreadcrumbItem>
        )}
        {linkItem}
      </Breadcrumb>
    );
  }
}

export default BreadcrumbView;
