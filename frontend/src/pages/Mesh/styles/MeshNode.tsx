import {
  DefaultNode,
  getShapeComponent,
  Node,
  observer,
  ScaleDetailsLevel,
  useHover,
  WithSelectionProps
} from '@patternfly/react-topology';
import useDetailsLevel from '@patternfly/react-topology/dist/esm/hooks/useDetailsLevel';
import * as React from 'react';
import { PFColors } from 'components/Pf/PfColors';
import { kialiStyle } from 'styles/StyleUtils';
import { MeshInfraType, MeshNodeData } from 'types/Mesh';
import {
  GrafanaLogo,
  GrafanaLogoStyle,
  IstioLogo,
  IstioLogoStyle,
  JaegerLogo,
  JaegerLogoStyle,
  KialiLogo,
  KialiLogoStyle,
  PrometheusLogo,
  PrometheusLogoStyle
} from '../MeshLegendData';

// This is the registered Node component override that utilizes our customized Node.tsx component.

type MeshNodeProps = {
  element: Node;
} & WithSelectionProps;

const renderIcon = (element: Node): React.ReactNode => {
  let Component: React.ComponentClass<React.ComponentProps<any>> | undefined;
  let componentStyle: React.CSSProperties | undefined;
  const data = element.getData() as MeshNodeData;
  if (data.infraType === MeshInfraType.GRAFANA) {
    Component = GrafanaLogo;
    componentStyle = GrafanaLogoStyle;
  } else if (data.infraType === MeshInfraType.ISTIOD) {
    Component = IstioLogo;
    componentStyle = IstioLogoStyle;
  } else if (data.infraType === MeshInfraType.TRACE_STORE) {
    // TODO: don't assume Jaeger
    Component = JaegerLogo;
    componentStyle = JaegerLogoStyle;
  } else if (data.infraType === MeshInfraType.KIALI) {
    Component = KialiLogo;
    componentStyle = KialiLogoStyle;
  } else if (data.infraType === MeshInfraType.METRIC_STORE) {
    // TODO: don't assume Prom
    Component = PrometheusLogo;
    componentStyle = PrometheusLogoStyle;
  }

  const { width, height } = element.getDimensions();
  const iconSize = Math.min(width, height) * 0.7;

  return Component ? (
    <g transform={`translate(${(width - iconSize) / 2}, ${(height - iconSize) / 2})`}>
      <Component style={componentStyle} width={iconSize} height={iconSize} />
    </g>
  ) : (
    <></>
  );
};

const MeshNodeComponent: React.FC<MeshNodeProps> = ({ element, ...rest }) => {
  const data = element.getData();
  const detailsLevel = useDetailsLevel();
  const [hover, hoverRef] = useHover();
  const ShapeComponent = getShapeComponent(element);

  const ColorFind = PFColors.Gold400;
  const OverlayOpacity = 0.3;
  const OverlayWidth = 40;

  const findOverlayStyle = kialiStyle({
    strokeWidth: OverlayWidth,
    stroke: ColorFind,
    strokeOpacity: OverlayOpacity
  });

  // Set the path style when unhighlighted (opacity)
  let opacity = 1;
  if (data.isUnhighlighted) {
    opacity = 0.1;
  }

  const onMouseEnter = (): void => {
    data.onHover(element, true);
  };

  const onMouseLeave = (): void => {
    data.onHover(element, false);
  };

  const passedData = React.useMemo(() => {
    const newData = { ...data };
    if (detailsLevel !== ScaleDetailsLevel.high) {
      newData.tag = undefined;
    }
    Object.keys(newData).forEach(key => {
      if (newData[key] === undefined) {
        delete newData[key];
      }
    });
    return newData;
  }, [data, detailsLevel]);

  const { width, height } = element.getDimensions();

  return (
    <g style={{ opacity: opacity }} onMouseEnter={onMouseEnter} onMouseLeave={onMouseLeave} ref={hoverRef as any}>
      {data.isFind && <ShapeComponent className={findOverlayStyle} width={width} height={height} element={element} />}
      <DefaultNode
        element={element}
        {...rest}
        {...passedData}
        attachments={hover || detailsLevel === ScaleDetailsLevel.high ? data.attachments : undefined}
        scaleLabel={hover && detailsLevel !== ScaleDetailsLevel.high}
        // scaleNode={hover && detailsLevel === ScaleDetailsLevel.low}
        showLabel={hover || detailsLevel === ScaleDetailsLevel.high}
        showStatusBackground={detailsLevel === ScaleDetailsLevel.low}
      >
        {(hover || detailsLevel !== ScaleDetailsLevel.low) && renderIcon(element)}
      </DefaultNode>
    </g>
  );
};

export const MeshNode = observer(MeshNodeComponent);
