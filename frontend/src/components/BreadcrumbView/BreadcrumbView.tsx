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

export const BreadcrumbView: React.FC = () => {
  const [cluster, setCluster] = React.useState<string>();
  const [istioType, setIstioType] = React.useState<string>();
  const [item, setItem] = React.useState<string>('');
  const [namespace, setNamespace] = React.useState<string>('');
  const [pathItem, setPathItem] = React.useState<string>('');

  const { pathname, search } = useLocation();
  const { t } = useKialiTranslation();

  React.useEffect(() => {
    const match = pathname.split('/');
    const ns = match[2];
    const page = Paths[match[3].toUpperCase()];
    const istioType = page === 'istio' ? kindToStringIncludeK8s(match[4], match[6]) : '';
    const urlParams = new URLSearchParams(search);
    const itemPage = page !== 'istio' ? match[4] : match[7];

    setCluster(HistoryManager.getClusterName(urlParams));
    setIstioType(istioType);
    setItem(itemPage);
    setNamespace(ns);
    setPathItem(page);
  }, [pathname, search]);

  const isIstioPath = (): boolean => {
    return pathItem === 'istio';
  };

  const getItemPage = (): string => {
    let path = `/namespaces/${namespace}/${pathItem}/${item}`;

    if (cluster && isMultiCluster) {
      path += `?clusterName=${cluster}`;
    }

    return path;
  };

  const isIstio = isIstioPath();

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
