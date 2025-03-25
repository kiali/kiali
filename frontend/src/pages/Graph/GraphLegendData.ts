// Node Shapes
import workloadImage from '../../assets/img/graph/legend/node.svg';
import appImage from '../../assets/img/graph/legend/app.svg';
import serviceImage from '../../assets/img/graph/legend/service.svg';
import operationImage from '../../assets/img/graph/legend/operation.svg';
import serviceEntryImage from '../../assets/img/graph/legend/service-entry.svg';
// Node Colors
import nodeColorHealthyImage from '../../assets/img/graph/legend/node-color-healthy.svg';
import nodeColorWarningImage from '../../assets/img/graph/legend/node-color-warning.svg';
import nodeColorDangerImage from '../../assets/img/graph/legend/node-color-danger.svg';
import nodeColorIdleImage from '../../assets/img/graph/legend/node-color-idle.svg';
// Node Background
import externalNamespaceImage from '../../assets/img/graph/external-namespace.svg';
import restrictedNamespaceImage from '../../assets/img/graph/restricted-namespace.svg';
// Edges
import edgeSuccessImage from '../../assets/img/graph/legend/edge-success.svg';
import edgeDangerImage from '../../assets/img/graph/legend/edge-danger.svg';
import edgeWarnImage from '../../assets/img/graph/legend/edge-warn.svg';
import edgeIdlemage from '../../assets/img/graph/legend/edge-idle.svg';
import edgeTcpImage from '../../assets/img/graph/legend/edge-tcp.svg';
import edgeMtlsImage from '../../assets/img/graph/mtls-badge.svg';
// Traffic Animation
import trafficHealthyImage from '../../assets/img/graph/legend/traffic-healthy-request.svg';
import trafficFailedImage from '../../assets/img/graph/legend/traffic-failed-request.svg';
import trafficTcpImage from '../../assets/img/graph/legend/traffic-tcp.svg';
// Badges
import badgeCircuitBreakerImage from '../../assets/img/graph/node-badge-circuit-breaker.svg';
import badgeFaultInjectionImage from '../../assets/img/graph/node-badge-fault-injection.svg';
import badgeGatewaysImage from '../../assets/img/graph/node-badge-gateways.svg';
import badgeMirroringImage from '../../assets/img/graph/node-badge-mirroring.svg';
import badgeMissingSidecarImage from '../../assets/img/graph/node-badge-missing-sidecar.svg';
import badgeRequestTimeoutImage from '../../assets/img/graph/node-badge-request-timeout.svg';
import badgeTrafficShiftingSourceImage from '../../assets/img/graph/node-badge-traffic-shifting.svg';
import badgeTrafficSourceImage from '../../assets/img/graph/node-badge-traffic-source.svg';
import badgeVirtualServicesImage from '../../assets/img/graph/node-badge-virtual-services.svg';
import badgeWorkloadEntryImage from '../../assets/img/graph/node-badge-workload-entry.svg';
import badgeWaypointImage from '../../assets/img/graph/node-badge-waypoint.svg';
import { t } from 'utils/I18nUtils';
import { serverConfig } from '../../config';

export interface GraphLegendItem {
  data: GraphLegendItemRow[];
  isBadge?: boolean;
  title: string;
}

export interface GraphLegendItemRow {
  icon: string;
  label: string;
}

export const legendData = (): GraphLegendItem[] => {
  const nodeBadges = [
    { label: t('Circuit Breaker'), icon: badgeCircuitBreakerImage },
    { label: t('Fault Injection'), icon: badgeFaultInjectionImage },
    { label: t('Gateway'), icon: badgeGatewaysImage },
    { label: t('Mirroring'), icon: badgeMirroringImage },
    { label: t('Missing Sidecar'), icon: badgeMissingSidecarImage },
    { label: t('Request Timeout'), icon: badgeRequestTimeoutImage },
    { label: t('Traffic Shifting / TCP Traffic Shifting'), icon: badgeTrafficShiftingSourceImage },
    { label: t('Traffic Source'), icon: badgeTrafficSourceImage },
    { label: t('Virtual Service / Request Routing'), icon: badgeVirtualServicesImage },
    { label: t('Workload Entry'), icon: badgeWorkloadEntryImage }
  ];

  if (serverConfig.ambientEnabled) {
    nodeBadges.push({ label: t('Waypoint'), icon: badgeWaypointImage });
  }

  return [
    {
      title: t('Node Shapes'),
      data: [
        { label: t('Workload'), icon: workloadImage },
        { label: t('App'), icon: appImage },
        { label: t('Operation'), icon: operationImage },
        { label: t('Service'), icon: serviceImage },
        { label: t('Service Entry'), icon: serviceEntryImage }
      ]
    },
    {
      title: t('Node Colors'),
      data: [
        { label: t('Healthy'), icon: nodeColorHealthyImage },
        { label: t('Warn'), icon: nodeColorWarningImage },
        { label: t('Unhealthy'), icon: nodeColorDangerImage },
        { label: t('Idle'), icon: nodeColorIdleImage }
      ]
    },
    {
      title: t('Node Background'),
      data: [
        { label: t('Unselected Namespace'), icon: externalNamespaceImage },
        { label: t('Restricted / External'), icon: restrictedNamespaceImage }
      ]
    },
    {
      title: t('Edges'),
      data: [
        { label: t('Failure'), icon: edgeDangerImage },
        { label: t('Degraded'), icon: edgeWarnImage },
        { label: t('Healthy'), icon: edgeSuccessImage },
        { label: t('TCP Connection'), icon: edgeTcpImage },
        { label: t('Idle'), icon: edgeIdlemage },
        { label: t('mTLS (badge)'), icon: edgeMtlsImage }
      ]
    },
    {
      title: t('Traffic Animation'),
      data: [
        { label: t('Healthy Request'), icon: trafficHealthyImage },
        { label: t('Failed Request'), icon: trafficFailedImage },
        { label: t('TCP Traffic'), icon: trafficTcpImage }
      ]
    },
    {
      title: t('Node Badges'),
      isBadge: true,
      data: nodeBadges
    }
  ];
};
