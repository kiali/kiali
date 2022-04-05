import { Badge, Tooltip, TooltipPosition } from '@patternfly/react-core';
import React, { CSSProperties } from 'react';
import { style } from 'typestyle';
import { PFColors } from './PfColors';

export type PFBadgeType = {
  badge: string;
  tt?: React.ReactFragment;
};

// PF Badges used by Kiali, keep alphabetized
// avoid duplicate badge letters, especially if they may appear on the same page
export const PFBadges = Object.freeze({
  App: { badge: 'A', tt: 'Application' } as PFBadgeType,
  Adapter: { badge: 'A', tt: 'Adapter' } as PFBadgeType,
  AttributeManifest: { badge: 'AM', tt: 'Attribute Manifest' } as PFBadgeType,
  AuthorizationPolicy: { badge: 'AP', tt: 'Authorization Policy' } as PFBadgeType,
  Cluster: { badge: 'CL', tt: 'Cluster' } as PFBadgeType,
  ClusterRBACConfig: { badge: 'CRC', tt: 'Cluster RBAC Configuration' } as PFBadgeType,
  Container: { badge: 'C', tt: 'Container' } as PFBadgeType,
  DestinationRule: { badge: 'DR', tt: 'Destination Rule' } as PFBadgeType,
  EnvoyFilter: { badge: 'EF', tt: 'Envoy Filter' } as PFBadgeType,
  ExternalService: { badge: 'ES', tt: 'External Service' } as PFBadgeType,
  FederatedService: { badge: 'FS', tt: 'Federated Service' } as PFBadgeType,
  Gateway: { badge: 'G', tt: 'Gateway' } as PFBadgeType,
  Handler: { badge: 'H', tt: 'Handler' },
  Host: { badge: 'H', tt: 'Host' },
  Instance: { badge: 'I', tt: 'Instance' },
  MeshPolicy: { badge: 'MP', tt: 'Mesh Policy' } as PFBadgeType,
  Namespace: { badge: 'NS', tt: 'Namespace' } as PFBadgeType,
  Operation: { badge: 'O', tt: 'Operation' } as PFBadgeType,
  PeerAuthentication: { badge: 'PA', tt: 'Peer Authentication' } as PFBadgeType,
  Pod: { badge: 'P', tt: 'Pod' } as PFBadgeType,
  Policy: { badge: 'P', tt: 'Policy' } as PFBadgeType,
  RBACConfig: { badge: 'RC', tt: 'RBAC Configuration' } as PFBadgeType,
  RequestAuthentication: { badge: 'RA', tt: 'Request Authentication' } as PFBadgeType,
  Rule: { badge: 'R', tt: 'Rule' } as PFBadgeType,
  Service: { badge: 'S', tt: 'Service' } as PFBadgeType,
  ServiceEntry: { badge: 'SE', tt: 'Service Entry' } as PFBadgeType,
  ServiceRole: { badge: 'SR', tt: 'Service Role' } as PFBadgeType,
  ServiceRoleBinding: { badge: 'SRB', tt: 'Service Role Binding' } as PFBadgeType,
  Sidecar: { badge: 'SC', tt: 'Istio Sidecar Proxy' } as PFBadgeType,
  Template: { badge: 'T', tt: 'Template' } as PFBadgeType,
  Unknown: { badge: 'U', tt: 'Unknown' } as PFBadgeType,
  VirtualService: { badge: 'VS', tt: 'Virtual Service' } as PFBadgeType,
  Workload: { badge: 'W', tt: 'Workload' } as PFBadgeType,
  WorkloadEntry: { badge: 'WE', tt: 'Workload Entry' } as PFBadgeType,
  WorkloadGroup: { badge: 'WG', tt: 'Workload Group' } as PFBadgeType
});

export const kialiBadge = style({
  backgroundColor: PFColors.Badge,
  borderRadius: '30em',
  fontFamily: 'var(--pf-global--FontFamily--sans-serif)',
  marginRight: '10px'
});

type PFBadgeProps = {
  badge: PFBadgeType;
  className?: string; // default=kialiBadge
  id?: string;
  isRead?: boolean;
  key?: string;
  position?: TooltipPosition; // default=auto
  style?: CSSProperties;
};

export class PFBadge extends React.PureComponent<PFBadgeProps> {
  render() {
    const key = `pfbadge-${this.props.badge.badge}`;
    const badge = (
      <Badge
        className={this.props.className || kialiBadge}
        id={this.props.id || key}
        isRead={this.props.isRead || false}
        key={this.props.key || key}
        style={this.props.style}
      >
        {this.props.badge.badge}
      </Badge>
    );

    return !this.props.badge.tt ? (
      badge
    ) : (
      <Tooltip
        content={<>{this.props.badge.tt}</>}
        id={`tt-${this.props.id || key}`}
        key={`tt-${this.props.key || key}`}
        position={this.props.position || TooltipPosition.auto}
      >
        {badge}
      </Tooltip>
    );
  }
}

export const getPFBadge = (badge: string, tt?: React.ReactFragment): React.ReactFragment => {
  return <PFBadge badge={{ badge: badge, tt: tt }} />;
};
