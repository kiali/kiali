import * as React from 'react';
import { isMultiCluster, Paths } from '../../config';
import { Link, useLocation } from 'react-router-dom-v5-compat';
import { Breadcrumb, BreadcrumbItem } from '@patternfly/react-core';
import { FilterSelected } from '../Filters/StatefulFilters';
import { HistoryManager } from '../../app/History';
import { useKialiTranslation } from 'utils/I18nUtils';
import { kindToStringIncludeK8s } from '../../utils/IstioConfigUtils';
import { capitalize } from '../../utils/Common';

const istioName = 'Istio Config';

const cleanFilters = (): void => {
  FilterSelected.resetFilters();
};

type BreadcrumbModel =
  | {
      cluster?: string;
      mode: 'namespaceDetail';
      namespace: string;
    }
  | {
      cluster?: string;
      istioType: string;
      item: string;
      mode: 'entity';
      namespace: string;
      pathItem: string;
    };

const parseBreadcrumbModel = (pathname: string, search: string): BreadcrumbModel | undefined => {
  const match = pathname.split('/').filter(Boolean);
  const urlParams = new URLSearchParams(search);
  const cluster = HistoryManager.getClusterName(urlParams);
  const nsSeg = match.indexOf('namespaces');

  if (nsSeg < 0) {
    return undefined;
  }

  if (match.length === nsSeg + 2) {
    return {
      mode: 'namespaceDetail',
      cluster,
      namespace: match[nsSeg + 1]
    };
  }

  const ns = match[nsSeg + 1];
  const segment = match[nsSeg + 2];
  const page = Paths[segment.toUpperCase() as keyof typeof Paths];
  const base = nsSeg + 2;
  const istioTypeResolved = page === 'istio' ? kindToStringIncludeK8s(match[base + 1], match[base + 3]) : '';
  const itemPage = page !== 'istio' ? match[base + 1] : match[base + 4];

  return {
    mode: 'entity',
    cluster,
    namespace: ns,
    pathItem: page,
    item: itemPage,
    istioType: istioTypeResolved
  };
};

export const BreadcrumbView: React.FC = () => {
  const { pathname, search } = useLocation();
  const { t } = useKialiTranslation();

  const model = React.useMemo(() => parseBreadcrumbModel(pathname, search), [pathname, search]);

  if (!model) {
    return (
      <Breadcrumb>
        <BreadcrumbItem isActive={true}>Kiali</BreadcrumbItem>
      </Breadcrumb>
    );
  }

  if (model.mode === 'namespaceDetail') {
    const listHref =
      model.cluster && isMultiCluster ? `/${Paths.NAMESPACES}?clusterName=${model.cluster}` : `/${Paths.NAMESPACES}`;

    return (
      <Breadcrumb>
        <BreadcrumbItem>
          <Link to={listHref} onClick={cleanFilters}>
            {capitalize(Paths.NAMESPACES)}
          </Link>
        </BreadcrumbItem>
        <BreadcrumbItem isActive={true}>{model.namespace}</BreadcrumbItem>
      </Breadcrumb>
    );
  }

  const { cluster, namespace, pathItem, item, istioType } = model;
  const isIstio = pathItem === 'istio';

  const getItemPage = (): string => {
    let path = `/namespaces/${namespace}/${pathItem}/${item}`;

    if (cluster && isMultiCluster) {
      path += `?clusterName=${cluster}`;
    }

    return path;
  };

  const linkItem = isIstio ? (
    <BreadcrumbItem isActive={true}>{item}</BreadcrumbItem>
  ) : (
    <BreadcrumbItem isActive={true}>
      <Link to={getItemPage()} onClick={cleanFilters}>
        {item}
      </Link>
    </BreadcrumbItem>
  );

  return (
    <Breadcrumb>
      <BreadcrumbItem>
        <Link to={`/${pathItem}`} onClick={cleanFilters}>
          {isIstio ? istioName : capitalize(pathItem)}
        </Link>
      </BreadcrumbItem>

      <BreadcrumbItem>
        <Link to={`/${pathItem}?namespaces=${namespace}`} onClick={cleanFilters}>
          {t('Namespace: {{namespace}}', { namespace })}
        </Link>
      </BreadcrumbItem>

      {isIstio && (
        <BreadcrumbItem>
          <Link to={`/${pathItem}?namespaces=${namespace}&type=${istioType}`} onClick={cleanFilters}>
            {istioType}
          </Link>
        </BreadcrumbItem>
      )}

      {linkItem}
    </Breadcrumb>
  );
};
