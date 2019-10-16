import * as React from 'react';
import { Link } from 'react-router-dom';
import { Badge, Tooltip, TooltipPosition } from '@patternfly/react-core';

import MissingSidecar from '../MissingSidecar/MissingSidecar';
import { IstioTypes, Resource, TResource, hasMissingSidecar, Renderer } from './Config';
import { DisplayMode, HealthIndicator } from '../Health/HealthIndicator';
import { ValidationSummary } from '../Validations/ValidationSummary';
import { WorkloadListItem } from '../../types/Workload';
import { dicIstioType, IstioConfigItem } from '../../types/IstioConfigList';
import { AppListItem } from '../../types/AppList';
import { ServiceListItem } from '../../types/ServiceList';
import { ApiTypeIndicator } from '../ApiDocumentation/ApiTypeIndicator';
import { Health } from '../../types/Health';

// Links

const getLink = (item: TResource, config: Resource) => {
  return config.name === 'istio' ? getIstioLink(item) : `/namespaces/${item.namespace}/${config.name}/${item.name}`;
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
  const apiType = (item as ServiceListItem).apiType;
  const hasApiType = apiType && apiType !== '';
  const spacer = hasMissingSC && hasApiType;
  return (
    <td role="gridcell" key={'VirtuaItem_Details_' + item.namespace + '_' + item.name}>
      <span>
        {hasMissingSC && <MissingSidecar namespace={item.namespace} />}
        {spacer && ' '}
        {hasApiType && <ApiTypeIndicator apiType={(item as ServiceListItem).apiType} />}
      </span>
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
    <td role="gridcell" key={'VirtuaItem_Name_' + item.namespace + '_' + item.name}>
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
    <td role="gridcell" key={'VirtuaItem_Namespace_' + item.namespace + '_' + item.name}>
      <Tooltip position={TooltipPosition.top} content={<>Namespace</>}>
        <Badge className={'virtualitem_badge_definition'}>NS</Badge>
      </Tooltip>
      {item.namespace}
    </td>
  );
};

export const health: Renderer<TResource> = (item: TResource, __: Resource, _: string, health?: Health) => {
  return (
    health && (
      <td role="gridcell" key={'VirtuaItem_Health_' + item.namespace + '_' + item.name}>
        <HealthIndicator id={item.name} health={health} mode={DisplayMode.SMALL} />
      </td>
    )
  );
};

export const labelValidation: Renderer<WorkloadListItem> = (item: WorkloadListItem) => {
  const appLabel = item.appLabel;
  const versionLabel = item.versionLabel;
  return (
    <td role="gridcell" key={'VirtuaItem_LabelValidation_' + item.namespace + '_' + item.name}>
      {appLabel || versionLabel ? (
        <span>
          {appLabel && (
            <Badge className={'virtualitem_badge_validation'} isRead={true}>
              app
            </Badge>
          )}
          {versionLabel && (
            <Badge className={'virtualitem_badge_validation'} isRead={true}>
              version
            </Badge>
          )}
        </span>
      ) : (
        <span />
      )}
    </td>
  );
};

export const workloadType: Renderer<WorkloadListItem> = (item: WorkloadListItem) => {
  return (
    <td role="gridcell" key={'VirtuaItem_WorkloadType_' + item.namespace + '_' + item.name}>
      {item.type}
    </td>
  );
};

export const istioType: Renderer<IstioConfigItem> = (item: IstioConfigItem) => {
  const type = item.type;
  const object = IstioTypes[type];
  return (
    <td role="gridcell" key={'VirtuaItem_IstioType_' + item.namespace + '_' + item.name}>
      {type === 'adapter' || type === 'template' ? `${object.name}: ${item[type]![type]}` : object.name}
    </td>
  );
};

export const configuration: Renderer<ServiceListItem | IstioConfigItem> = (item: ServiceListItem | IstioConfigItem) => {
  const validation = item.validation;
  return (
    <td role="gridcell" key={'VirtuaItem_Conf_' + item.namespace + '_' + item.name}>
      {validation ? (
        <ValidationSummary id={item.name + '-config-validation'} validations={[validation]} size="medium" />
      ) : (
        <>N/A</>
      )}
    </td>
  );
};
