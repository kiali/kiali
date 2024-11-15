import * as React from 'react';
import { Link } from 'react-router-dom-v5-compat';
import { Tooltip, TooltipPosition } from '@patternfly/react-core';
import * as FilterHelper from '../FilterList/FilterHelper';
import { appLabelFilter, versionLabelFilter } from '../../pages/WorkloadList/FiltersAndSorts';
import { MissingSidecar } from '../MissingSidecar/MissingSidecar';
import { Renderer, Resource, SortResource, TResource, GVKToBadge } from './Config';
import { HealthIndicator } from '../Health/HealthIndicator';
import { ValidationObjectSummary } from '../Validations/ValidationObjectSummary';
import { ValidationServiceSummary } from '../Validations/ValidationServiceSummary';
import { WorkloadListItem } from '../../types/Workload';
import { IstioConfigItem } from '../../types/IstioConfigList';
import { AppListItem } from '../../types/AppList';
import { ServiceListItem } from '../../types/ServiceList';
import { ActiveFilter } from '../../types/Filters';
import { renderAPILogo } from '../Logo/Logos';
import { Health } from '../../types/Health';
import { NamespaceInfo } from '../../types/NamespaceInfo';
import { NamespaceMTLSStatus } from '../MTls/NamespaceMTLSStatus';
import { ValidationSummary } from '../Validations/ValidationSummary';
import { OverviewToolbar } from '../../pages/Overview/OverviewToolbar';
import { OverviewCardDataPlaneNamespace } from '../../pages/Overview/OverviewCardDataPlaneNamespace';
import { StatefulFiltersRef } from '../Filters/StatefulFilters';
import { IstioObjectLink, GetIstioObjectUrl } from '../Link/IstioObjectLink';
import { labelFilter } from 'components/Filters/CommonFilters';
import { labelFilter as NsLabelFilter } from '../../pages/Overview/Filters';
import { ValidationSummaryLink } from '../Link/ValidationSummaryLink';
import { ValidationStatus } from '../../types/IstioObjects';
import { PFBadgeType, PFBadge, PFBadges } from 'components/Pf/PfBadges';
import { MissingLabel } from '../MissingLabel/MissingLabel';
import { MissingAuthPolicy } from 'components/MissingAuthPolicy/MissingAuthPolicy';
import {
  getGVKTypeString,
  getIstioObjectGVK,
  getReconciliationCondition,
  kindToStringIncludeK8s
} from 'utils/IstioConfigUtils';
import { Label } from 'components/Label/Label';
import { isMultiCluster, serverConfig } from 'config/ServerConfig';
import { ControlPlaneBadge } from 'pages/Overview/ControlPlaneBadge';
import { NamespaceStatuses } from 'pages/Overview/NamespaceStatuses';
import { isWaypoint } from '../../helpers/LabelFilterHelper';
import { KialiIcon } from '../../config/KialiIcon';
import { Td } from '@patternfly/react-table';
import { kialiStyle } from 'styles/StyleUtils';
import { hasMissingSidecar } from './Config';
import { InstanceType } from 'types/Common';
import { infoStyleProps } from 'styles/IconStyle';

const rendererInfoStyle = kialiStyle({
  ...infoStyleProps,
  marginBottom: '-0.125rem',
  marginRight: '0',
  marginTop: '0'
});

// Links

const getLink = (item: TResource, config: Resource, query?: string): string => {
  let url = config.name === 'istio' ? getIstioLink(item) : `/namespaces/${item.namespace}/${config.name}/${item.name}`;

  if (item.cluster && isMultiCluster && !url.includes('cluster')) {
    if (url.includes('?')) {
      url = `${url}&clusterName=${item.cluster}`;
    } else {
      url = `${url}?clusterName=${item.cluster}`;
    }
  }

  if (query) {
    if (url.includes('?')) {
      url = `${url}&${query}`;
    } else {
      url = `${url}?${query}`;
    }
  }

  return url;
};

const getIstioLink = (item: TResource): string => {
  return GetIstioObjectUrl(
    item.name,
    item.namespace,
    getIstioObjectGVK(item['apiVersion'], item['kind']),
    item.cluster
  );
};

