import * as React from 'react';
import { Tooltip, TooltipPosition } from '@patternfly/react-core';
import { icons, serverConfig } from '../../config';
import { KialiIcon } from '../../config/KialiIcon';
import { style } from 'typestyle';
import { PFBadge } from '../Pf/PfBadges';

type MissingLabelProps = {
  missingApp: boolean;
  missingVersion: boolean;
  tooltip: boolean;
  style?: React.CSSProperties;
};

const infoStyle = style({
  margin: '0px 5px 2px 4px',
  verticalAlign: '-5px !important'
});

class MissingLabel extends React.Component<MissingLabelProps, {}> {
  render() {
    const appLabel = serverConfig.istioLabels.appLabelName;
    const versionLabel = serverConfig.istioLabels.versionLabelName;
    const icon = icons.istio.missingLabel.icon;
    const color = icons.istio.missingLabel.color;
    const tooltipContent = (
      <div style={{ textAlign: 'left' }}>
        {this.props.missingApp && (
          <>
            <div>
              <PFBadge badge={{ badge: appLabel }} isRead={true} style={{ marginRight: '0px' }} /> label is missing.{' '}
              <br />
            </div>
            <div>This workload won't be linked with an application.</div>
          </>
        )}
        {this.props.missingVersion && (
          <>
            <div>
              <PFBadge badge={{ badge: versionLabel }} isRead={true} style={{ marginRight: '0px' }} /> label is missing.{' '}
              <br />
            </div>
            <div>This workload won't have Istio routing capabilities.</div>
          </>
        )}
        <div>Missing labels will impact in the telemetry collected by the Istio proxy.</div>
      </div>
    );
    const iconComponent = (
      <span style={this.props.style}>
        {React.createElement(icon, { style: { color: color, verticalAlign: '-2px' } })}
        {!this.props.tooltip && (
          <span style={{ marginLeft: '8px' }}>
            Missing {this.props.missingApp ? 'App' : this.props.missingVersion ? 'Version' : 'Label'}
            <Tooltip key={`tooltip_missing_label`} position={TooltipPosition.top} content={tooltipContent}>
              <KialiIcon.Info className={infoStyle} />
            </Tooltip>
          </span>
        )}
      </span>
    );
    return this.props.tooltip ? (
      <Tooltip key={`tooltip_missing_label`} position={TooltipPosition.right} content={tooltipContent}>
        {iconComponent}
      </Tooltip>
    ) : (
      iconComponent
    );
  }
}

export default MissingLabel;
