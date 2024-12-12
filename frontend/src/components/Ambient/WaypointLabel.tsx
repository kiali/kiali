import * as React from 'react';
import { PFBadge, PFBadges } from '../Pf/PfBadges';
import { Tooltip, TooltipPosition } from '@patternfly/react-core';
import { KialiIcon } from '../../config/KialiIcon';
import { infoStyle } from '../../styles/IconStyle';
import { t } from 'i18next';

export const renderWaypointLabel = (bgsize?: string): React.ReactNode => {
  const badgeSize = bgsize === 'global' || bgsize === 'sm' ? bgsize : 'global';
  return [
    <>
      <div key="waypoint-workloads-title">
        <PFBadge badge={PFBadges.Waypoint} position={TooltipPosition.top} size={badgeSize} />
        {t('Waypoint proxy')}
        <Tooltip position={TooltipPosition.right} content={t('This workload is an Istio Ambient waypoint proxy')}>
          <KialiIcon.Info className={infoStyle} />
        </Tooltip>
      </div>
    </>
  ];
};

export const renderWaypointSimpleLabel = (bgsize?: string): React.ReactNode => {
  const badgeSize = bgsize === 'global' || bgsize === 'sm' ? bgsize : 'global';
  const tooltip = <div>{t('This workload is an Istio Ambient waypoint proxy')}</div>;

  return [
    <>
      <PFBadge
        badge={PFBadges.Waypoint}
        position={TooltipPosition.top}
        size={badgeSize}
        tooltip={tooltip}
        style={{ marginLeft: '5px' }}
      />
    </>
  ];
};
