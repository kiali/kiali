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
import { ReactComponent as PersesLogo } from '../../../assets/img/mesh/perses.svg';
import { ReactComponent as TempoLogo } from '../../../assets/img/mesh/tempo.svg';
import { ReactComponent as ZtunnelLogo } from '../../../assets/img/mesh/ztunnel-blue-on-transparent.svg';
import { store } from 'store/ConfigStore';
import { JAEGER, TEMPO } from 'types/Tracing';
import { GlobeRouteIcon, InfrastructureIcon, LayerGroupIcon } from '@patternfly/react-icons';

// This is the registered Node component override that utilizes our customized Node.tsx component.

type MeshNodeProps = {
  element: Node;
} & WithSelectionProps;

const renderIcon = (element: Node): React.ReactNode => {
  let Component:
    | React.FunctionComponent<React.SVGProps<SVGSVGElement>>
    | React.ComponentClass<React.ComponentProps<any>>
    | undefined;

  const data = element.getData() as MeshNodeData;
  const externalServices = store.getState().statusState.externalServices;
  let iconSizeMultiplier = 0.7;

  switch (data.infraType) {
    case MeshInfraType.DATAPLANE:
      Component = LayerGroupIcon;
      break;
    case MeshInfraType.GATEWAY:
      Component = GlobeRouteIcon;
      iconSizeMultiplier = 0.65;
      break;
    case MeshInfraType.GRAFANA:
      Component = GrafanaLogo;
      break;
    case MeshInfraType.ISTIOD:
      Component = IstioLogo;
      break;
    case MeshInfraType.KIALI:
      Component = KialiLogo;
      break;
    case MeshInfraType.METRIC_STORE:
      // TODO: don't assume Prometheus
      Component = PrometheusLogo;
      break;
    case MeshInfraType.PERSES:
      Component = PersesLogo;
      break;
    case MeshInfraType.TRACE_STORE:
      if (externalServices.find(service => service.name.toLowerCase() === TEMPO)) {
        Component = TempoLogo;
      } else if (externalServices.find(service => service.name.toLowerCase() === JAEGER)) {
        Component = JaegerLogo;
      }
      break;
    case MeshInfraType.WAYPOINT:
      Component = InfrastructureIcon;
      iconSizeMultiplier = 0.5;
      break;
    case MeshInfraType.ZTUNNEL:
      Component = ZtunnelLogo;
      iconSizeMultiplier = 1.05;
      break;
  }

  const { width, height } = element.getDimensions();
  const iconSize = Math.min(width, height) * iconSizeMultiplier;

  return Component ? (
    <g transform={`translate(${(width - iconSize) / 2}, ${(height - iconSize) / 2})`}>
      <Component width={iconSize} height={iconSize} />
    </g>
  ) : (
    <></>
  );
};

const nodeStyle = kialiStyle({
  $nest: {
    '.pf-topology__node__background': {
      strokeWidth: 3
    },
    '&.pf-m-hover': {
      cursor: 'pointer'
    },
    '&.pf-m-selected .pf-topology__node__background': {
      stroke: PFColors.Active,
      strokeWidth: 6
    }
  }
});

const labelNodeStyle = kialiStyle({
  $nest: {
    '& > text': {
      fontSize: '1.25rem'
    },
    '& .pf-topology__node__label__badge > text': {
      fontSize: '1rem'
    }
  }
});

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
        className={nodeStyle}
        labelClassName={labelNodeStyle}
        element={element}
        {...rest}
        {...passedData}
        attachments={hover || detailsLevel === ScaleDetailsLevel.high ? data.attachments : undefined}
        scaleLabel={hover && detailsLevel === ScaleDetailsLevel.high}
        scaleNode={hover && detailsLevel !== ScaleDetailsLevel.high}
        showLabel={hover || detailsLevel !== ScaleDetailsLevel.low}
      >
        {renderIcon(element)}
      </DefaultNode>
    </g>
  );
};

export const MeshNode = observer(MeshNodeComponent);
