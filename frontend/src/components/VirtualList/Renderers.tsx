import * as React from 'react';
import { Link } from 'react-router-dom';
import { Badge, Tooltip, TooltipPosition } from '@patternfly/react-core';
import * as FilterHelper from '../FilterList/FilterHelper';
import { appLabelFilter, versionLabelFilter } from '../../pages/WorkloadList/FiltersAndSorts';

import MissingSidecar from '../MissingSidecar/MissingSidecar';
import { hasMissingSidecar, IstioTypes, Renderer, Resource, SortResource, TResource } from './Config';
import { HealthIndicator } from '../Health/HealthIndicator';
import { ValidationObjectSummary } from '../Validations/ValidationObjectSummary';
import { ValidationServiceSummary } from '../Validations/ValidationServiceSummary';
import { WorkloadListItem } from '../../types/Workload';
import { IstioConfigItem } from '../../types/IstioConfigList';
import { AppListItem } from '../../types/AppList';
import { ServiceListItem } from '../../types/ServiceList';
import { ActiveFilter } from '../../types/Filters';
import { PFColors } from '../Pf/PfColors';
import { renderAPILogo } from '../Logo/Logos';
import { Health } from '../../types/Health';
import NamespaceInfo from '../../pages/Overview/NamespaceInfo';
import NamespaceMTLSStatusContainer from '../MTls/NamespaceMTLSStatus';
import ValidationSummary from '../Validations/ValidationSummary';
import OverviewCardContentExpanded from '../../pages/Overview/OverviewCardContentExpanded';
import { OverviewToolbar } from '../../pages/Overview/OverviewToolbar';
import { StatefulFilters } from '../Filters/StatefulFilters';
import IstioObjectLink, { GetIstioObjectUrl } from '../Link/IstioObjectLink';
import { labelFilter } from 'components/Filters/CommonFilters';
import { labelFilter as NsLabelFilter } from '../../pages/Overview/Filters';
import ValidationSummaryLink from '../Link/ValidationSummaryLink';
import { ValidationStatus } from '../../types/IstioObjects';
import { PFBadgeType, PFBadge, PFBadges } from 'components/Pf/PfBadges';
import MissingLabel from '../MissingLabel/MissingLabel';
import MissingAuthPolicy from 'components/MissingAuthPolicy/MissingAuthPolicy';
import { getReconciliationCondition } from 'utils/IstioConfigUtils';

// Links

const getLink = (item: TResource, config: Resource, query?: string) => {
  let url = config.name === 'istio' ? getIstioLink(item) : `/namespaces/${item.namespace}/${config.name}/${item.name}`;
  return query ? url + '?' + query : url;
};

const getIstioLink = (item: TResource) => {
  const type = item['type'];

  return GetIstioObjectUrl(item.name, item.namespace, type);
};

// Cells

export const actionRenderer = (key: string, action: JSX.Element) => {
  return (
    <td role="gridcell" key={'VirtuaItem_Action_' + key} style={{ verticalAlign: 'middle' }}>
      {action}
    </td>
  );
};

