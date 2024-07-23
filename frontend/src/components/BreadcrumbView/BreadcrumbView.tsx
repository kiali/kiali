import * as React from 'react';
import { isMultiCluster, Paths } from '../../config';
import { Link, useLocation } from 'react-router-dom-v5-compat';
import { Breadcrumb, BreadcrumbItem } from '@patternfly/react-core';
import { FilterSelected } from '../Filters/StatefulFilters';
import { dicIstioType } from '../../types/IstioConfigList';
import { HistoryManager } from '../../app/History';
import { useKialiTranslation } from 'utils/I18nUtils';

const istioName = 'Istio Config';
const namespaceRegex = /namespaces\/([a-z0-9-]+)\/([\w-.]+)\/([\w-.*]+)(\/([\w-.]+))?(\/([\w-.]+))?/;

const capitalize = (str: string): string => {
  return str.charAt(0).toUpperCase() + str.slice(1);
};

const getIstioType = (rawType: string): string => {
  const istioType = Object.keys(dicIstioType).find(key => dicIstioType[key] === rawType);
  return istioType ? istioType : capitalize(rawType);
};

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
    const match = pathname.match(namespaceRegex) ?? [];
    const ns = match[1];
    const page = Paths[match[2].toUpperCase()];
    const istioType = match[3];
    const urlParams = new URLSearchParams(search);
    const itemPage = page !== 'istio' ? match[3] : match[5];

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
          <Link
            to={`/${pathItem}?namespaces=${namespace}&type=${dicIstioType[istioType || '']}`}
            onClick={cleanFilters}
          >
            {istioType ? getIstioType(istioType) : istioType}
          </Link>
        </BreadcrumbItem>
      )}

      {linkItem}
    </Breadcrumb>
  );
};
