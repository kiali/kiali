import * as React from 'react';
import { Tooltip, TooltipPosition } from '@patternfly/react-core';
import { SVGIconProps } from '@patternfly/react-icons/dist/js/createIcon';
import { isIstioNamespace } from 'config/ServerConfig';
import { icons } from 'config';
import { KialiIcon } from '../../config/KialiIcon';
import { style } from 'typestyle';

type MissingAuthPolicyProps = {
  text: string;
  textTooltip: string;
  tooltip: boolean;
  icon: React.ComponentClass<SVGIconProps>;
  color: string;
  namespace: string;
  style?: React.CSSProperties;
};

const infoStyle = style({
  margin: '0px 5px 2px 4px',
  verticalAlign: '-5px !important'
});

class MissingAuthPolicy extends React.Component<MissingAuthPolicyProps, {}> {
  static defaultProps = {
    text: 'Missing Authorization Policy',
    textTooltip: 'This workload is not covered by any authorization policy.',
    tooltip: false,
    icon: icons.istio.missingAuthPolicy.icon,
    color: icons.istio.missingAuthPolicy.color
  };

  render() {
    const { text, textTooltip, icon, namespace, color, tooltip, style, ...otherProps } = this.props;

    const iconComponent = (
      <span style={style} {...otherProps}>
        {React.createElement(icon, { style: { color: color, verticalAlign: '-2px' } })}
        {!tooltip && (
          <span style={{ marginLeft: '8px' }}>
            {text}
            <Tooltip
              key={`tooltip_missing_auth_policy`}
              position={TooltipPosition.top}
              content={<div style={{ textAlign: 'left' }}>{textTooltip}</div>}
            >
              <KialiIcon.Info className={infoStyle} />
            </Tooltip>
          </span>
        )}
      </span>
    );

    if (isIstioNamespace(namespace)) {
      return <></>;
    }

    return tooltip ? (
      <Tooltip content={<div style={{ textAlign: 'left' }}>{textTooltip}</div>} position={TooltipPosition.right}>
        {iconComponent}
      </Tooltip>
    ) : (
      iconComponent
    );
  }
}

export default MissingAuthPolicy;
