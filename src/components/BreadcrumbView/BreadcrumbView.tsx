import * as React from 'react';
import { Paths } from '../../config';
import { Link } from 'react-router-dom';
import { Breadcrumb } from 'patternfly-react';
import { ActiveFilter } from '../../types/Filters';
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
  tab: string;
  istioType?: string;
}

const ItemNames = {
  applications: 'App',
  services: 'Service',
  workloads: 'Workload',
  istio: 'Istio Object'
};

const IstioName = 'Istio Config';
const ISTIO_TYPES = ['templates', 'adapters'];

export class BreadcrumbView extends React.Component<BreadCumbViewProps, BreadCumbViewState> {
  static capitalize = (str: string) => {
    return str.charAt(0).toUpperCase() + str.slice(1);
  };

  static getTab = (location: string) => {
    const urlParams = new URLSearchParams(location);
    switch (urlParams.get('tab')) {
      case 'info':
        return 'Info';
        break;
      case 'metrics':
        return 'Metrics';
        break;
      case 'in_metrics':
        return 'Inbound Metrics';
        break;
      case 'out_metrics':
        return 'Outbound Metrics';
        break;
      default:
        return 'Info';
    }
  };

  constructor(props: BreadCumbViewProps) {
    super(props);
    this.state = this.updateItem();
  }

  updateItem = () => {
    const namespaceRegex = /namespaces\/([a-z0-9\-]+)\/([a-z0-9\-]+)\/([a-z0-9\-]+)(\/([a-z0-9\-]+))?(\/([a-z0-9\-]+))?/;
    const match = this.props.location.pathname.match(namespaceRegex) || [];
    const ns = match[1];
    const page = Paths[match[2].toUpperCase()];
    const istioType = match[3];
    let itemName = match[3];
    if (page === 'istio') {
      ISTIO_TYPES.includes(istioType) ? (itemName = match[7]) : (itemName = match[5]);
    }
    return {
      namespace: ns,
      pathItem: page,
      item: itemName,
      itemName: ItemNames[page],
      istioType: istioType,
      tab: BreadcrumbView.getTab(this.props.location.search)
    };
  };

  componentDidUpdate(
    prevProps: Readonly<BreadCumbViewProps>,
    prevState: Readonly<BreadCumbViewState>,
    snapshot?: any
  ): void {
    if (prevProps.location !== this.props.location) {
      this.setState(this.updateItem());
    }
  }

  cleanFilters = () => {
    FilterSelected.setSelected([]);
  };

  updateTypeFilter = () => {
    this.cleanFilters();
    // When updateTypeFilter is called, selected filters are already updated with namespace. Just push additional type obj
    const activeFilters: ActiveFilter[] = FilterSelected.getSelected();
    activeFilters.push({
      category: 'Istio Type',
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
    const { namespace, tab, itemName, item, istioType, pathItem } = this.state;
    const isIstio = this.isIstio();
    const linkItem = isIstio ? (
      <Breadcrumb.Item componentClass="span" active={true}>
        {itemName}: {item}
      </Breadcrumb.Item>
    ) : (
      <Breadcrumb.Item componentClass="span">
        <Link to={this.getItemPage()} onClick={this.cleanFilters}>
          {itemName}: {item}
        </Link>
      </Breadcrumb.Item>
    );
    return (
      <Breadcrumb title={true}>
        <Breadcrumb.Item componentClass="span">
          <Link to={`/${pathItem}`} onClick={this.cleanFilters}>
            {isIstio ? IstioName : BreadcrumbView.capitalize(pathItem)}
          </Link>
        </Breadcrumb.Item>
        <Breadcrumb.Item componentClass="span">
          <Link to={`/${pathItem}?namespaces=${namespace}`} onClick={this.cleanFilters}>
            Namespace: {namespace}
          </Link>
        </Breadcrumb.Item>
        {isIstio && (
          <Breadcrumb.Item componentClass="span">
            <Link to={`/${pathItem}?namespaces=${namespace}`} onClick={this.updateTypeFilter}>
              {itemName} Type: {istioType}
            </Link>
          </Breadcrumb.Item>
        )}
        {linkItem}
        {!isIstio && (
          <Breadcrumb.Item active={true}>
            {itemName} {tab}
          </Breadcrumb.Item>
        )}
      </Breadcrumb>
    );
  }
}

export default BreadcrumbView;
