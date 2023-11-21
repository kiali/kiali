// Node Shapes
import workloadImage from '../../assets/img/legend-pf/node.svg';
import appImage from '../../assets/img/legend-pf/app.svg';
import serviceImage from '../../assets/img/legend-pf/service.svg';
import aggregateImage from '../../assets/img/legend-pf/aggregate.svg';
import serviceEntryImage from '../../assets/img/legend-pf/service-entry.svg';
// Node Colors
import nodeColorHealthyImage from '../../assets/img/legend-pf/node-color-healthy.svg';
import nodeColorWarningImage from '../../assets/img/legend-pf/node-color-warning.svg';
import nodeColorDangerImage from '../../assets/img/legend-pf/node-color-danger.svg';
import nodeColorIdleImage from '../../assets/img/legend-pf/node-color-idle.svg';
// Node Background
import externalNamespaceImage from '../../assets/img/legend-pf/external-namespace.svg';
import restrictedNamespaceImage from '../../assets/img/legend-pf/restricted-namespace.svg';
// Edges
import edgeSuccessImage from '../../assets/img/legend-pf/edge-success.svg';
import edgeDangerImage from '../../assets/img/legend-pf/edge-danger.svg';
import edgeWarnImage from '../../assets/img/legend-pf/edge-warn.svg';
import edgeIdlemage from '../../assets/img/legend-pf/edge-idle.svg';
import edgeTcpImage from '../../assets/img/legend-pf/edge-tcp.svg';
import edgeMtlsImage from '../../assets/img/legend-pf/mtls-badge.svg';
// Traffic Animation
import trafficHealthyImage from '../../assets/img/legend-pf/traffic-healthy-request.svg';
import trafficFailedImage from '../../assets/img/legend-pf/traffic-failed-request.svg';
import trafficTcpImage from '../../assets/img/legend-pf/traffic-tcp.svg';
// Badges
import badgeCircuitBreakerImage from '../../assets/img/legend-pf/node-badge-circuit-breaker.svg';
import badgeFaultInjectionImage from '../../assets/img/legend-pf/node-badge-fault-injection.svg';
import badgeGatewaysImage from '../../assets/img/legend-pf/node-badge-gateways.svg';
import badgeMirroringImage from '../../assets/img/legend-pf/node-badge-mirroring.svg';
import badgeMissingSidecarImage from '../../assets/img/legend-pf/node-badge-missing-sidecar.svg';
import badgeRequestTimeoutImage from '../../assets/img/legend-pf/node-badge-request-timeout.svg';
import badgeTrafficShiftingSourceImage from '../../assets/img/legend-pf/node-badge-traffic-shifting.svg';
import badgeTrafficSourceImage from '../../assets/img/legend-pf/node-badge-traffic-source.svg';
import badgeVirtualServicesImage from '../../assets/img/legend-pf/node-badge-virtual-services.svg';
import badgeWorkloadEntryImage from '../../assets/img/legend-pf/node-badge-workload-entry.svg';

export interface GraphLegendItem {
  title: string;
  data: GraphLegendItemRow[];
}

export interface GraphLegendItemRow {
  label: string;
  icon: string;
}

export const legendData: GraphLegendItem[] = [
  {
    title: $t('NodeShapes', 'Node Shapes'),
    data: [
      { label: $t('Workload'), icon: workloadImage },
      { label: $t('App'), icon: appImage },
      { label: $t('Operation'), icon: aggregateImage },
      { label: $t('Service'), icon: serviceImage },
      { label: $t('Service Entry'), icon: serviceEntryImage }
    ]
  },
  {
    title: $t('NodeColors', 'Node Colors'),
    data: [
      { label: $t('Healthy'), icon: nodeColorHealthyImage },
      { label: $t('Warn'), icon: nodeColorWarningImage },
      { label: $t('Unhealthy'), icon: nodeColorDangerImage },
      { label: $t('Idle'), icon: nodeColorIdleImage }
    ]
  },
  {
    title: $t('NodeBackground', 'Node Background'),
    data: [
      { label: $t('UnselectedNamespace', 'Unselected Namespace'), icon: externalNamespaceImage },
      { label: $t('title10', 'Restricted / External'), icon: restrictedNamespaceImage }
    ]
  },
  {
    title: $t('Edges'),
    data: [
      { label: $t('Failure'), icon: edgeDangerImage },
      { label: $t('Degraded'), icon: edgeWarnImage },
      { label: $t('Healthy'), icon: edgeSuccessImage },
      { label: $t('TCPConnection', 'TCP Connection'), icon: edgeTcpImage },
      { label: $t('Idle'), icon: edgeIdlemage },
      { label: $t('title11', 'mTLS (badge)'), icon: edgeMtlsImage }
    ]
  },
  {
    title: $t('TrafficAnimation', 'Traffic Animation'),
    data: [
      { label: $t('HealthyRequest', 'Healthy Request'), icon: trafficHealthyImage },
      { label: $t('FailedRequest', 'Failed Request'), icon: trafficFailedImage },
      { label: $t('TCPTraffic', 'TCP Traffic'), icon: trafficTcpImage }
    ]
  },
  {
    title: $t('NodeBadges', 'Node Badges'),
    data: [
      { label: $t('CircuitBreaker', 'Circuit Breaker'), icon: badgeCircuitBreakerImage },
      { label: $t('FaultInjection', 'Fault Injection'), icon: badgeFaultInjectionImage },
      { label: $t('Gateway'), icon: badgeGatewaysImage },
      { label: $t('Mirroring'), icon: badgeMirroringImage },
      { label: $t('MissingSidecar', 'Missing Sidecar'), icon: badgeMissingSidecarImage },
      { label: $t('RequestTimeout', 'Request Timeout'), icon: badgeRequestTimeoutImage },
      { label: $t('title12', 'Traffic Shifting / TCP Traffic Shifting'), icon: badgeTrafficShiftingSourceImage },
      { label: $t('TrafficSource', 'Traffic Source'), icon: badgeTrafficSourceImage },
      { label: $t('title13', 'Virtual Service / Request Routing'), icon: badgeVirtualServicesImage },
      { label: $t('Workload_Entry', 'Workload Entry'), icon: badgeWorkloadEntryImage }
    ]
  }
];
