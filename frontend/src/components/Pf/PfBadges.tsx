import { Badge, Tooltip, TooltipPosition } from '@patternfly/react-core';
import React, { CSSProperties } from 'react';
import { kialiStyle } from 'styles/StyleUtils';
import { PFColors } from './PfColors';

export type PFBadgeType = {
  badge: string;
  style?: React.CSSProperties;
  tt?: React.ReactFragment;
};

// PF Badges used by Kiali, keep alphabetized
// avoid duplicate badge letters, especially if they may appear on the same page
export const PFBadges: { [key: string]: PFBadgeType } = Object.freeze({
  App: { badge: 'A', tt: 'Application', style: { backgroundColor: PFColors.Green500 } } as PFBadgeType,
  Adapter: { badge: 'A', tt: 'Adapter' } as PFBadgeType,
  AttributeManifest: { badge: 'AM', tt: 'Attribute Manifest' } as PFBadgeType,
  AuthorizationPolicy: { badge: 'AP', tt: 'Authorization Policy' } as PFBadgeType,
  Cluster: { badge: 'C', tt: 'Cluster', style: { backgroundColor: PFColors.Blue300 } } as PFBadgeType,
  ClusterRBACConfig: { badge: 'CRC', tt: 'Cluster RBAC Configuration' } as PFBadgeType,
  Container: { badge: 'C', tt: 'Container', style: { backgroundColor: PFColors.Blue300 } } as PFBadgeType,
  DataPlane: { badge: 'DP', tt: 'Data Plane' } as PFBadgeType,
  DestinationRule: { badge: 'DR', tt: 'Destination Rule' } as PFBadgeType,
  EnvoyFilter: { badge: 'EF', tt: 'Envoy Filter' } as PFBadgeType,
  Extension: { badge: 'E', tt: 'Extension', style: { backgroundColor: PFColors.Black400 } } as PFBadgeType,
  ExternalService: { badge: 'ES', tt: 'External Service' } as PFBadgeType,
  FaultInjectionAbort: {
    badge: 'FI',
    tt: 'Fault Injection: Abort',
    style: { backgroundColor: PFColors.Purple500 }
  } as PFBadgeType,
  FaultInjectionDelay: {
    badge: 'FI',
    tt: 'Fault Injection: Delay',
    style: { backgroundColor: PFColors.Purple500 }
  } as PFBadgeType,
  FederatedService: { badge: 'FS', tt: 'Federated Service' } as PFBadgeType,
  GRPCRoute: { badge: 'gRPC', tt: 'GRPCRoute' } as PFBadgeType,
  Gateway: { badge: 'G', tt: 'Gateway' } as PFBadgeType,
  Grafana: { badge: 'GR', tt: 'Grafana' } as PFBadgeType,
  HTTPRoute: { badge: 'HTTP', tt: 'HTTPRoute' } as PFBadgeType,
  K8sGateway: { badge: 'G', tt: 'Gateway (K8s)' } as PFBadgeType,
  K8sGRPCRoute: { badge: 'gRPC', tt: 'GRPCRoute (K8s)' } as PFBadgeType,
  K8sHTTPRoute: { badge: 'HTTP', tt: 'HTTPRoute (K8s)' } as PFBadgeType,
  K8sReferenceGrant: { badge: 'RG', tt: 'ReferenceGrant (K8s)' } as PFBadgeType,
  K8sTCPRoute: { badge: 'TCP', tt: 'TCPRoute (K8s)' } as PFBadgeType,
  K8sTLSRoute: { badge: 'TLS', tt: 'TLSRoute (K8s)' } as PFBadgeType,
  Kiali: { badge: 'KI', tt: 'Kiali' } as PFBadgeType,
  Handler: { badge: 'H', tt: 'Handler' },
  Host: { badge: 'H', tt: 'Host' },
  Instance: { badge: 'I', tt: 'Instance' },
  Istio: { badge: 'IS', tt: 'Istio' } as PFBadgeType,
  MeshPolicy: { badge: 'MP', tt: 'Mesh Policy' } as PFBadgeType,
  MetricStore: { badge: 'MS', tt: 'Metric Store' } as PFBadgeType,
  MirroredWorkload: {
    badge: 'MI',
    tt: 'Mirrored Workload',
    style: { backgroundColor: PFColors.Purple500 }
  } as PFBadgeType,
  Namespace: { badge: 'NS', tt: 'Namespace', style: { backgroundColor: PFColors.Green600 } } as PFBadgeType,
  Operation: { badge: 'O', tt: 'Operation' } as PFBadgeType,
  PeerAuthentication: { badge: 'PA', tt: 'Peer Authentication' } as PFBadgeType,
  Pod: { badge: 'P', tt: 'Pod', style: { backgroundColor: PFColors.Cyan300 } } as PFBadgeType,
  Policy: { badge: 'P', tt: 'Policy' } as PFBadgeType,
  RBACConfig: { badge: 'RC', tt: 'RBAC Configuration' } as PFBadgeType,
  RequestAuthentication: { badge: 'RA', tt: 'Request Authentication' } as PFBadgeType,
  RequestRetry: {
    badge: 'RR',
    tt: 'Request Retry',
    style: { backgroundColor: PFColors.Purple500 }
  } as PFBadgeType,
  RequestTimeout: {
    badge: 'RT',
    tt: 'Request Timeout',
    style: { backgroundColor: PFColors.Purple500 }
  } as PFBadgeType,
  Rule: { badge: 'R', tt: 'Rule' } as PFBadgeType,
  Service: { badge: 'S', tt: 'Service', style: { backgroundColor: PFColors.LightGreen500 } } as PFBadgeType,
  ServiceEntry: { badge: 'SE', tt: 'Service Entry' } as PFBadgeType,
  ServiceRole: { badge: 'SR', tt: 'Service Role' } as PFBadgeType,
  ServiceRoleBinding: { badge: 'SRB', tt: 'Service Role Binding' } as PFBadgeType,
  Sidecar: { badge: 'SC', tt: 'Istio Sidecar Proxy' } as PFBadgeType,
  WasmPlugin: { badge: 'WP', tt: 'Istio Wasm Plugin' } as PFBadgeType,
  Telemetry: { badge: 'TM', tt: 'Istio Telemetry' } as PFBadgeType,
  Template: { badge: 'T', tt: 'Template' } as PFBadgeType,
  TCPRoute: { badge: 'TCP', tt: 'TCPRoute' } as PFBadgeType,
  TLSRoute: { badge: 'TLS', tt: 'TLSRoute' } as PFBadgeType,
  TraceStore: { badge: 'TS', tt: 'Trace Store' } as PFBadgeType,
  Unknown: { badge: 'U', tt: 'Unknown' } as PFBadgeType,
  VirtualService: { badge: 'VS', tt: 'Virtual Service' } as PFBadgeType,
  Waypoint: { badge: 'L7', tt: 'Waypoint proxy' } as PFBadgeType,
  Workload: { badge: 'W', tt: 'Workload', style: { backgroundColor: PFColors.Blue500 } } as PFBadgeType,
  WorkloadEntry: { badge: 'WE', tt: 'Workload Entry' } as PFBadgeType,
  WorkloadGroup: { badge: 'WG', tt: 'Workload Group' } as PFBadgeType,
  Ztunnel: { badge: 'L4', tt: 'ztunnel' } as PFBadgeType
});

