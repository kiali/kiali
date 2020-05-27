import * as React from 'react';
import { Link } from 'react-router-dom';
import { Badge, Tooltip, TooltipPosition } from '@patternfly/react-core';
import * as FilterHelper from '../FilterList/FilterHelper';
import { appLabelFilter, versionLabelFilter } from '../../pages/WorkloadList/FiltersAndSorts';

import MissingSidecar from '../MissingSidecar/MissingSidecar';
import { hasMissingSidecar, IstioTypes, Renderer, Resource, TResource, SortResource } from './Config';
import { DisplayMode, HealthIndicator } from '../Health/HealthIndicator';
import { ValidationObjectSummary } from '../Validations/ValidationObjectSummary';
import { WorkloadListItem } from '../../types/Workload';
import { dicIstioType, IstioConfigItem } from '../../types/IstioConfigList';
import { AppListItem } from '../../types/AppList';
import { ServiceListItem } from '../../types/ServiceList';
import { ActiveFilter, LabelFilter } from '../../types/Filters';
import { PfColors } from '../Pf/PfColors';
import { renderAPILogo } from '../Logo/Logos';
import { Health } from '../../types/Health';
import NamespaceInfo from '../../pages/Overview/NamespaceInfo';
import NamespaceMTLSStatusContainer from '../MTls/NamespaceMTLSStatus';
import { Paths } from '../../config';
import ValidationSummary from '../Validations/ValidationSummary';
import OverviewCardContentExpanded from '../../pages/Overview/OverviewCardContentExpanded';
import { OverviewToolbar } from '../../pages/Overview/OverviewToolbar';
import OverviewCardLinks from '../../pages/Overview/OverviewCardLinks';
import { StatefulFilters } from '../Filters/StatefulFilters';

// Links

const getLink = (item: TResource, config: Resource, query?: string) => {
  let url = config.name === 'istio' ? getIstioLink(item) : `/namespaces/${item.namespace}/${config.name}/${item.name}`;
  return query ? url + '?' + query : url;
};

const getIstioLink = (item: TResource) => {
  let to = '/namespaces/' + item.namespace + '/istio';
  const name = item.name;
  const type = item['type'];

  // Adapters and Templates need to pass subtype
  if (type === 'adapter' || type === 'template') {
    // Build a /adapters/<adapter_type_plural>/<adapter_name> or
    //         /templates/<template_type_plural>/<template_name>
    const istioType = type + 's';
    const subtype = type === 'adapter' ? item['adapter']!.adapters : item['template']!.templates;
    to = to + '/' + istioType + '/' + subtype + '/' + name;
  } else {
    to = to + '/' + dicIstioType[IstioTypes[type].name] + '/' + name;
  }
  return to;
};

// Cells
export const details: Renderer<AppListItem | WorkloadListItem | ServiceListItem> = (
  item: AppListItem | WorkloadListItem | ServiceListItem
) => {
  const hasMissingSC = hasMissingSidecar(item);
  const isWorkload = 'appLabel' in item;
  const hasMissingApp = isWorkload && !item['appLabel'];
  const hasMissingVersion = isWorkload && !item['versionLabel'];
  const additionalDetails = (item as WorkloadListItem | ServiceListItem).additionalDetailSample;
  const spacer = hasMissingSC && additionalDetails && additionalDetails.icon;
  return (
    <td
      role="gridcell"
      key={'VirtuaItem_Details_' + item.namespace + '_' + item.name}
      style={{ verticalAlign: 'middle' }}
    >
      <ul>
        {hasMissingSC && (
          <li>
            <MissingSidecar namespace={item.namespace} />
          </li>
        )}
        {isWorkload && hasMissingApp && (
          <li>
            Missing{' '}
            <Badge isRead={true} className={'virtualitem_badge_definition'}>
              app
            </Badge>
            label
          </li>
        )}
        {isWorkload && hasMissingVersion && (
          <li>
            Missing{' '}
            <Badge isRead={true} className={'virtualitem_badge_definition'}>
              version
            </Badge>
            label
          </li>
        )}
        {spacer && ' '}
        {additionalDetails && additionalDetails.icon && (
          <li>{renderAPILogo(additionalDetails.icon, additionalDetails.title, 0)}</li>
        )}
      </ul>
    </td>
  );
};