// Cells
export const actionRenderer = (key: string, action: React.ReactNode): React.ReactNode => {
  return (
    <Td role="gridcell" key={`VirtuaItem_Action_${key}`} style={{ verticalAlign: 'middle' }}>
      {action}
    </Td>
  );
};

export const details: Renderer<AppListItem | WorkloadListItem | ServiceListItem> = (
  item: AppListItem | WorkloadListItem | ServiceListItem
) => {
  const isWorkload = item.instanceType === InstanceType.Workload;
  const isAmbientWaypoint = isWaypoint(item.labels);
  const hasMissingApp = isWorkload && !item['appLabel'] && !isWaypoint(item.labels);
  const hasMissingVersion = isWorkload && !item['versionLabel'] && !isWaypoint(item.labels);
  const additionalDetails = (item as WorkloadListItem | ServiceListItem).additionalDetailSample;
  const spacer = isWorkload && hasMissingSidecar(item) && additionalDetails && additionalDetails.icon;
  const hasMissingAP = isWorkload && (item as WorkloadListItem).notCoveredAuthPolicy;
  return (
    <Td
      role="gridcell"
      dataLabel="Details"
      key={`VirtuaItem_Details_${item.namespace}_${item.name}`}
      style={{ verticalAlign: 'middle', whiteSpace: 'nowrap' }}
    >
      <ul>
        {hasMissingAP && (
          <li>
            <MissingAuthPolicy namespace={item.namespace} />
          </li>
        )}

        {(isWorkload || item.instanceType === InstanceType.App) && hasMissingSidecar(item) && (
          <li>
            <MissingSidecar />
          </li>
        )}

        {isWorkload && (hasMissingApp || hasMissingVersion) && (
          <li>
            <MissingLabel missingApp={hasMissingApp} missingVersion={hasMissingVersion} tooltip={false} />
          </li>
        )}

        {spacer && ' '}

        {additionalDetails && additionalDetails.icon && (
          <li style={{ marginBottom: '0.125rem' }}>
            {renderAPILogo(additionalDetails.icon, additionalDetails.title, 0)}
          </li>
        )}

        {item.istioReferences?.length > 0 &&
          item.istioReferences.map(ir => (
            <li
              key={ir.namespace ? `${ir.objectGVK.Group}.${ir.objectGVK.Kind}_${ir.name}_${ir.namespace}` : ir.name}
              style={{ marginBottom: '0.125rem' }}
            >
              <PFBadge badge={GVKToBadge[getGVKTypeString(ir.objectGVK)]} position={TooltipPosition.top} />
              <IstioObjectLink
                name={ir.name}
                namespace={ir.namespace ?? ''}
                cluster={item.cluster}
                objectGVK={ir.objectGVK}
              >
                {ir.name}
              </IstioObjectLink>
            </li>
          ))}

        {isAmbientWaypoint && (
          <li style={{ marginBottom: '0.125rem' }}>
            <PFBadge badge={PFBadges.Waypoint} position={TooltipPosition.top} />
            Waypoint Proxy
            <Tooltip
              key="tooltip_missing_label"
              position={TooltipPosition.top}
              content="Layer 7 service Mesh capabilities in Istio Ambient"
            >
              <KialiIcon.Info className={rendererInfoStyle} />
            </Tooltip>
          </li>
        )}
      </ul>
    </Td>
  );
};

export const tls: Renderer<NamespaceInfo> = (ns: NamespaceInfo) => {
  return (
    <Td role="gridcell" dataLabel="TLS" key={`VirtualItem_tls_${ns.name}`} style={{ verticalAlign: 'middle' }}>
      {ns.tlsStatus ? <NamespaceMTLSStatus status={ns.tlsStatus.status} /> : undefined}
    </Td>
  );
};

export const istioConfig: Renderer<NamespaceInfo> = (ns: NamespaceInfo) => {
  let validations: ValidationStatus = { namespace: ns.name, objectCount: 0, errors: 0, warnings: 0 };

  if (!!ns.validations) {
    validations = ns.validations;
  }

  const status = (
    <Td
      role="gridcell"
      dataLabel="Config"
      key={`VirtuaItem_IstioConfig_${ns.name}`}
      style={{ verticalAlign: 'middle' }}
    >
      <ValidationSummaryLink
        namespace={ns.name}
        objectCount={validations.objectCount}
        errors={validations.errors}
        warnings={validations.warnings}
      >
        <ValidationSummary
          id={`ns-val-${ns.name}`}
          errors={validations.errors}
          warnings={validations.warnings}
          objectCount={validations.objectCount}
          type="istio"
        />
      </ValidationSummaryLink>
    </Td>
  );

  return status;
};