export const details: Renderer<AppListItem | WorkloadListItem | ServiceListItem> = (
  item: AppListItem | WorkloadListItem | ServiceListItem
) => {
  const hasMissingSC = hasMissingSidecar(item);
  const isWorkload = 'appLabel' in item;
  const hasMissingApp = isWorkload && !item['appLabel'];
  const hasMissingVersion = isWorkload && !item['versionLabel'];
  const additionalDetails = (item as WorkloadListItem | ServiceListItem).additionalDetailSample;
  const spacer = hasMissingSC && additionalDetails && additionalDetails.icon;
  const hasMissingAP = isWorkload && (item as WorkloadListItem).notCoveredAuthPolicy;

  return (
    <td
      role="gridcell"
      key={'VirtuaItem_Details_' + item.namespace + '_' + item.name}
      style={{ verticalAlign: 'middle', whiteSpace: 'nowrap' }}
    >
      <ul>
        {hasMissingAP && (
          <li>
            <MissingAuthPolicy namespace={item.namespace} />
          </li>
        )}
        {hasMissingSC && (
          <li>
            <MissingSidecar namespace={item.namespace} />
          </li>
        )}
        {isWorkload && (hasMissingApp || hasMissingVersion) && (
          <MissingLabel missingApp={hasMissingApp} missingVersion={hasMissingVersion} tooltip={false} />
        )}
        {spacer && ' '}
        {additionalDetails && additionalDetails.icon && (
          <li>{renderAPILogo(additionalDetails.icon, additionalDetails.title, 0)}</li>
        )}
        {item.istioReferences &&
          item.istioReferences.length > 0 &&
          item.istioReferences.map(ir => (
            <li key={ir.namespace ? `${ir.name}_${ir.namespace}` : ir.name}>
              <PFBadge badge={PFBadges[ir.objectType]} position={TooltipPosition.top} />
              <IstioObjectLink name={ir.name} namespace={ir.namespace || ''} type={ir.objectType.toLowerCase()}>
                {ir.name}
              </IstioObjectLink>
            </li>
          ))}
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
  let validations: ValidationStatus = { objectCount: 0, errors: 0, warnings: 0 };
  if (!!ns.validations) {
    validations = ns.validations;
  }
  const status = (
    <td role="gridcell" key={'VirtuaItem_IstioConfig_' + ns.name} style={{ verticalAlign: 'middle' }}>
      <ValidationSummaryLink
        namespace={ns.name}
        objectCount={validations.objectCount}
        errors={validations.errors}
        warnings={validations.warnings}
      >
        <ValidationSummary
          id={'ns-val-' + ns.name}
          errors={validations.errors}
          warnings={validations.warnings}
          objectCount={validations.objectCount}
        />
      </ValidationSummaryLink>
    </td>
  );
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
          errorMetrics={ns.errorMetrics}
        />
      </td>
    );
  }
  return <td role="gridcell" key={'VirtuaItem_Status_' + ns.name} />;
};

export const nsItem: Renderer<NamespaceInfo> = (ns: NamespaceInfo, _config: Resource, badge: PFBadgeType) => {
  return (
    <td role="gridcell" key={'VirtuaItem_NamespaceItem_' + ns.name} style={{ verticalAlign: 'middle' }}>
      <PFBadge badge={badge} />
      {ns.name}
    </td>
  );
};

export const item: Renderer<TResource> = (item: TResource, config: Resource, badge: PFBadgeType) => {
  const key = 'link_definition_' + config.name + '_' + item.namespace + '_' + item.name;
  let serviceBadge = badge;
  if (item['serviceRegistry']) {
    switch (item['serviceRegistry']) {
      case 'External':
        serviceBadge = PFBadges.ExternalService;
        break;
      case 'Federation':
        serviceBadge = PFBadges.FederatedService;
        break;
    }
  }
  return (
    <td role="gridcell" key={'VirtuaItem_Item_' + item.namespace + '_' + item.name} style={{ verticalAlign: 'middle' }}>
      <PFBadge badge={serviceBadge} position={TooltipPosition.top} />
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
      <PFBadge badge={PFBadges.Namespace} position={TooltipPosition.top} />
      {item.namespace}
    </td>
  );
};

const labelActivate = (filters: ActiveFilter[], key: string, value: string, id: string) => {
  return filters.some(filter => {
    if (filter.id === id) {
      if (filter.value.includes(':')) {
        const [k, v] = filter.value.split(':');
        if (k === key) {
          return v.split(',').some(val => value.split(',').some(vl => vl.trim().startsWith(val.trim())));
        }
        return false;
      }
      return key === filter.value;
    } else {
      if (filter.id === appLabelFilter.id) {
        return filter.value === 'Present' && key === 'app';
      }
      return filter.value === 'Present' && key === 'version';
    }
  });
};

