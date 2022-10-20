import * as React from 'react';
import { Tooltip, TooltipPosition } from '@patternfly/react-core';
import { PFBadge } from '../Pf/PfBadges';

type AmbientLabelProps = {
  tooltip: boolean;
  style?: React.CSSProperties;
};

class AmbientLabel extends React.Component<AmbientLabelProps, {}> {

  render() {

    const msg = "Component is labeled as part of the Istio Ambient Mesh";

    const tooltipContent = (
      <div style={{ textAlign: 'left' }}>
          <>
            <div>
              <PFBadge badge={{ badge: "IstioAmbient" }} isRead={true} style={{ marginRight: '0px'}} /> { msg }
              <br />
            </div>
          </>
      </div>
    );
    const iconComponent = (
      <span style={this.props.style}>
        <PFBadge badge={{ badge: "ztunnel" }} isRead={true} style={{ marginRight: '0px', marginLeft: '5px' }} />
        {!this.props.tooltip && (
          <span style={{ marginLeft: '8px' }}>
            { msg }
            <Tooltip key={`tooltip_ambient_label`} position={TooltipPosition.top} content={tooltipContent}>
              <PFBadge badge={{ badge: "ztunnel" }} isRead={true} style={{ marginRight: '0px' }} />
            </Tooltip>
          </span>
        )}
      </span>
    );
    return this.props.tooltip ? (
      <Tooltip key={`tooltip_ambient_label`} position={TooltipPosition.right} content={tooltipContent}>
        {iconComponent}
      </Tooltip>
    ) : (
      iconComponent
    );
  }
}

export default AmbientLabel;
