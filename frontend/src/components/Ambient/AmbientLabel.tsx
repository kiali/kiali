import * as React from 'react';
import { Label, Tooltip, TooltipPosition } from '@patternfly/react-core';
import { PFBadge, PFBadges } from '../Pf/PfBadges';

type AmbientLabelProps = {
  style?: React.CSSProperties;
  tooltip?: tooltipMsg;
  waypoint?: boolean;
};

const l4Message = (
  <>
    Workload is captured by <b>ztunnel</b> to provide a secure overlay layer with layer 4 capabilities
  </>
);
export const tooltipMsgType = {
  service: (
    <div>
      <div>Ambient Mesh</div>
      <div>All of this Service's Workloads are in the Ambient Mesh.</div>
      <div>For more details, see the Workloads detail</div>
    </div>
  ),
  app: (
    <div>
      <div>Ambient Mesh</div>
      <div>All of this App's Workloads are in the Ambient Mesh.</div>
      <div>For more details, see the Workloads detail</div>
    </div>
  ),
  workload: (
    <div>
      <div>Ambient Mesh</div>
      <ul>
        <li>
          <PFBadge key="ztunnel" badge={PFBadges.Ztunnel} size="sm" />
          {l4Message}
        </li>
      </ul>
    </div>
  ),
  workloadWaypoint: (
    <div>
      <div>Ambient Mesh</div>
      <ul>
        <li>
          <PFBadge key="ztunnel" badge={PFBadges.Ztunnel} size="sm" />
          {l4Message}
        </li>
        <li>
          <PFBadge key="waypoint" badge={PFBadges.Waypoint} size="sm" />
          Workload is captured by a <b>waypoint proxy</b> to provide layer 7 processing.
        </li>
      </ul>
    </div>
  ),
  mesh: 'Ambient Mesh',
  Default: 'Component is labeled as part of the Istio Ambient Mesh'
};

type tooltipMsg = typeof tooltipMsgType[keyof typeof tooltipMsgType];

const AmbientComponent = 'ambient';

export const AmbientLabel: React.FC<AmbientLabelProps> = (props: AmbientLabelProps) => {
  const msg = props.tooltip
    ? props.tooltip === tooltipMsgType.workload && props.waypoint
      ? tooltipMsgType.workloadWaypoint
      : props.tooltip
    : tooltipMsgType.Default;

  const tooltipContent = <div style={{ textAlign: 'left' }}>{msg}</div>;

  const iconComponent = (
    <span style={props.style}>
      <Label style={{ marginLeft: '0.5rem' }} color="blue" isCompact>
        {AmbientComponent}
      </Label>

      {!props.tooltip && (
        <span style={{ marginLeft: '1rem' }}>
          {msg}

          <Tooltip key="tooltip_ambient_label" position={TooltipPosition.top} content={tooltipContent}>
            <Label style={{ marginLeft: '0.5rem' }} color="blue" isCompact>
              {AmbientComponent}
            </Label>
          </Tooltip>
        </span>
      )}
    </span>
  );

  return props.tooltip ? (
    <Tooltip key="tooltip_ambient_label" position={TooltipPosition.right} content={tooltipContent}>
      {iconComponent}
    </Tooltip>
  ) : (
    iconComponent
  );
};