export const tls: Renderer<NamespaceInfo> = (ns: NamespaceInfo) => {
  return (
    <td role="gridcell" key={'VirtualItem_tls_' + ns.name} style={{ verticalAlign: 'middle' }}>
      {ns.tlsStatus ? <NamespaceMTLSStatusContainer status={ns.tlsStatus.status} /> : undefined}
    </td>
  );
};

export const istioConfig: Renderer<NamespaceInfo> = (ns: NamespaceInfo) => {
  let status: any = <small style={{ fontSize: '65%', marginLeft: '5px' }}>N/A</small>;
  if (ns.validations) {
    status = (
      <td role="gridcell" key={'VirtuaItem_Links_' + ns.name} style={{ verticalAlign: 'middle' }}>
        <Link to={`/${Paths.ISTIO}?namespaces=${ns.name}`}>
          <ValidationSummary
            id={'ns-val-' + ns.name}
            errors={ns.validations.errors}
            warnings={ns.validations.warnings}
            objectCount={ns.validations.objectCount}
            style={{ marginLeft: '5px' }}
          />
        </Link>
      </td>
    );
  }
  return status;
};

export const status: Renderer<NamespaceInfo> = (ns: NamespaceInfo) => {
  if (ns.status) {
    return (
      <td
        role="gridcell"
        key={'VirtuaItem_Status_' + ns.name}
        className="pf-m-center"
        style={{ verticalAlign: 'middle' }}
      >
        <OverviewCardContentExpanded
          key={ns.name}
          name={ns.name}
          duration={FilterHelper.currentDuration()}
          status={ns.status}
          type={OverviewToolbar.currentOverviewType()}
          metrics={ns.metrics}
        />
      </td>
    );
  }
  return <td role="gridcell" key={'VirtuaItem_Name_' + ns.name} />;
};

export const links: Renderer<NamespaceInfo> = (ns: NamespaceInfo) => {
  return (
    <td role="gridcell" key={'VirtuaItem_Links_' + ns.name} style={{ verticalAlign: 'middle' }}>
      <OverviewCardLinks name={ns.name} overviewType={OverviewToolbar.currentOverviewType()} />
    </td>
  );
};

export const nsItem: Renderer<NamespaceInfo> = (ns: NamespaceInfo, _config: Resource, icon: string) => {
  return (
    <td role="gridcell" key={'VirtuaItem_Name_' + ns.name} style={{ verticalAlign: 'middle' }}>
      <Badge className={'virtualitem_badge_definition'}>{icon}</Badge>
      {ns.name}
    </td>
  );
};

export const item: Renderer<TResource> = (item: TResource, config: Resource, icon: string) => {
  const key = 'link_definition_' + config.name + '_' + item.namespace + '_' + item.name;
  let itemName = config.name.charAt(0).toUpperCase() + config.name.slice(1);
  if (config.name === 'istio') {
    itemName = IstioTypes[item['type']].name;
  }
  return (
    <td role="gridcell" key={'VirtuaItem_Name_' + item.namespace + '_' + item.name} style={{ verticalAlign: 'middle' }}>
      <Tooltip position={TooltipPosition.top} content={<>{itemName}</>}>
        <Badge className={'virtualitem_badge_definition'}>{icon}</Badge>
      </Tooltip>
      <Link key={key} to={getLink(item, config)} className={'virtualitem_definition_link'}>
        {item.name}
      </Link>
    </td>
  );
};

export const namespace: Renderer<TResource> = (item: TResource) => {
  return (
    <td
      role="gridcell"
      key={'VirtuaItem_Namespace_' + item.namespace + '_' + item.name}
      style={{ verticalAlign: 'middle' }}
    >
      <Tooltip position={TooltipPosition.top} content={<>Namespace</>}>
        <Badge className={'virtualitem_badge_definition'}>NS</Badge>
      </Tooltip>
      {item.namespace}
    </td>
  );
};

