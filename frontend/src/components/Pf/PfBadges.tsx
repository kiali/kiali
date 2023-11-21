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
  App: { badge: 'A', tt: 'Application', style: { backgroundColor: PFColors.Green500 } } as PFBadgeType,
  Adapter: { badge: 'A', tt: 'Adapter' } as PFBadgeType,
  AttributeManifest: { badge: 'AM', tt: 'Attribute_Manifest' } as PFBadgeType,
  AuthorizationPolicy: { badge: 'AP', tt: 'Authorization_Policy' } as PFBadgeType,
  Cluster: { badge: 'C', tt: 'Cluster', style: { backgroundColor: PFColors.Blue300 } } as PFBadgeType,
  ClusterRBACConfig: { badge: 'CRC', tt: 'Cluster_RBAC_Configuration' } as PFBadgeType,
  Container: { badge: 'C', tt: 'Container', style: { backgroundColor: PFColors.Blue300 } } as PFBadgeType,
  DestinationRule: { badge: 'DR', tt: 'Destination_Rule' } as PFBadgeType,
  EnvoyFilter: { badge: 'EF', tt: 'Envoy_Filter' } as PFBadgeType,
  ExternalService: { badge: 'ES', tt: 'External_Service' } as PFBadgeType,
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
  Gateway: { badge: 'G', tt: 'Gateway' } as PFBadgeType,
  HTTPRoute: { badge: 'HTTP', tt: 'HTTPRoute' } as PFBadgeType,
  K8sGateway: { badge: 'G', tt: 'K8sGateway' } as PFBadgeType,
  K8sHTTPRoute: { badge: 'HTTP', tt: 'K8sHTTPRoute' } as PFBadgeType,
  Handler: { badge: 'H', tt: 'Handler' },
  Host: { badge: 'H', tt: 'Host' },
  Instance: { badge: 'I', tt: 'Instance' },
  MeshPolicy: { badge: 'MP', tt: 'Mesh_Policy' } as PFBadgeType,
  MirroredWorkload: {
    badge: 'MI',
    tt: 'Mirrored Workload',
    style: { backgroundColor: PFColors.Purple500 }
  } as PFBadgeType,
  Namespace: { badge: 'NS', tt: 'Namespace', style: { backgroundColor: PFColors.Green600 } } as PFBadgeType,
  Operation: { badge: 'O', tt: 'Operation' } as PFBadgeType,
  PeerAuthentication: { badge: 'PA', tt: 'Peer_Authentication' } as PFBadgeType,
  Pod: { badge: 'P', tt: 'Pod', style: { backgroundColor: PFColors.Cyan300 } } as PFBadgeType,
  Policy: { badge: 'P', tt: 'Policy' } as PFBadgeType,
  RBACConfig: { badge: 'RC', tt: 'RBAC_Configuration' } as PFBadgeType,
  RequestAuthentication: { badge: 'RA', tt: 'Request_Authentication' } as PFBadgeType,
  RequestRetry: {
    badge: 'RR',
    tt: 'Request_Retry',
    style: { backgroundColor: PFColors.Purple500 }
  } as PFBadgeType,
  RequestTimeout: {
    badge: 'RT',
    tt: 'Request_Timeout',
    style: { backgroundColor: PFColors.Purple500 }
  } as PFBadgeType,
  Rule: { badge: 'R', tt: 'Rule' } as PFBadgeType,
  Service: { badge: 'S', tt: 'Service', style: { backgroundColor: PFColors.LightGreen500 } } as PFBadgeType,
  ServiceEntry: { badge: 'SE', tt: 'Service Entry' } as PFBadgeType,
  ServiceRole: { badge: 'SR', tt: 'Service_Role' } as PFBadgeType,
  ServiceRoleBinding: { badge: 'SRB', tt: 'Service_Role_Binding' } as PFBadgeType,
  Sidecar: { badge: 'SC', tt: 'Istio_Sidecar_Proxy' } as PFBadgeType,
  WasmPlugin: { badge: 'WP', tt: 'Istio_Wasm_Plugin' } as PFBadgeType,
  Telemetry: { badge: 'TM', tt: 'Istio_Telemetry' } as PFBadgeType,
  Template: { badge: 'T', tt: 'Template' } as PFBadgeType,
  Unknown: { badge: 'U', tt: 'Unknown' } as PFBadgeType,
  VirtualService: { badge: 'VS', tt: 'Virtual Service' } as PFBadgeType,
  Waypoint: { badge: 'W', tt: 'Waypoint_proxy' } as PFBadgeType,
  Workload: { badge: 'W', tt: 'Workload', style: { backgroundColor: PFColors.Blue500 } } as PFBadgeType,
  WorkloadEntry: { badge: 'WE', tt: 'Workload_Entry' } as PFBadgeType,
  WorkloadGroup: { badge: 'WG', tt: 'Workload_Group' } as PFBadgeType
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
        {$t(this.props.badge.badge)}
      </Badge>
    );

    return !tooltip ? (
      badge
    ) : (
      <Tooltip
        content={<>{$t(tooltip as string)}</>}
        id={ttKey}
        key={ttKey}
        position={this.props.position || TooltipPosition.auto}
      >
        {badge}
      </Tooltip>
    );
  }
}
