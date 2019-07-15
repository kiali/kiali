import MissingSidecar from '../MissingSidecar/MissingSidecar';
import { Link } from 'react-router-dom';
import { IstioTypes, Resource, TResource } from './Config';
import * as React from 'react';
import { DisplayMode, HealthIndicator } from '../Health/HealthIndicator';
import { Badge } from '@patternfly/react-core';
import { ConfigIndicator } from '../ConfigValidation/ConfigIndicator';
import { WorkloadListItem } from '../../types/Workload';
import { dicIstioType, IstioConfigItem } from '../../types/IstioConfigList';
import { AppListItem } from '../../types/AppList';
import { ServiceListItem } from '../../types/ServiceList';

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
export const Sidecar = (item: AppListItem | WorkloadListItem | ServiceListItem) => {
  const istioSidecar = !item.istioSidecar;
  return (
    <td role="gridcell" key={'VirtuaItem_Sidecar_' + item.namespace + '_' + item.name}>
      {istioSidecar && <MissingSidecar namespace={item.namespace} />}
    </td>
  );
};

export const Item = (item: TResource, config: Resource, icon: string) => {
  const key = 'link_definition_' + config.name + '_' + item.namespace + '_' + item.name;
  return (
    <td role="gridcell" key={'VirtuaItem_Name_' + item.namespace + '_' + item.name}>
      <Badge className={'virtualitem_badge_definition'}>{icon}</Badge>
      <Link key={key} to={getLink(item, config)} className={'virtualitem_definition_link'}>
        {item.name}
      </Link>
    </td>
  );
};

export const Namespace = (item: TResource) => {
  return (
    <td role="gridcell" key={'VirtuaItem_Namespace_' + item.namespace + '_' + item.name}>
      <Badge className={'virtualitem_badge_definition'}>NS</Badge>
      {item.namespace}
    </td>
  );
};

export const Health = (item: TResource, __: Resource, _: string, health: any) => {
  return (
    health && (
      <td role="gridcell" key={'VirtuaItem_Health_' + item.namespace + '_' + item.name}>
        <HealthIndicator id={item.name} health={health} mode={DisplayMode.SMALL} />
      </td>
    )
  );
};

export const LabelValidation = (item: WorkloadListItem, __: Resource, _: string, ___: any) => {
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

export const WorkloadType = (item: WorkloadListItem) => {
  return (
    <td role="gridcell" key={'VirtuaItem_WorkloadType_' + item.namespace + '_' + item.name}>
      {item.type}
    </td>
  );
};

export const IstioType = (item: IstioConfigItem) => {
  const type = item.type;
  const object = IstioTypes[type];
  return (
    <td role="gridcell" key={'VirtuaItem_IstioType_' + item.namespace + '_' + item.name}>
      {type === 'adapter' || type === 'template' ? `${object.name}: ${item[type]![type]}` : object.name}
    </td>
  );
};

export const Configuration = (item: ServiceListItem | IstioConfigItem) => {
  const validation = item.validation;
  return (
    <td role="gridcell" key={'VirtuaItem_Conf_' + item.namespace + '_' + item.name}>
      {validation ? (
        <ConfigIndicator id={item.name + '-config-validation'} validations={[validation]} size="medium" />
      ) : (
        <>N/A</>
      )}
    </td>
  );
};
