import * as React from 'react';
import { connect } from 'react-redux';
import { kialiStyle } from 'styles/StyleUtils';
import { KialiIcon } from 'config/KialiIcon';
import { KialiAppState } from 'store/Store';
import { TourStop } from 'components/Tour/TourStop';
import { classes } from 'typestyle';
import { PFColors } from 'components/Pf/PfColors';
import {
  MeshInfraType,
  DataPlaneNodeData,
  NodeTarget,
  IstiodNodeData,
  BoxTarget,
  ClusterNodeData,
  NamespaceNodeData,
  MeshType
} from 'types/Mesh';
import { TargetPanelCommonProps, targetPanelStyle } from './TargetPanelCommon';
import { MeshTourStops } from '../MeshHelpTour';
import { BoxByType } from 'types/Graph';
import { TargetPanelCluster } from './TargetPanelCluster';
import { TargetPanelNamespace } from './TargetPanelNamespace';
import { TargetPanelNode } from './TargetPanelNode';
import { TargetPanelMesh } from './TargetPanelMesh';
import { meshWideMTLSStatusSelector, minTLSVersionSelector } from 'store/Selectors';
import { TargetPanelDataPlane } from './TargetPanelDataPlane';
import { TargetPanelControlPlane } from './TargetPanelControlPlane';
import { useKialiTranslation } from 'utils/I18nUtils';

type ReduxProps = {
  kiosk: string;
  meshStatus: string;
  minTLS: string;
};

type TargetPanelProps = ReduxProps &
  TargetPanelCommonProps & {
    isPageVisible: boolean;
  };

const mainStyle = kialiStyle({
  fontSize: 'var(--graph-side-panel--font-size)',
  padding: '0',
  position: 'relative',
  backgroundColor: PFColors.BackgroundColor100
});

const expandedStyle = kialiStyle({ height: '100%' });

const collapsedStyle = kialiStyle({
  $nest: {
    [`& > .${targetPanelStyle}`]: {
      display: 'none'
    }
  }
});

const toggleTargetPanelStyle = kialiStyle({
  border: `1px solid ${PFColors.BorderColor100}`,
  backgroundColor: PFColors.BackgroundColor100,
  borderRadius: '3px',
  bottom: 0,
  cursor: 'pointer',
  left: '-1.4rem',
  minWidth: '4.5rem',
  position: 'absolute',
  textAlign: 'center',
  transform: 'rotate(-90deg)',
  transformOrigin: 'left top 0'
});

export const TargetPanelComponent: React.FC<TargetPanelProps> = (props: TargetPanelProps) => {
  const [isCollapsed, setIsCollapsed] = React.useState<boolean>(false);

  const { t } = useKialiTranslation();
  const { target } = props;

  React.useEffect(() => setIsCollapsed(false), [target.elem]);

  const getTargetPanel = (): React.ReactNode => {
    switch (target.type) {
      case MeshType.Box: {
        const boxType: BoxByType = target.elem.getData()!.isBox!;

        switch (boxType) {
          case BoxByType.CLUSTER:
            return (
              <TargetPanelCluster
                duration={props.duration}
                istioAPIEnabled={props.istioAPIEnabled}
                kiosk={props.kiosk}
                refreshInterval={props.refreshInterval}
                // TODO: Can we further narrow down these targets with guards?
                target={target as BoxTarget<ClusterNodeData>}
                updateTime={props.updateTime}
              />
            );
          case BoxByType.NAMESPACE:
            return (
              <TargetPanelNamespace
                duration={props.duration}
                istioAPIEnabled={props.istioAPIEnabled}
                kiosk={props.kiosk}
                refreshInterval={props.refreshInterval}
                // TODO: Can we further narrow down these targets with guards?
                target={target as BoxTarget<NamespaceNodeData>}
                updateTime={props.updateTime}
              />
            );
          default:
            return <></>;
        }
      }
      case MeshType.Mesh:
        return (
          <TargetPanelMesh
            duration={props.duration}
            istioAPIEnabled={props.istioAPIEnabled}
            kiosk={props.kiosk}
            refreshInterval={props.refreshInterval}
            target={target}
            updateTime={props.updateTime}
          />
        );
      case MeshType.Node:
        switch (target.elem.getData()!.infraType) {
          case MeshInfraType.ISTIOD:
            return (
              <TargetPanelControlPlane
                duration={props.duration}
                istioAPIEnabled={props.istioAPIEnabled}
                kiosk={props.kiosk}
                meshStatus={props.meshStatus}
                minTLS={props.minTLS}
                refreshInterval={props.refreshInterval}
                // TODO: Can we further narrow down these targets with guards?
                target={target as NodeTarget<IstiodNodeData>}
                updateTime={props.updateTime}
              />
            );
          case MeshInfraType.DATAPLANE:
            return (
              <TargetPanelDataPlane
                duration={props.duration}
                istioAPIEnabled={props.istioAPIEnabled}
                kiosk={props.kiosk}
                refreshInterval={props.refreshInterval}
                // TODO: Can we further narrow down these targets with guards?
                target={target as NodeTarget<DataPlaneNodeData>}
                updateTime={props.updateTime}
              />
            );
          default:
            return (
              <TargetPanelNode
                duration={props.duration}
                istioAPIEnabled={props.istioAPIEnabled}
                kiosk={props.kiosk}
                refreshInterval={props.refreshInterval}
                target={target}
                updateTime={props.updateTime}
              />
            );
        }
      default:
        return <></>;
    }
  };

  const togglePanel = (): void => {
    setIsCollapsed(!isCollapsed);
  };

  if (!props.isPageVisible || !props.target.elem) {
    return null;
  }

  const mainTopStyle = isCollapsed ? collapsedStyle : expandedStyle;
  const tourStops = [MeshTourStops.TargetPanel, MeshTourStops.Mesh];

  return (
    <TourStop info={tourStops}>
      <div id="mesh-target-panel" className={mainStyle}>
        <div className={mainTopStyle}>
          <div className={classes(toggleTargetPanelStyle)} onClick={togglePanel}>
            {isCollapsed ? (
              <>
                <KialiIcon.AngleDoubleUp /> {t('Show')}
              </>
            ) : (
              <>
                <KialiIcon.AngleDoubleDown /> {t('Hide')}
              </>
            )}
          </div>

          {getTargetPanel()}
        </div>
      </div>
    </TourStop>
  );
};

const mapStateToProps = (state: KialiAppState): ReduxProps => ({
  kiosk: state.globalState.kiosk,
  meshStatus: meshWideMTLSStatusSelector(state),
  minTLS: minTLSVersionSelector(state)
});

export const TargetPanel = connect(mapStateToProps)(TargetPanelComponent);
