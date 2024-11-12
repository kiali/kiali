import * as React from 'react';
import { Tooltip, TooltipPosition } from '@patternfly/react-core';
import { icons, serverConfig } from '../../config';
import { KialiIcon } from '../../config/KialiIcon';
import { PFBadge } from '../Pf/PfBadges';
import { infoStyle } from 'styles/InfoStyle';

type MissingLabelProps = {
  className?: string;
  missingApp: boolean;
  missingVersion: boolean;
  tooltip: boolean;
};

export const MissingLabel: React.FC<MissingLabelProps> = (props: MissingLabelProps) => {
  const appLabel = serverConfig.istioLabels.appLabelName;
  const versionLabel = serverConfig.istioLabels.versionLabelName;
  const icon = icons.istio.missingLabel.icon;
  const color = icons.istio.missingLabel.color;

  const tooltipContent = (
    <div style={{ textAlign: 'left' }}>
      {props.missingApp && (
        <>
          <div>
            <PFBadge badge={{ badge: appLabel }} isRead={true} style={{ marginRight: 0 }} /> label is missing. <br />
          </div>
          <div>This workload won't be linked with an application.</div>
        </>
      )}

      {props.missingVersion && (
        <>
          <div>
            <PFBadge badge={{ badge: versionLabel }} isRead={true} style={{ marginRight: 0 }} /> label is missing.{' '}
            <br />
          </div>
          <div>The label is recommended as it affects telemetry.</div>
        </>
      )}

      <div>Missing labels may impact telemetry reported by the Istio proxy.</div>
    </div>
  );

  const iconComponent = (
    <span className={props.className}>
      {React.createElement(icon, { style: { color: color } })}

      {!props.tooltip && (
        <span style={{ marginLeft: '0.5rem' }}>
          Missing {props.missingApp ? 'App' : props.missingVersion ? 'Version' : 'Label'}
          <Tooltip key="tooltip_missing_label" position={TooltipPosition.top} content={tooltipContent}>
            <KialiIcon.Info className={infoStyle} />
          </Tooltip>
        </span>
      )}
    </span>
  );

  return props.tooltip ? (
    <Tooltip key="tooltip_missing_label" position={TooltipPosition.right} content={tooltipContent}>
      {iconComponent}
    </Tooltip>
  ) : (
    iconComponent
  );
};
