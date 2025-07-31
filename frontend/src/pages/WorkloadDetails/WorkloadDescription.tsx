import * as React from 'react';
import { Workload } from '../../types/Workload';
import { hasMissingSidecar } from 'components/VirtualList/Config';
import { Alert, Card, CardBody, CardHeader, Title, TitleSizes, Tooltip, TooltipPosition } from '@patternfly/react-core';
import { kialiStyle } from 'styles/StyleUtils';
import { Labels } from '../../components/Label/Labels';
import { LocalTime } from '../../components/Time/LocalTime';
import { TextOrLink } from '../../components/Link/TextOrLink';
import { renderAPILogo, renderRuntimeLogo } from '../../components/Logo/Logos';
import * as H from '../../types/Health';
import { KialiIcon } from '../../config/KialiIcon';
import { HealthIndicator } from '../../components/Health/HealthIndicator';
import { isMultiCluster } from '../../config';
import { MissingSidecar } from '../../components/MissingSidecar/MissingSidecar';
import { PFBadge, PFBadges } from '../../components/Pf/PfBadges';
import { MissingLabel } from '../../components/MissingLabel/MissingLabel';
import { WorkloadConfigValidation } from '../../components/Validations/WorkloadConfigValidation';
import { getGVKTypeString, isGVKSupported } from 'utils/IstioConfigUtils';
import { DetailDescription } from '../../components/DetailDescription/DetailDescription';
import { AmbientLabel, tooltipMsgType } from '../../components/Ambient/AmbientLabel';
import { gvkType, validationKey } from '../../types/IstioConfigList';
import { infoStyle } from 'styles/IconStyle';
import { classes } from 'typestyle';
import { renderWaypointSimpleLabel } from '../../components/Ambient/WaypointLabel';
import { getAppLabelName } from 'config/ServerConfig';

type WorkloadDescriptionProps = {
  health?: H.Health;
  namespace: string;
  workload?: Workload;
};

const resourceListStyle = kialiStyle({
  display: 'flex',
  $nest: {
    '& > ul > li': {
      display: 'flex',
      $nest: {
        '& span': {
          minWidth: '125px',
          fontWeight: 700
        }
      }
    }
  }
});

const iconStyle = kialiStyle({
  display: 'inline-block'
});

const workloadInfoStyle = kialiStyle({
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
  if (!workload) {
    return <>Loading</>;
  }

  const apps: string[] = [];
  const services: string[] = [];

  // ignore app links for ambient infra
  if (!workload.isWaypoint && !workload.isZtunnel) {
    const appLabelName = getAppLabelName(workload.labels);
    if (appLabelName) {
      apps.push(workload.labels[appLabelName]);
    }
  }

  workload.services?.forEach(s => services.push(s.name));

  const isTemplateLabels =
    [
      getGVKTypeString(gvkType.Deployment),
      getGVKTypeString(gvkType.ReplicaSet),
      getGVKTypeString(gvkType.ReplicationController),
      getGVKTypeString(gvkType.DeploymentConfig),
      getGVKTypeString(gvkType.StatefulSet),
      getGVKTypeString(gvkType.WorkloadGroup)
    ].indexOf(getGVKTypeString(workload.gvk)) >= 0;

  const runtimes = (workload.runtimes ?? []).map(r => r.name).filter(name => name !== '');

  const workloadProperties = (
    <>
      <div key="properties-list" className={resourceListStyle}>
        <ul style={{ listStyleType: 'none' }}>
          {workload.istioInjectionAnnotation !== undefined && (
            <li>
              <span>Istio Injection</span>
              {String(workload.istioInjectionAnnotation)}
            </li>
          )}

          {!isGVKSupported(workload.gvk) && (
            <li>
              <span>API Version</span>
              {`${workload.gvk.Group}.${workload.gvk.Version}`}
            </li>
          )}

          <li>
            <span>Type</span>
            {workload.gvk.Kind || 'N/A'}
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
  );

  return (
    <Card id="WorkloadDescriptionCard" data-test="workload-description-card">
      <CardHeader>
        <Title headingLevel="h5" size={TitleSizes.lg}>
          <div key="service-icon" className={iconStyle}>
            <PFBadge badge={PFBadges.Workload} position={TooltipPosition.top} />
          </div>

          {workload.name}
          <Tooltip
            position={TooltipPosition.right}
            content={<div style={{ textAlign: 'left' }}>{workloadProperties}</div>}
          >
            <KialiIcon.Info className={classes(infoStyle, workloadInfoStyle)} />
          </Tooltip>

          <span className={healthIconStyle}>
            <HealthIndicator id={workload.name} health={props.health} />
          </span>

          {hasMissingSidecar(workload) && (
            <MissingSidecar
              dataTest={`missing-sidecar-badge-for-${workload.name}-workload-in-${props.namespace}-namespace`}
              tooltip={true}
              className={classes(infoStyle, workloadInfoStyle)}
              text=""
            />
          )}

          {workload.isAmbient && !workload.isWaypoint && (
            <AmbientLabel
              tooltip={tooltipMsgType.workload}
              waypoint={workload.waypointWorkloads && workload.waypointWorkloads.length > 0 ? true : false}
            />
          )}

          {(!workload.appLabel || !workload.versionLabel) && !workload.isWaypoint && (
            <MissingLabel
              missingApp={!workload.appLabel}
              missingVersion={!workload.versionLabel}
              className={classes(infoStyle, workloadInfoStyle)}
              tooltip={true}
            />
          )}

          {workload.isWaypoint && renderWaypointSimpleLabel()}
        </Title>

        {workload.cluster && isMultiCluster && (
          <div key="cluster-icon" className={iconStyle}>
            <PFBadge badge={PFBadges.Cluster} position={TooltipPosition.right} /> {workload.cluster}
          </div>
        )}
        {!isGVKSupported(workload.gvk) && (
          <Alert
            variant="info"
            isInline={true}
            title="Kiali can only supply limited information for this workload type"
            style={{ marginTop: '0.25rem' }}
          />
        )}
        <WorkloadConfigValidation
          validations={workload.validations!['workload'][validationKey(workload.name, workload.namespace)]}
          namespace={props.namespace}
          className={classes(workloadInfoStyle)}
        />
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
          apps={apps.length > 0 ? apps : undefined}
          services={services}
          health={props.health}
          cluster={props.workload?.cluster}
          isWaypoint={workload.isWaypoint}
          waypointWorkloads={!workload.isWaypoint ? workload.waypointWorkloads : []}
        />
      </CardBody>
    </Card>
  );
};
