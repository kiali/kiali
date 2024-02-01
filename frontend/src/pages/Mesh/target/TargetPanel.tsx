import * as React from 'react';
import { connect } from 'react-redux';
import { kialiStyle } from 'styles/StyleUtils';
import { KialiIcon } from 'config/KialiIcon';
import { KialiAppState } from 'store/Store';
import { TourStop } from 'components/Tour/TourStop';
import { FocusNode } from 'pages/GraphPF/GraphPF';
import { classes } from 'typestyle';
import { PFColors } from 'components/Pf/PfColors';
import { MeshInfraType, MeshTarget } from 'types/Mesh';
import { TargetPanelCommonProps, targetPanel } from './TargetPanelCommon';
import { MeshTourStops } from '../MeshHelpTour';
import { BoxByType } from 'types/Graph';
import { ElementModel, GraphElement } from '@patternfly/react-topology';
import { TargetPanelClusterBox } from './TargetPanelClusterBox';
import { TargetPanelNamespace } from './TargetPanelNamespace';
import { TargetPanelNode } from './TargetPanelNode';
import { TargetPanelMesh } from './TargetPanelMesh';
import { meshWideMTLSStatusSelector, minTLSVersionSelector } from 'store/Selectors';
import { NodeData } from '../MeshElems';

type TargetPanelState = {
  isVisible: boolean;
};

type ReduxProps = {
  meshStatus: string;
  minTLS: string;
};

type TargetPanelProps = ReduxProps &
  TargetPanelCommonProps & {
    isPageVisible: boolean;
    onFocus?: (focusNode: FocusNode) => void;
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
    ['& > .' + targetPanel]: {
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
  left: '-1.6em',
  minWidth: '5em',
  position: 'absolute',
  textAlign: 'center',
  transform: 'rotate(-90deg)',
  transformOrigin: 'left top 0'
});

class TargetPanelComponent extends React.Component<TargetPanelProps, TargetPanelState> {
  constructor(props: TargetPanelProps) {
    super(props);
    this.state = {
      isVisible: true
    };
  }

  componentDidUpdate(prevProps: Readonly<TargetPanelProps>): void {
    if (prevProps.target.elem !== this.props.target.elem) {
      this.setState({ isVisible: true });
    }
  }

  render() {
    if (!this.props.isPageVisible || !this.props.target.elem) {
      return null;
    }

    const mainTopStyle = this.state.isVisible ? expandedStyle : collapsedStyle;
    const target: MeshTarget = this.props.target;

    return (
      <TourStop info={MeshTourStops.TargetPanel}>
        <div id="mesh-target-panel" className={mainStyle}>
          <div className={mainTopStyle}>
            <div className={classes(toggleTargetPanelStyle)} onClick={this.togglePanel}>
              {this.state.isVisible ? (
                <>
                  <KialiIcon.AngleDoubleDown /> Hide
                </>
              ) : (
                <>
                  <KialiIcon.AngleDoubleUp /> Show
                </>
              )}
            </div>
            {this.getTargetPanel(target)}
          </div>
        </div>
      </TourStop>
    );
  }

  private getTargetPanel = (target: MeshTarget): React.ReactFragment => {
    const targetType = target.type as string;

    switch (targetType) {
      case 'box': {
        const elem = target.elem as GraphElement<ElementModel, any>;
        const data = elem.getData() as NodeData;
        const boxType: BoxByType = data.isBox as BoxByType;
        switch (boxType) {
          case 'cluster':
            return (
              <TargetPanelClusterBox
                istioAPIEnabled={this.props.istioAPIEnabled}
                kiosk={this.props.kiosk}
                refreshInterval={this.props.refreshInterval}
                target={target}
                updateTime={this.props.updateTime}
              />
            );
          case 'namespace':
            return (
              <TargetPanelNamespace
                istioAPIEnabled={this.props.istioAPIEnabled}
                kiosk={this.props.kiosk}
                meshStatus={this.props.meshStatus}
                minTLS={this.props.minTLS}
                refreshInterval={this.props.refreshInterval}
                target={target}
                updateTime={this.props.updateTime}
              />
            );
          default:
            return <></>;
        }
      }
      case 'mesh':
        return (
          <TargetPanelMesh
            istioAPIEnabled={this.props.istioAPIEnabled}
            kiosk={this.props.kiosk}
            refreshInterval={this.props.refreshInterval}
            target={target}
            updateTime={this.props.updateTime}
          />
        );
      case 'node':
        const elem = target.elem as GraphElement<ElementModel, any>;
        const data = elem.getData() as NodeData;
        if (data.infraType === MeshInfraType.NAMESPACE) {
          return (
            <TargetPanelNamespace
              istioAPIEnabled={this.props.istioAPIEnabled}
              kiosk={this.props.kiosk}
              meshStatus={this.props.meshStatus}
              minTLS={this.props.minTLS}
              refreshInterval={this.props.refreshInterval}
              target={target}
              updateTime={this.props.updateTime}
            />
          );
        }
        return (
          <TargetPanelNode
            istioAPIEnabled={this.props.istioAPIEnabled}
            kiosk={this.props.kiosk}
            refreshInterval={this.props.refreshInterval}
            target={target}
            updateTime={this.props.updateTime}
          />
        );
      default:
        return <></>;
    }
  };

  private togglePanel = () => {
    this.setState((state: TargetPanelState) => ({
      isVisible: !state.isVisible
    }));
  };
}

const mapStateToProps = (state: KialiAppState) => ({
  kiosk: state.globalState.kiosk,
  meshStatus: meshWideMTLSStatusSelector(state),
  minTLS: minTLSVersionSelector(state)
});

export const TargetPanel = connect(mapStateToProps)(TargetPanelComponent);