export const status: Renderer<NamespaceInfo> = (ns: NamespaceInfo) => {
  if (ns.status) {
    return (
      <Td
        role="gridcell"
        dataLabel="Status"
        key={`VirtuaItem_Status_${ns.name}`}
        textCenter
        style={{ verticalAlign: 'middle' }}
      >
        {ns.status && (
          <NamespaceStatuses
            key={`${ns.name}_status`}
            name={ns.name}
            status={ns.status}
            type={OverviewToolbar.currentOverviewType()}
          />
        )}

        <OverviewCardDataPlaneNamespace
          key={`${ns.name}_chart`}
          duration={FilterHelper.currentDuration()}
          direction={OverviewToolbar.currentDirectionType()}
          metrics={ns.metrics}
          errorMetrics={ns.errorMetrics}
        />
      </Td>
    );
  }

  return <Td role="gridcell" dataLabel="Status" key={`VirtuaItem_Status_${ns.name}`} />;
};

export const nsItem: Renderer<NamespaceInfo> = (ns: NamespaceInfo, _config: Resource, badge: PFBadgeType) => {
  return (
    <Td
      role="gridcell"
      dataLabel="Namespace"
      key={`VirtuaItem_NamespaceItem_${ns.name}`}
      style={{ verticalAlign: 'middle' }}
    >
      <PFBadge badge={badge} />
      {ns.name}
      {ns.name === serverConfig.istioNamespace && (
        <ControlPlaneBadge cluster={ns.cluster} annotations={ns.annotations} />
      )}
    </Td>
  );
};

export const item: Renderer<TResource> = (item: TResource, config: Resource, badge: PFBadgeType) => {
  const key = `link_definition_${config.name}_${item.namespace}_${item.name}`;
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
    <Td
      role="gridcell"
      dataLabel="Name"
      key={`VirtuaItem_Item_${item.namespace}_${item.name}`}
      style={{ verticalAlign: 'middle' }}
    >
      <PFBadge badge={serviceBadge} position={TooltipPosition.top} />
      <Link key={key} to={getLink(item, config)}>
        {item.name}
      </Link>
    </Td>
  );
};

// @TODO SortResource
export const cluster: Renderer<TResource> = (item: TResource) => {
  return (
    <Td
      role="gridcell"
      dataLabel="Cluster"
      key={`VirtuaItem_Cluster_${item.cluster}`}
      style={{ verticalAlign: 'middle' }}
    >
      <PFBadge badge={PFBadges.Cluster} position={TooltipPosition.top} />
      {item.cluster}
    </Td>
  );
};

export const namespace: Renderer<TResource> = (item: TResource) => {
  return (
    <Td
      role="gridcell"
      dataLabel="Namespace"
      key={`VirtuaItem_Namespace_${item.namespace}_${item.name}`}
      style={{ verticalAlign: 'middle' }}
    >
      <PFBadge badge={PFBadges.Namespace} position={TooltipPosition.top} />
      {item.namespace}
    </Td>
  );
};

