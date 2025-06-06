import * as React from 'react';
import { Card, CardBody, CardHeader, Title, TitleSizes, Tooltip, TooltipPosition } from '@patternfly/react-core';
import { ServiceDetailsInfo, WorkloadOverview } from '../../types/ServiceInfo';
import { AppWorkload } from '../../types/App';
import { isMultiCluster } from '../../config';
import { Labels } from '../../components/Label/Labels';
import { kialiStyle } from 'styles/StyleUtils';
import { LocalTime } from '../../components/Time/LocalTime';
import { renderAPILogo } from '../../components/Logo/Logos';
import { TextOrLink } from '../../components/Link/TextOrLink';
import { KialiIcon } from '../../config/KialiIcon';
import { HealthIndicator } from '../../components/Health/HealthIndicator';
import { PFBadge, PFBadges } from '../../components/Pf/PfBadges';
import { DetailDescription } from '../../components/DetailDescription/DetailDescription';
import { AmbientLabel, tooltipMsgType } from '../../components/Ambient/AmbientLabel';
import { infoStyle } from 'styles/IconStyle';
import { classes } from 'typestyle';
import { getIstioObjectGVK } from '../../utils/IstioConfigUtils';
import { getAppLabelName } from 'config/ServerConfig';

interface ServiceInfoDescriptionProps {
  namespace: string;
  serviceDetails?: ServiceDetailsInfo;
}

const resourceListStyle = kialiStyle({
  marginBottom: '0.75rem',
  $nest: {
    '& > ul > li span': {
      float: 'left',
      width: '125px',
      fontWeight: 700
    }
  }
});

const iconStyle = kialiStyle({
  display: 'inline-block'
});

const serviceInfoStyle = kialiStyle({
  verticalAlign: '-0.125rem'
});

const healthIconStyle = kialiStyle({
  marginLeft: '0.5rem',
  verticalAlign: '-0.075rem'
});

const additionalItemStyle = kialiStyle({
  display: 'flex',
  alignItems: 'center'
});

export const ServiceDescription: React.FC<ServiceInfoDescriptionProps> = (props: ServiceInfoDescriptionProps) => {
  const apps: string[] = [];
  const workloads: AppWorkload[] = [];

  if (props.serviceDetails) {
    if (props.serviceDetails.workloads) {
      props.serviceDetails.workloads
        .sort((w1: WorkloadOverview, w2: WorkloadOverview) => (w1.name < w2.name ? -1 : 1))
        .forEach(wk => {
          // ignore app links for ambient infra
          if (wk.labels && !wk.isWaypoint && !wk.isZtunnel) {
            const appLabelName = getAppLabelName(wk.labels);
            if (appLabelName) {
              const appName = wk.labels[appLabelName];
              if (!apps.includes(appName)) {
                apps.push(appName);
              }
            }
          }

          workloads.push({
            namespace: wk.namespace,
            workloadName: wk.name,
            gvk: getIstioObjectGVK(wk.resourceVersion, wk.type),
            istioSidecar: wk.istioSidecar,
            isAmbient: wk.isAmbient,
            isGateway: wk.isGateway,
            isWaypoint: wk.isWaypoint,
            isZtunnel: wk.isZtunnel,
            serviceAccountNames: wk.serviceAccountNames,
            labels: wk.labels ?? {}
          });
        });
    }
  }

  // We will show service labels only when there is some label that is not present in the selector
  let showServiceLabels = false;

  if (props.serviceDetails && props.serviceDetails.service.labels && props.serviceDetails.service.selectors) {
    const keys = Object.keys(props.serviceDetails.service.labels);

    for (let i = 0; i < keys.length; i++) {
      const key = keys[i];
      const value = props.serviceDetails.service.labels[key];

      if (props.serviceDetails.service.selectors[key] !== value) {
        showServiceLabels = true;
        break;
      }
    }
  }

  const serviceProperties = (
    <div key="properties-list" className={resourceListStyle}>
      <ul style={{ listStyleType: 'none' }}>
        {props.serviceDetails && (
          <li>
            <span>Created</span>

            <div style={{ display: 'inline-block' }}>
              <LocalTime time={props.serviceDetails.service.createdAt} />
            </div>
          </li>
        )}

        {props.serviceDetails && (
          <li>
            <span>Version</span>
            {props.serviceDetails.service.resourceVersion}
          </li>
        )}

        {props.serviceDetails?.service?.additionalDetails?.map((additionalItem, idx) => {
          return (
            <li key={`additional-details-${idx}`} id={`additional-details-${idx}`}>
              <div className={additionalItemStyle}>
                <span>{additionalItem.title}</span>
                {additionalItem.icon && renderAPILogo(additionalItem.icon, undefined, idx)}
              </div>
              <TextOrLink text={additionalItem.value} urlTruncate={64} />
            </li>
          );
        })}
      </ul>
    </div>
  );

  const serviceName = props.serviceDetails ? props.serviceDetails.service.name : 'Service';
  let serviceBadge = PFBadges.Service;

  if (props.serviceDetails && props.serviceDetails.service) {
    switch (props.serviceDetails.service.type) {
      case 'External':
        serviceBadge = PFBadges.ExternalService;
        break;
      case 'Federation':
        serviceBadge = PFBadges.FederatedService;
        break;
      default:
        serviceBadge = PFBadges.Service;
    }
  }

  return (
    <Card id="ServiceDescriptionCard">
      <CardHeader>
        <Title headingLevel="h5" size={TitleSizes.lg}>
          <div key="service-icon" className={iconStyle}>
            <PFBadge badge={serviceBadge} position={TooltipPosition.top} />
          </div>

          {serviceName}

          <Tooltip
            position={TooltipPosition.right}
            content={<div style={{ textAlign: 'left' }}>{serviceProperties}</div>}
          >
            <KialiIcon.Info className={classes(infoStyle, serviceInfoStyle)} />
          </Tooltip>

          <span className={healthIconStyle}>
            <HealthIndicator id={serviceName} health={props.serviceDetails ? props.serviceDetails.health : undefined} />
          </span>

          {props.serviceDetails?.isAmbient && <AmbientLabel tooltip={tooltipMsgType.service} />}
        </Title>

        {props.serviceDetails?.service.cluster && isMultiCluster && (
          <div key="cluster-icon" className={iconStyle}>
            <PFBadge badge={PFBadges.Cluster} position={TooltipPosition.right} /> {props.serviceDetails.service.cluster}
          </div>
        )}
      </CardHeader>

      <CardBody>
        {props.serviceDetails && showServiceLabels && (
          <Labels labels={props.serviceDetails.service.labels} tooltipMessage="Labels defined on the Service" />
        )}

        {props.serviceDetails && (
          <Labels
            labels={props.serviceDetails.service.selectors}
            tooltipMessage={`Labels defined on the ${showServiceLabels ? 'Selector' : 'Service and Selector'}`}
          />
        )}

        <DetailDescription
          namespace={props.namespace}
          apps={apps.length > 0 ? apps : undefined}
          workloads={workloads}
          health={props.serviceDetails?.health}
          cluster={props.serviceDetails?.service.cluster}
          waypointWorkloads={props.serviceDetails?.waypointWorkloads}
        />
      </CardBody>
    </Card>
  );
};
