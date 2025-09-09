import React from 'react';
import { PFBadge, PFBadges } from 'components/Pf/PfBadges';

type NetworkTrafficBadgeProps = {
  namespace?: string;
};

export const NetworkTrafficBadge: React.FC<NetworkTrafficBadgeProps> = ({ namespace }) => (
  <div style={{ display: 'flex', alignItems: 'left', justifyContent: 'flex-start' }}>
    <PFBadge
      badge={PFBadges.NetworkTraffic}
      size="sm"
      style={{ borderRadius: '999px' }}
      tooltip={
        <div style={{ textAlign: 'left' }}>
          Network Traffic
          <br />
          Namespace: {namespace ?? 'unknown'}
        </div>
      }
    />
  </div>
);

export const YourComponent: React.FC = () => (
  <div>
    <NetworkTrafficBadge namespace="" />
  </div>
);
