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

export interface MeshLegendItem {
  title: string;
  data: MeshLegendItemRow[];
}

export interface MeshLegendItemRow {
  label: string;
  icon: string;
}

export const legendData: MeshLegendItem[] = [
  {
    title: 'Node Shapes',
    data: [
      { label: 'Workload', icon: workloadImage },
      { label: 'App', icon: appImage },
      { label: 'Operation', icon: aggregateImage },
      { label: 'Service', icon: serviceImage },
      { label: 'Service Entry', icon: serviceEntryImage }
    ]
  },
  {
    title: 'Node Colors',
    data: [
      { label: 'Healthy', icon: nodeColorHealthyImage },
      { label: 'Warn', icon: nodeColorWarningImage },
      { label: 'Unhealthy', icon: nodeColorDangerImage },
      { label: 'Idle', icon: nodeColorIdleImage }
    ]
  },
  {
    title: 'Node Background',
    data: [
      { label: 'Unselected Namespace', icon: externalNamespaceImage },
      { label: 'Restricted / External', icon: restrictedNamespaceImage }
    ]
  },
  {
    title: 'Edges',
    data: [
      { label: 'Failure', icon: edgeDangerImage },
      { label: 'Degraded', icon: edgeWarnImage },
      { label: 'Healthy', icon: edgeSuccessImage },
      { label: 'TCP Connection', icon: edgeTcpImage },
      { label: 'Idle', icon: edgeIdlemage },
      { label: 'mTLS (badge)', icon: edgeMtlsImage }
    ]
  },
  {
    title: 'Traffic Animation',
    data: [
      { label: 'Healthy Request', icon: trafficHealthyImage },
      { label: 'Failed Request', icon: trafficFailedImage },
      { label: 'TCP Traffic', icon: trafficTcpImage }
    ]
  },
  {
    title: 'Node Badges',
    data: [
      { label: 'Circuit Breaker', icon: badgeCircuitBreakerImage },
      { label: 'Fault Injection', icon: badgeFaultInjectionImage },
      { label: 'Gateway', icon: badgeGatewaysImage },
      { label: 'Mirroring', icon: badgeMirroringImage },
      { label: 'Missing Sidecar', icon: badgeMissingSidecarImage },
      { label: 'Request Timeout', icon: badgeRequestTimeoutImage },
      { label: 'Traffic Shifting / TCP Traffic Shifting', icon: badgeTrafficShiftingSourceImage },
      { label: 'Traffic Source', icon: badgeTrafficSourceImage },
      { label: 'Virtual Service / Request Routing', icon: badgeVirtualServicesImage },
      { label: 'Workload Entry', icon: badgeWorkloadEntryImage }
    ]
  }
];