export const labels: Renderer<SortResource | NamespaceInfo> = (
  item: SortResource | NamespaceInfo,
  _: Resource,
  __: PFBadgeType,
  ___?: Health,
  statefulFilter?: React.RefObject<StatefulFilters>
) => {
  let path = window.location.pathname;
  path = path.substr(path.lastIndexOf('/console') + '/console'.length + 1);
  const labelFilt = path === 'overview' ? NsLabelFilter : labelFilter;
  const filters = FilterHelper.getFiltersFromURL([labelFilt, appLabelFilter, versionLabelFilter]);
  return (
    <td
      role="gridcell"
      key={'VirtuaItem_Labels_' + ('namespace' in item && `${item.namespace}_`) + item.name}
      style={{ verticalAlign: 'middle' }}
    >
      {item.labels &&
        Object.entries(item.labels).map(([key, value]) => {
          const label = `${key}:${value}`;
          const labelAct = labelActivate(filters.filters, key, value, labelFilt.id);
          const isExactlyLabelFilter = FilterHelper.getFiltersFromURL([labelFilt]).filters.some(f =>
            f.value.includes(label)
          );
          const badgeComponent = (
            <Badge
              key={`labelbadge_${key}_${value}_${item.name}`}
              isRead={true}
              style={{
                backgroundColor: labelAct ? PFColors.Badge : undefined,
                cursor: isExactlyLabelFilter || !labelAct ? 'pointer' : 'not-allowed',
                whiteSpace: 'nowrap'
              }}
              onClick={() =>
                statefulFilter
                  ? labelAct
                    ? isExactlyLabelFilter && statefulFilter.current!.removeFilter(labelFilt.id, label)
                    : statefulFilter.current!.filterAdded(labelFilt, label)
                  : {}
              }
            >
              {key}: {value}
            </Badge>
          );

          return statefulFilter ? (
            <Tooltip
              key={'Tooltip_Label_' + key + '_' + value}
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
export const health: Renderer<TResource> = (item: TResource, __: Resource, _: PFBadgeType, health?: Health) => {
  return (
    <td
      role="gridcell"
      key={'VirtuaItem_Health_' + item.namespace + '_' + item.name}
      style={{ verticalAlign: 'middle' }}
    >
      {health && <HealthIndicator id={item.name} health={health} />}
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
      {object.name}
    </td>
  );
};

export const istioConfiguration: Renderer<IstioConfigItem> = (item: IstioConfigItem, config: Resource) => {
  const validation = item.validation;
  const reconciledCondition = getReconciliationCondition(item);
  const linkQuery: string = item['type'] ? 'list=yaml' : '';
  return (
    <td role="gridcell" key={'VirtuaItem_Conf_' + item.namespace + '_' + item.name} style={{ verticalAlign: 'middle' }}>
      {validation ? (
        <Link to={`${getLink(item, config, linkQuery)}`}>
          <ValidationObjectSummary
            id={item.name + '-config-validation'}
            validations={[validation]}
            reconciledCondition={reconciledCondition}
          />
        </Link>
      ) : (
        <>N/A</>
      )}
    </td>
  );
};

export const serviceConfiguration: Renderer<ServiceListItem> = (item: ServiceListItem, config: Resource) => {
  const validation = item.validation;
  const linkQuery: string = item['type'] ? 'list=yaml' : '';
  return (
    <td role="gridcell" key={'VirtuaItem_Conf_' + item.namespace + '_' + item.name} style={{ verticalAlign: 'middle' }}>
      {validation ? (
        <Link to={`${getLink(item, config, linkQuery)}`}>
          <ValidationServiceSummary id={item.name + '-service-validation'} validations={[validation]} />
        </Link>
      ) : (
        <>N/A</>
      )}
    </td>
  );
};
