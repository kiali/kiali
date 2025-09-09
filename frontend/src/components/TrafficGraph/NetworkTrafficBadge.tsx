import React from 'react';
import { PFBadge, PFBadges } from 'components/Pf/PfBadges';

export const NetworkTrafficBadge: React.FC = () => (
  <div style={{ display: 'flex', alignItems: 'left', justifyContent: 'flex-start' }}>
    <PFBadge badge={PFBadges.NetworkTraffic} size="sm" style={{ borderRadius: '999px' }} />
  </div>
);
export const YourComponent: React.FC = () => (
  <div>
    <NetworkTrafficBadge />
  </div>
);
