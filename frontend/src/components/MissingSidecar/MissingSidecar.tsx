import * as React from 'react';
import { Tooltip, TooltipPosition } from '@patternfly/react-core';
import { SVGIconProps } from '@patternfly/react-icons/dist/js/createIcon';
import { isIstioNamespace, serverConfig } from 'config/ServerConfig';
import { icons } from 'config';
import { KialiIcon } from '../../config/KialiIcon';
import { style } from 'typestyle';

type MissingSidecarProps = {
  'data-test'?: string;
  text: string;
  textmesh?: string;
  texttooltip: string;
  tooltip: boolean;
  meshtooltip: string;
  icon: React.ComponentClass<SVGIconProps>;
  color: string;
  namespace: string;
  style?: React.CSSProperties;
  isGateway?: boolean;
};

const infoStyle = style({
  margin: '0px 5px 2px 4px',
  verticalAlign: '-5px !important'
});

class MissingSidecar extends React.Component<MissingSidecarProps, {}> {
  static defaultProps = {
    textmesh: 'Out of mesh',
    text: 'Missing Sidecar',
    meshtooltip:
      'Out of mesh. Istio sidecar container or Ambient labels not found in Pod(s). Check if the istio-injection label/annotation is correctly set on the namespace/workload.',
    texttooltip:
      'Istio sidecar container not found in Pod(s). Check if the istio-injection label/annotation is correctly set on the namespace/workload.',
    tooltip: false,
    icon: icons.istio.missingSidecar.icon,
    color: icons.istio.missingSidecar.color
  };

  render() {
    const { text, texttooltip, icon, namespace, color, tooltip, style, ...otherProps } = this.props;
    const iconComponent = (
      <span style={style} {...otherProps} data-test={this.props['data-test']}>
        {React.createElement(icon, { style: { color: color, verticalAlign: '-2px' } })}
        {!tooltip && (
          <span style={{ marginLeft: '8px' }}>
            {serverConfig.ambientEnabled ? this.props.textmesh : this.props.text}
            <Tooltip
              key={`tooltip_missing_sidecar`}
              position={TooltipPosition.top}
              content={
                <div style={{ textAlign: 'left' }}>
                  {serverConfig.ambientEnabled ? this.props.meshtooltip : this.props.texttooltip}
                </div>
              }
            >
              <KialiIcon.Info className={infoStyle} />
            </Tooltip>
          </span>
        )}
      </span>
    );

    if (isIstioNamespace(namespace) || this.props.isGateway) {
      return <></>;
    }

    return tooltip ? (
      <Tooltip
        content={
          <div style={{ textAlign: 'left' }}>
            {serverConfig.ambientEnabled ? this.props.meshtooltip : this.props.texttooltip}
          </div>
        }
        position={TooltipPosition.right}
      >
        {iconComponent}
      </Tooltip>
    ) : (
      iconComponent
    );
  }
}

export default MissingSidecar;