const labelActivate = (filters: ActiveFilter[], key: string, value: string) => {
  return filters.some(filter => {
    if (filter.category === LabelFilter.title) {
      if (filter.value.includes(':')) {
        const [k, v] = filter.value.split(':');
        if (k === key) {
          return v.split(',').some(val => value.split(',').some(vl => vl.trim().startsWith(val.trim())));
        }
        return false;
      }
      return key === filter.value;
    } else {
      if (filter.category === appLabelFilter.title) {
        return filter.value === 'Present' && key === 'app';
      }
      return filter.value === 'Present' && key === 'version';
    }
  });
};

export const labels: Renderer<SortResource | NamespaceInfo> = (
  item: SortResource | NamespaceInfo,
  _: Resource,
  __: string,
  ___?: Health,
  statefulFilter?: React.RefObject<StatefulFilters>
) => {
  const filters = FilterHelper.getFiltersFromURL([LabelFilter, appLabelFilter, versionLabelFilter]);
  return (
    <td
      role="gridcell"
      key={'VirtuaItem_Labels_' + ('namespace' in item && `${item.namespace}_`) + item.name}
      style={{ verticalAlign: 'middle' }}
    >
      {item.labels &&
        Object.entries(item.labels).map(([key, value]) => {
          const label = `${key}:${value}`;
          const labelAct = labelActivate(filters.filters, key, value);
          const isExactlyLabelFilter = FilterHelper.getFiltersFromURL([LabelFilter]).filters.some(f =>
            f.value.includes(label)
          );
          const badgeComponent = (
            <Badge
              key={`labelbadge_${key}_${value}_${item.name}`}
              isRead={true}
              style={{
                backgroundColor: labelAct ? PfColors.Blue200 : undefined,
                cursor: isExactlyLabelFilter || !labelAct ? 'pointer' : 'not-allowed'
              }}
              onClick={() =>
                statefulFilter
                  ? labelAct
                    ? isExactlyLabelFilter && statefulFilter.current!.removeFilter(LabelFilter.title, label)
                    : statefulFilter.current!.filterAdded(LabelFilter, label)
                  : {}
              }
            >
              {key}: {value}
            </Badge>
          );

          return statefulFilter ? (
            <Tooltip
              content={
                labelAct ? (
                  isExactlyLabelFilter ? (
                    <>Remove label from Filters</>
                  ) : (
                    <>Kiali can't remove the filter if is an expression</>
                  )
                ) : (
                  <>Add label to Filters</>
                )
              }
            >
              {badgeComponent}
            </Tooltip>
          ) : (
            badgeComponent
          );
        })}
    </td>
  );
};
export const health: Renderer<TResource> = (item: TResource, __: Resource, _: string, health?: Health) => {
  return (
    <td
      role="gridcell"
      key={'VirtuaItem_Health_' + item.namespace + '_' + item.name}
      style={{ verticalAlign: 'middle' }}
    >
      {health && <HealthIndicator id={item.name} health={health} mode={DisplayMode.SMALL} />}
    </td>
  );
};

export const workloadType: Renderer<WorkloadListItem> = (item: WorkloadListItem) => {
  return (
    <td
      role="gridcell"
      key={'VirtuaItem_WorkloadType_' + item.namespace + '_' + item.name}
      style={{ verticalAlign: 'middle' }}
    >
      {item.type}
    </td>
  );
};

export const istioType: Renderer<IstioConfigItem> = (item: IstioConfigItem) => {
  const type = item.type;
  const object = IstioTypes[type];
  return (
    <td
      role="gridcell"
      key={'VirtuaItem_IstioType_' + item.namespace + '_' + item.name}
      style={{ verticalAlign: 'middle' }}
    >
      {type === 'adapter' || type === 'template' ? `${object.name}: ${item[type]![type]}` : object.name}
    </td>
  );
};

export const configuration: Renderer<ServiceListItem | IstioConfigItem> = (
  item: ServiceListItem | IstioConfigItem,
  config: Resource
) => {
  const validation = item.validation;
  const linkQuery: string = item['type'] ? 'list=yaml' : '';
  return (
    <td role="gridcell" key={'VirtuaItem_Conf_' + item.namespace + '_' + item.name} style={{ verticalAlign: 'middle' }}>
      {validation ? (
        <Link to={`${getLink(item, config, linkQuery)}`}>
          <ValidationObjectSummary id={item.name + '-config-validation'} validations={[validation]} />
        </Link>
      ) : (
        <>N/A</>
      )}
    </td>
  );
};
