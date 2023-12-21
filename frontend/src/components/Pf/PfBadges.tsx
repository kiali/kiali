import { Badge, Tooltip, TooltipPosition } from '@patternfly/react-core';
import React, { CSSProperties } from 'react';
import { kialiStyle } from 'styles/StyleUtils';
import { PFColors } from './PfColors';

export type PFBadgeType = {
  badge: string;
  tt?: React.ReactFragment;
  style?: React.CSSProperties;
};

// PF Badges used by Kiali, keep alphabetized
// avoid duplicate badge letters, especially if they may appear on the same page
export const PFBadges: { [key: string]: PFBadgeType } = Object.freeze({
  App: { badge: 'A', tt: $t('Application'), style: { backgroundColor: PFColors.Green500 } } as PFBadgeType,
  Adapter: { badge: 'A', tt: $t('Adapter') } as PFBadgeType,
  AttributeManifest: { badge: 'AM', tt: $t('AttributeManifest', 'Attribute Manifest') } as PFBadgeType,
  AuthorizationPolicy: { badge: 'AP', tt: $t('AuthorizationPolicy', 'Authorization Policy') } as PFBadgeType,
  Cluster: { badge: 'C', tt: $t('Cluster'), style: { backgroundColor: PFColors.Blue300 } } as PFBadgeType,
  ClusterRBACConfig: {
    badge: 'CRC',
    tt: $t('ClusterRBACConfiguration', 'Cluster RBAC Configuration')
  } as PFBadgeType,
  Container: { badge: 'C', tt: $t('Container'), style: { backgroundColor: PFColors.Blue300 } } as PFBadgeType,
  DestinationRule: { badge: 'DR', tt: $t('Destination Rule', 'Destination Rule') } as PFBadgeType,
  EnvoyFilter: { badge: 'EF', tt: $t('Envoy Filter', 'Envoy Filter') } as PFBadgeType,
  ExternalService: { badge: 'ES', tt: $t('ExternalService', 'External Service') } as PFBadgeType,
  FaultInjectionAbort: {
    badge: 'FI',
    tt: $t('FaultInjectionAbort', 'Fault Injection: Abort'),
    style: { backgroundColor: PFColors.Purple500 }
  } as PFBadgeType,
  FaultInjectionDelay: {
    badge: 'FI',
    tt: $t('FaultInjectionDelay', 'Fault Injection: Delay'),
    style: { backgroundColor: PFColors.Purple500 }
  } as PFBadgeType,
  FederatedService: { badge: 'FS', tt: $t('FederatedService', 'Federated Service') } as PFBadgeType,
  Gateway: { badge: 'G', tt: $t('Gateway') } as PFBadgeType,
  HTTPRoute: { badge: 'HTTP', tt: $t('HTTPRoute') } as PFBadgeType,
  K8sGateway: { badge: 'G', tt: $t('K8sGateway', 'Gateway (K8s)') } as PFBadgeType,
  K8sHTTPRoute: { badge: 'HTTP', tt: $t('K8sHTTPRoute', 'HTTPRoute (K8s)') } as PFBadgeType,
  Handler: { badge: 'H', tt: $t('Handler') },
  Host: { badge: 'H', tt: $t('Host') },
  Instance: { badge: 'I', tt: $t('Instance') },
  MeshPolicy: { badge: 'MP', tt: $t('MeshPolicy', 'Mesh Policy') } as PFBadgeType,
  MirroredWorkload: {
    badge: 'MI',
    tt: $t('MirroredWorkload', 'Mirrored Workload'),
    style: { backgroundColor: PFColors.Purple500 }
  } as PFBadgeType,
  Namespace: { badge: 'NS', tt: $t('Namespace'), style: { backgroundColor: PFColors.Green600 } } as PFBadgeType,
  Operation: { badge: 'O', tt: $t('Operation') } as PFBadgeType,
  PeerAuthentication: { badge: 'PA', tt: $t('Peer Authentication', 'Peer Authentication') } as PFBadgeType,
  Pod: {
    badge: 'P',
    tt: $t('WorkloadTypeLabel.Pod', 'Pod'),
    style: { backgroundColor: PFColors.Cyan300 }
  } as PFBadgeType,
  Policy: { badge: 'P', tt: $t('AuthorizationPolicyForm.Policy', 'Policy') } as PFBadgeType,
  RBACConfig: { badge: 'RC', tt: $t('RBACConfiguration', 'RBAC Configuration') } as PFBadgeType,
  RequestAuthentication: {
    badge: 'RA',
    tt: $t('Request Authentication', 'Request Authentication')
  } as PFBadgeType,
  RequestRetry: {
    badge: 'RR',
    tt: $t('RequestRetry', 'Request Retry'),
    style: { backgroundColor: PFColors.Purple500 }
  } as PFBadgeType,
  RequestTimeout: {
    badge: 'RT',
    tt: $t('RequestTimeout', 'Request Timeout'),
    style: { backgroundColor: PFColors.Purple500 }
  } as PFBadgeType,
  Rule: { badge: 'R', tt: $t('Rule') } as PFBadgeType,
  Service: { badge: 'S', tt: $t('Service'), style: { backgroundColor: PFColors.LightGreen500 } } as PFBadgeType,
  ServiceEntry: { badge: 'SE', tt: $t('Service Entry', 'Service Entry') } as PFBadgeType,
  ServiceRole: { badge: 'SR', tt: $t('ServiceRole', 'Service Role') } as PFBadgeType,
  ServiceRoleBinding: { badge: 'SRB', tt: $t('ServiceRoleBinding', 'Service Role Binding') } as PFBadgeType,
  Sidecar: { badge: 'SC', tt: $t('Istio.IstioSidecarProxy', 'Istio Sidecar Proxy') } as PFBadgeType,
  WasmPlugin: { badge: 'WP', tt: $t('Istio.IstioWasmPlugin', 'Istio Wasm Plugin') } as PFBadgeType,
  Telemetry: { badge: 'TM', tt: $t('Istio.IstioTelemetry', 'Istio Telemetry') } as PFBadgeType,
  Template: { badge: 'T', tt: $t('Template') } as PFBadgeType,
  Unknown: { badge: 'U', tt: $t('Unknown') } as PFBadgeType,
  VirtualService: { badge: 'VS', tt: $t('Virtual Service') } as PFBadgeType,
  Waypoint: { badge: 'W', tt: $t('WaypointProxy', 'Waypoint proxy') } as PFBadgeType,
  Workload: { badge: 'W', tt: 'Workload', style: { backgroundColor: PFColors.Blue500 } } as PFBadgeType,
  WorkloadEntry: { badge: 'WE', tt: $t('workloadEntries', 'Workload Entry') } as PFBadgeType,
  WorkloadGroup: { badge: 'WG', tt: $t('Workload Group', 'Workload Group') } as PFBadgeType
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
  tooltip?: React.ReactFragment;
};

export class PFBadge extends React.PureComponent<PFBadgeProps> {
  render() {
    const key = this.props.keyValue || `pfbadge-${this.props.badge.badge}`;
    const ttKey = `tt-${key}`;
    const style = { ...this.props.badge.style, ...this.props.style };
    const tooltip = this.props.tooltip || this.props.badge.tt;
    const className = this.props.size === 'sm' ? kialiBadgeSmall : kialiBadge;

    const badge = (
      <Badge className={className} id={key} isRead={this.props.isRead || false} key={key} style={style}>
        {this.props.badge.badge}
      </Badge>
    );

    return !tooltip ? (
      badge
    ) : (
      <Tooltip content={<>{tooltip}</>} id={ttKey} key={ttKey} position={this.props.position || TooltipPosition.auto}>
        {badge}
      </Tooltip>
    );
  }
}
