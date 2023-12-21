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
    title: $t('legendData.NodeShapes', 'Node Shapes'),
    data: [
      { label: $t('legendData.Workload', 'Workload'), icon: workloadImage },
      { label: $t('legendData.App', 'App'), icon: appImage },
      { label: $t('legendData.Operation', 'Operation'), icon: aggregateImage },
      { label: $t('legendData.Service', 'Service'), icon: serviceImage },
      { label: $t('legendData.ServiceEntry', 'Service Entry'), icon: serviceEntryImage }
    ]
  },
  {
    title: $t('legendData.NodeColors', 'Node Colors'),
    data: [
      { label: $t('legendData.Healthy', 'Healthy'), icon: nodeColorHealthyImage },
      { label: $t('legendData.Warn', 'Warn'), icon: nodeColorWarningImage },
      { label: $t('legendData.Unhealthy', 'Unhealthy'), icon: nodeColorDangerImage },
      { label: $t('legendData.Idle', 'Idle'), icon: nodeColorIdleImage }
    ]
  },
  {
    title: $t('legendData.NodeBackground', 'Node Background'),
    data: [
      { label: $t('legendData.UnselectedNamespace', 'Unselected Namespace'), icon: externalNamespaceImage },
      { label: $t('legendData.Restricted/External', 'Restricted / External'), icon: restrictedNamespaceImage }
    ]
  },
  {
    title: $t('legendData.Edges', 'Edges'),
    data: [
      { label: $t('legendData.Failure', 'Failure'), icon: edgeDangerImage },
      { label: $t('legendData.Degraded', 'Degraded'), icon: edgeWarnImage },
      { label: $t('legendData.Healthy', 'Healthy'), icon: edgeSuccessImage },
      { label: $t('TCP.Connection', 'TCP Connection'), icon: edgeTcpImage },
      { label: $t('legendData.Idle', 'Idle'), icon: edgeIdlemage },
      { label: $t('legendData.mTLSBadge', 'mTLS (badge)'), icon: edgeMtlsImage }
    ]
  },
  {
    title: $t('legendData.TrafficAnimation', 'Traffic Animation'),
    data: [
      { label: $t('HealthyRequest', 'Healthy Request'), icon: trafficHealthyImage },
      { label: $t('legendData.FailedRequest', 'Failed Request'), icon: trafficFailedImage },
      { label: $t('legendData.TCPTraffic', 'TCP Traffic'), icon: trafficTcpImage }
    ]
  },
  {
    title: $t('legendData.NodeBadges', 'Node Badges'),
    data: [
      { label: $t('legendData.CircuitBreaker', 'Circuit Breaker'), icon: badgeCircuitBreakerImage },
      { label: $t('legendData.FaultInjection', 'Fault Injection'), icon: badgeFaultInjectionImage },
      { label: $t('legendData.Gateway', 'Gateway'), icon: badgeGatewaysImage },
      { label: $t('legendData.Mirroring', 'Mirroring'), icon: badgeMirroringImage },
      { label: $t('legendData.MissingSidecar', 'Missing Sidecar'), icon: badgeMissingSidecarImage },
      { label: $t('legendData.RequestTimeout', 'Request Timeout'), icon: badgeRequestTimeoutImage },
      {
        label: $t('legendData.Shifting', 'Traffic Shifting / TCP Traffic Shifting'),
        icon: badgeTrafficShiftingSourceImage
      },
      { label: $t('legendData.TrafficSource', 'Traffic Source'), icon: badgeTrafficSourceImage },
      {
        label: $t('legendData.VirtualService/RequestRouting', 'Virtual Service / Request Routing'),
        icon: badgeVirtualServicesImage
      },
      { label: $t('legendData.WorkloadEntry', 'Workload Entry'), icon: badgeWorkloadEntryImage }
    ]
  }
];
