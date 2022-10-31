import * as React from 'react';
import { Tooltip, TooltipPosition } from '@patternfly/react-core';
import { PFBadge } from '../Pf/PfBadges';

type AmbientLabelProps = {
  tooltip: boolean;
  style?: React.CSSProperties;
};

class AmbientBadge extends React.Component<AmbientLabelProps, {}> {

  render() {

    const msg = "Istio Ambient is detected. This is a experimental Istio branch and Kiali can have unexpected behavior";

    const tooltipContent = (
      <div style={{ textAlign: 'left' }}>
        <>
          <div>
            { msg }
            <br />
          </div>
        </>
      </div>
    );
    const iconComponent = (
      <span style={this.props.style}>
        <PFBadge badge={{ badge: "Ambient" }} isRead={true} style={{ marginRight: '0px', marginLeft: '5px' }} />
        {!this.props.tooltip && (
          <span style={{ marginLeft: '8px' }}>
            { msg }
            <Tooltip key={`tooltip_ambient_label`} position={TooltipPosition.top} content={tooltipContent}>
              <PFBadge badge={{ badge: "Ambient" }} isRead={true} style={{ marginRight: '0px' }} />
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

export default AmbientBadge;