// This is styled for consistency with OpenShift Console.  See console: public/components/_resource.scss
export const kialiBadge = kialiStyle({
  backgroundColor: PFColors.Badge,
  color: PFColors.White,
  borderRadius: '20px',
  flexShrink: 0,
  fontFamily: 'var(--pf-v5-global--FontFamily--text)',
  fontSize: 'var(--kiali-global--font-size)',
  lineHeight: '16px',
  marginRight: '4px',
  minWidth: '1.5em',
  padding: '1px 4px',
  textAlign: 'center',
  whiteSpace: 'nowrap'
});

export const kialiBadgeSmall = kialiStyle({
  backgroundColor: PFColors.Badge,
  color: PFColors.White,
  borderRadius: '20px',
  flexShrink: 0,
  fontFamily: 'var(--pf-v5-global--FontFamily--text)',
  fontSize: '12px',
  lineHeight: '13px',
  marginRight: '5px',
  minWidth: '1.3em',
  padding: '1px 3px',
  textAlign: 'center',
  whiteSpace: 'nowrap'
});

type PFBadgeProps = {
  badge: PFBadgeType;
  isRead?: boolean;
  keyValue?: string;
  position?: TooltipPosition; // default=auto
  size?: 'global' | 'sm';
  style?: CSSProperties;
  tooltip?: React.ReactNode;
};

export const PFBadge: React.FC<PFBadgeProps> = (props: PFBadgeProps) => {
  const key = props.keyValue || `pfbadge-${props.badge.badge}`;
  const ttKey = `tt-${key}`;
  const style = { ...props.badge.style, ...props.style };
  const tooltip = props.tooltip || props.badge.tt;
  const className = props.size === 'sm' ? kialiBadgeSmall : kialiBadge;

  const badge = (
    <Badge className={className} id={key} isRead={props.isRead || false} key={key} style={style}>
      {props.badge.badge}
    </Badge>
  );

  return !tooltip ? (
    badge
  ) : (
    <Tooltip content={<>{tooltip}</>} id={ttKey} key={ttKey} position={props.position || TooltipPosition.auto}>
      {badge}
    </Tooltip>
  );
};