const labelActivate = (filters: ActiveFilter[], key: string, value: string, id: string): boolean => {
  return filters.some(filter => {
    if (filter.category === id) {
      if (filter.value.includes('=')) {
        const [k, v] = filter.value.split('=');

        if (k === key) {
          return v.split(',').some(val => value.split(',').some(vl => vl.trim().startsWith(val.trim())));
        }

        return false;
      }

      return key === filter.value;
    } else {
      if (filter.category === appLabelFilter.category) {
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
  statefulFilter?: StatefulFiltersRef
) => {
  let path = window.location.pathname;
  path = path.substring(path.lastIndexOf('/console') + '/console'.length + 1);
  const labelFilt = path === 'overview' ? NsLabelFilter : labelFilter;
  const filters = FilterHelper.getFiltersFromURL([labelFilt, appLabelFilter, versionLabelFilter]);

  return (
    <Td
      role="gridcell"
      dataLabel="Labels"
      key={`VirtuaItem_Labels_${'namespace' in item && `${item.namespace}_`}${item.name}`}
      style={{ verticalAlign: 'middle', paddingBottom: '0.25rem' }}
    >
      {item.labels &&
        Object.entries(item.labels).map(([key, value], i) => {
          const label = `${key}=${value}`;
          const labelAct = labelActivate(filters.filters, key, value, labelFilt.category);

          const isExactlyLabelFilter = FilterHelper.getFiltersFromURL([labelFilt]).filters.some(f =>
            f.value.includes(label)
          );

          const labelComponent = (
            <Label
              key={`label_${i}`}
              name={key}
              value={value}
              style={{ cursor: isExactlyLabelFilter || !labelAct ? 'pointer' : 'not-allowed', whiteSpace: 'nowrap' }}
              onClick={(): void => {
                if (statefulFilter) {
                  if (labelAct) {
                    isExactlyLabelFilter && statefulFilter.current!.removeFilter(labelFilt.category, label);
                  } else {
                    statefulFilter.current!.filterAdded(labelFilt, label);
                  }
                }
              }}
            />
          );

          return statefulFilter ? (
            <Tooltip
              key={`Tooltip_Label_${key}_${value}`}
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
              {labelComponent}
            </Tooltip>
          ) : (
            labelComponent
          );
        })}
    </Td>
  );
};

export const health: Renderer<TResource> = (item: TResource, __: Resource, _: PFBadgeType, health?: Health) => {
  return (
    <Td
      role="gridcell"
      dataLabel="Health"
      key={`VirtuaItem_Health_${item.namespace}_${item.name}`}
      style={{ verticalAlign: 'middle' }}
    >
      {health && <HealthIndicator id={item.name} health={health} />}
    </Td>
  );
};

export const workloadType: Renderer<WorkloadListItem> = (item: WorkloadListItem) => {
  return (
    <Td
      role="gridcell"
      dataLabel="Type"
      key={`VirtuaItem_WorkloadType_${item.namespace}_${item.name}`}
      style={{ verticalAlign: 'middle' }}
    >
      {item.type}
    </Td>
  );
};

export const istioType: Renderer<IstioConfigItem> = (item: IstioConfigItem) => {
  return (
    <Td
      role="gridcell"
      dataLabel="Type"
      key={`VirtuaItem_IstioType_${item.namespace}_${item.name}`}
      style={{ verticalAlign: 'middle' }}
    >
      {kindToStringIncludeK8s(item.apiVersion, item.kind)}
    </Td>
  );
};

export const istioConfiguration: Renderer<IstioConfigItem> = (item: IstioConfigItem, config: Resource) => {
  const validation = item.validation;
  const reconciledCondition = getReconciliationCondition(item);
  const linkQuery: string = item['type'] ? 'list=yaml' : '';

  return (
    <Td
      role="gridcell"
      dataLabel="Configuration"
      key={`VirtuaItem_Conf_${item.namespace}_${item.name}`}
      style={{ verticalAlign: 'middle' }}
    >
      {validation ? (
        <Link to={`${getLink(item, config, linkQuery)}`}>
          <ValidationObjectSummary
            id={`${item.name}-config-validation`}
            validations={[validation]}
            reconciledCondition={reconciledCondition}
          />
        </Link>
      ) : (
        <>N/A</>
      )}
    </Td>
  );
};

export const serviceConfiguration: Renderer<ServiceListItem> = (item: ServiceListItem, config: Resource) => {
  const validation = item.validation;
  const linkQuery: string = item['type'] ? 'list=yaml' : '';

  return (
    <Td
      role="gridcell"
      dataLabel="Configuration"
      key={`VirtuaItem_Conf_${item.namespace}_${item.name}`}
      style={{ verticalAlign: 'middle' }}
    >
      {validation ? (
        <Link to={`${getLink(item, config, linkQuery)}`}>
          <ValidationServiceSummary id={`${item.name}-service-validation`} validations={[validation]} />
        </Link>
      ) : (
        <>N/A</>
      )}
    </Td>
  );
};
