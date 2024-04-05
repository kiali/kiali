import {
  DefaultNode,
  getShapeComponent,
  Node,
  observer,
  ScaleDetailsLevel,
  useHover,
  WithSelectionProps
} from '@patternfly/react-topology';
import { useDetailsLevel } from '@patternfly/react-topology';
import * as React from 'react';
import { PFColors } from 'components/Pf/PfColors';
import { kialiStyle } from 'styles/StyleUtils';
import { MeshInfraType, MeshNodeData } from 'types/Mesh';
import { ReactComponent as JaegerLogo } from '../../../assets/img/mesh/jaeger.svg';
import { ReactComponent as PrometheusLogo } from '../../../assets/img/mesh/prometheus.svg';
import { ReactComponent as GrafanaLogo } from '../../../assets/img/mesh/grafana.svg';
import { ReactComponent as IstioLogo } from '../../../assets/img/mesh/istio.svg';
import { ReactComponent as KialiLogo } from '../../../assets/img/mesh/kiali.svg';
import { ReactComponent as TempoLogo } from '../../../assets/img/mesh/tempo.svg';
import { store } from 'store/ConfigStore';
import { JAEGER, TEMPO } from 'types/Tracing';

// This is the registered Node component override that utilizes our customized Node.tsx component.

type MeshNodeProps = {
  element: Node;
} & WithSelectionProps;

const renderIcon = (element: Node): React.ReactNode => {
  let Component: React.FunctionComponent<React.SVGProps<SVGSVGElement>> | undefined;

  const data = element.getData() as MeshNodeData;
  const externalServices = store.getState().statusState.externalServices;

  if (data.infraType === MeshInfraType.GRAFANA) {
    Component = GrafanaLogo;
  } else if (data.infraType === MeshInfraType.ISTIOD) {
    Component = IstioLogo;
  } else if (data.infraType === MeshInfraType.TRACE_STORE) {
    if (externalServices.find(service => service.name.toLowerCase() === TEMPO)) {
      Component = TempoLogo;
    } else if (externalServices.find(service => service.name.toLowerCase() === JAEGER)) {
      Component = JaegerLogo;
    }
  } else if (data.infraType === MeshInfraType.KIALI) {
    Component = KialiLogo;
  } else if (data.infraType === MeshInfraType.METRIC_STORE) {
    // TODO: don't assume Prometheus
    Component = PrometheusLogo;
  }

  const { width, height } = element.getDimensions();
  const iconSize = Math.min(width, height) * 0.7;

  return Component ? (
    <g transform={`translate(${(width - iconSize) / 2}, ${(height - iconSize) / 2})`}>
      <Component width={iconSize} height={iconSize} />
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
