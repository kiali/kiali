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
import { createIcon, SVGIconProps } from '@patternfly/react-icons/dist/esm/createIcon';

export const IstioLogo: React.ComponentClass<SVGIconProps> = createIcon({
  name: 'IstioLogo',
  height: 100,
  width: 75,
  svgPath:
    'm31.05548,54.44523v24.1773c.00065.04512-.03164.084-.07611.09164l-23.27949,3.99047c-.05091.0076-.09834-.02751-.10594-.07841-.00256-.01712-.0003-.03461.00653-.05051L30.87996,30.58635c.02242-.04633.07815-.06572.12449-.04331.0316.01529.05193.04704.05259.08214l-.00156,23.82005Zm3.92367-13.93321v38.21148c.00046.04691.03573.08617.08232.09164l34.87031,3.89415c.0512.00527.09698-.03196.10226-.08316.00167-.01616-.00092-.03247-.00751-.04732L35.15623,4.70041c-.02237-.04636-.07809-.0658-.12444-.04343-.03117.01504-.05144.04612-.05264.08071v35.77433Zm34.68546,45.76213l-38.57341,11.57218c-.02155.00797-.04524.00797-.06679,0l-23.309-11.57217c-.04636-.0203-.06749-.07435-.04719-.12071.01513-.03455.04988-.0563.08757-.05481h61.88241c.0508.00825.08531.05613.07706.10693-.00482.0297-.02369.05525-.05066.06859Z',
  yOffset: 0,
  xOffset: 0
});
export const IstioLogoStyle: React.CSSProperties = { fill: '#516baa' };

export const KialiLogo: React.ComponentClass<SVGIconProps> = createIcon({
  name: 'KialiLogo',
  height: 983,
  width: 1526,
  svgPath:
    'M 351.8,640 C 351.8,530.2 390.4,429.5 454.6,350.5 415,332.3 371,322.2 324.6,322.2 150.9,322.2 10,464.5 10,640 c 0,175.5 140.9,317.8 314.6,317.8 46.3,0 90.4,-10.1 130,-28.3 C 390.3,850.5 351.8,749.8 351.8,640 Z M 653.3,284 c -136.4,60.5 -231.6,197.1 -231.6,356 0,158.8 95.2,295.5 231.6,356 98.4,-87.1 160.4,-214.3 160.4,-356 0,-141.7 -62.1,-268.9 -160.4,-356 z M 810.9,180.9 c -253.6,0 -459.1,205.5 -459.1,459.1 0,253.6 205.5,459.1 459.1,459.1 253.6,0 459.1,-205.5 459.1,-459.1 0,-253.6 -205.5,-459.1 -459.1,-459.1 z m 0,848.3 c -215,0 -389.2,-174.3 -389.2,-389.2 0,-215 174.3,-389.2 389.2,-389.2 214.9,0 389.2,174.2 389.2,389.2 0,215 -174.2,389.2 -389.2,389.2 z',
  yOffset: 0,
  xOffset: 0
});
export const KialiLogoStyle: React.CSSProperties = { fill: '#0093DD' };

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
