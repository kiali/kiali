import * as React from 'react';
import { Workload } from '../../types/Workload';
import { Card, CardBody, CardHeader, Title, TitleSizes, Tooltip, TooltipPosition } from '@patternfly/react-core';
import { kialiStyle } from 'styles/StyleUtils';
import { Labels } from '../../components/Label/Labels';
import { LocalTime } from '../../components/Time/LocalTime';
import { TextOrLink } from '../../components/Link/TextOrLink';
import { renderAPILogo, renderRuntimeLogo } from '../../components/Logo/Logos';
import * as H from '../../types/Health';
import { KialiIcon } from '../../config/KialiIcon';
import { HealthIndicator } from '../../components/Health/HealthIndicator';
import { isMultiCluster, serverConfig } from '../../config';
import { MissingSidecar } from '../../components/MissingSidecar/MissingSidecar';
import { PFBadge, PFBadges } from '../../components/Pf/PfBadges';
import { MissingLabel } from '../../components/MissingLabel/MissingLabel';
import { MissingAuthPolicy } from 'components/MissingAuthPolicy/MissingAuthPolicy';
import { hasMissingAuthPolicy } from 'utils/IstioConfigUtils';
import { DetailDescription } from '../../components/DetailDescription/DetailDescription';
import { isGateway, isWaypoint } from '../../helpers/LabelFilterHelper';
import { AmbientLabel, tooltipMsgType } from '../../components/Ambient/AmbientLabel';
import { validationKey } from '../../types/IstioConfigList';
import { infoStyleProps } from 'styles/InfoStyle';

type WorkloadDescriptionProps = {
  health?: H.Health;
  namespace: string;
  workload?: Workload;
};

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

const infoStyle = kialiStyle({
  ...infoStyleProps,
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

const runtimeInfoStyle = kialiStyle({
  display: 'flex',
  alignItems: 'center',
  marginTop: '0.5rem'
});

export const WorkloadDescription: React.FC<WorkloadDescriptionProps> = (props: WorkloadDescriptionProps) => {
  const workload = props.workload;
  const apps: string[] = [];
  const services: string[] = [];

  if (workload) {
    if (workload.labels[serverConfig.istioLabels.appLabelName]) {
      apps.push(workload.labels[serverConfig.istioLabels.appLabelName]);
    }

    workload.services?.forEach(s => services.push(s.name));
  }

  const isTemplateLabels =
    workload &&
    ['Deployment', 'ReplicaSet', 'ReplicationController', 'DeploymentConfig', 'StatefulSet'].indexOf(workload.type) >=
      0;

  const runtimes = (workload?.runtimes ?? []).map(r => r.name).filter(name => name !== '');

  const workloadProperties = workload ? (
    <>
      <div key="properties-list" className={resourceListStyle}>
        <ul style={{ listStyleType: 'none' }}>
          {workload.istioInjectionAnnotation !== undefined && (
            <li>
              <span>Istio Injection</span>
              {String(workload.istioInjectionAnnotation)}
            </li>
          )}

          <li>
            <span>Type</span>
            {workload.type ? workload.type : 'N/A'}
          </li>

          <li>
            <span>Created</span>
            <div style={{ display: 'inline-block' }}>
              <LocalTime time={workload.createdAt} />
            </div>
          </li>

          <li>
            <span>Version</span>
            {workload.resourceVersion}
          </li>

          {workload.additionalDetails.map((additionalItem, idx) => {
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

          {runtimes.length > 0 && (
            <li id="runtimes">
              <div className={runtimeInfoStyle}>
                <span>Runtimes</span>
                <div style={{ display: 'inline-block' }}>
                  {runtimes
                    .map((rt, idx) => renderRuntimeLogo(rt, idx))
                    .reduce(
                      (list: React.ReactNode[], elem) =>
                        list.length > 0 ? [...list, <span key="sep"> | </span>, elem] : [elem],
                      []
                    )}
                </div>
              </div>
            </li>
          )}
        </ul>
      </div>
    </>
  ) : undefined;

  return workload ? (
    <Card id="WorkloadDescriptionCard" data-test="workload-description-card">
      <CardHeader>
        <Title headingLevel="h5" size={TitleSizes.lg}>
          <div key="service-icon" className={iconStyle}>
            <PFBadge badge={PFBadges.Workload} position={TooltipPosition.top} />
          </div>

          {props.workload ? props.workload.name : 'Workload'}

          {workloadProperties ? (
            <Tooltip
              position={TooltipPosition.right}
              content={<div style={{ textAlign: 'left' }}>{workloadProperties}</div>}
            >
              <KialiIcon.Info className={infoStyle} />
            </Tooltip>
          ) : undefined}

          <span className={healthIconStyle}>
            <HealthIndicator id={workload.name} health={props.health} />
          </span>

          {props.workload &&
            !props.workload.istioSidecar &&
            !props.workload.isAmbient &&
            !isWaypoint(props.workload.labels) && (
              <MissingSidecar
                dataTest={`missing-sidecar-badge-for-${workload.name}-workload-in-${props.namespace}-namespace`}
                namespace={props.namespace}
                tooltip={true}
                className={infoStyle}
                text=""
                isGateway={isGateway(workload.labels)}
              />
            )}

          {props.workload && props.workload.isAmbient && !isWaypoint(props.workload.labels) && (
            <AmbientLabel
              tooltip={tooltipMsgType.workload}
              waypoint={props.workload.waypointWorkloads?.length > 0 ? true : false}
            />
          )}

          {props.workload &&
            hasMissingAuthPolicy(validationKey(props.workload.name, props.namespace), props.workload.validations) && (
              <MissingAuthPolicy namespace={props.namespace} tooltip={true} className={infoStyle} text="" />
            )}

          {props.workload &&
            (!props.workload.appLabel || !props.workload.versionLabel) &&
            !isWaypoint(props.workload.labels) && (
              <MissingLabel
                missingApp={!props.workload.appLabel}
                missingVersion={!props.workload.versionLabel}
                className={infoStyle}
                tooltip={true}
              />
            )}
        </Title>

        {props.workload?.cluster && isMultiCluster && (
          <div key="cluster-icon" className={iconStyle}>
            <PFBadge badge={PFBadges.Cluster} position={TooltipPosition.right} /> {props.workload.cluster}
          </div>
        )}
      </CardHeader>

      <CardBody>
        {workload.labels && (
          <Labels
            labels={workload.labels}
            tooltipMessage={isTemplateLabels ? 'Labels defined on the Workload template' : undefined}
          />
        )}

        <DetailDescription
          namespace={props.namespace}
          apps={apps}
          services={services}
          health={props.health}
          cluster={props.workload?.cluster}
          waypointWorkloads={
            props.workload
              ? isWaypoint(props.workload.labels)
                ? props.workload.waypointWorkloads
                : undefined
              : undefined
          }
        />
      </CardBody>
    </Card>
  ) : (
    <>Loading</>
  );
};
