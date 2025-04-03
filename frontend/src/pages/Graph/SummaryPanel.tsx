import * as React from 'react';
import { connect } from 'react-redux';
import { kialiStyle } from 'styles/StyleUtils';
import { SummaryPanelEdge } from './SummaryPanelEdge';
import { SummaryPanelGraph } from './SummaryPanelGraph';
import { SummaryPanelAppBox } from './SummaryPanelAppBox';
import { SummaryPanelPropType, BoxByType, SummaryData, NodeAttr, FocusNode } from '../../types/Graph';
import { KialiIcon } from 'config/KialiIcon';
import { SummaryPanelNode } from './SummaryPanelNode';
import { TracingState } from 'reducers/TracingState';
import { SummaryPanelTraceDetails } from './SummaryPanelTraceDetails';
import { KialiAppState } from 'store/Store';
import { SummaryPanelClusterBox } from './SummaryPanelClusterBox';
import { SummaryPanelNamespaceBox } from './SummaryPanelNamespaceBox';
import { GraphTourStops } from 'pages/Graph/GraphHelpTour';
import { TourStop } from 'components/Tour/TourStop';
import { summaryPanelWidth } from './SummaryPanelCommon';
import { WizardAction, WizardMode } from 'components/IstioWizards/WizardActions';
import { ServiceDetailsInfo } from '../../types/ServiceInfo';
import { PeerAuthentication } from '../../types/IstioObjects';
import { classes } from 'typestyle';
import { panelBodyStyle, panelStyle } from './SummaryPanelStyle';
import { PFColors } from 'components/Pf/PfColors';

type SummaryPanelState = {
  isVisible: boolean;
};

type ReduxProps = {
  kiosk: string;
  tracingState: TracingState;
};

type MainSummaryPanelPropType = SummaryPanelPropType &
  ReduxProps & {
    isPageVisible: boolean;
    onDeleteTrafficRouting?: (key: string, serviceDetails: ServiceDetailsInfo) => void;
    onFocus?: (focusNode: FocusNode) => void;
    onLaunchWizard?: (
      key: WizardAction,
      mode: WizardMode,
      namespace: string,
      serviceDetails: ServiceDetailsInfo,
      gateways: string[],
      peerAuths: PeerAuthentication[]
    ) => void;
  };

const mainStyle = kialiStyle({
  fontSize: 'var(--graph-side-panel--font-size)',
  padding: '0',
  position: 'relative',
  backgroundColor: PFColors.BackgroundColor100
});

const expandedStyle = kialiStyle({ height: '100%' });

const expandedHalfStyle = kialiStyle({ height: '50%' });

const collapsedStyle = kialiStyle({
  $nest: {
    [`& > .${panelStyle}`]: {
      display: 'none'
    }
  }
});

const summaryPanelBottomSplit = kialiStyle({
  height: '50%',
  width: summaryPanelWidth,
  minWidth: summaryPanelWidth,
  overflowY: 'auto'
});

const toggleSidePanelStyle = kialiStyle({
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

class SummaryPanelComponent extends React.Component<MainSummaryPanelPropType, SummaryPanelState> {
  constructor(props: MainSummaryPanelPropType) {
    super(props);
    this.state = {
      isVisible: true
    };
  }

  componentDidUpdate(prevProps: Readonly<MainSummaryPanelPropType>): void {
    if (prevProps.data.summaryTarget !== this.props.data.summaryTarget) {
      this.setState({ isVisible: true });
    }
  }

  render(): React.ReactNode {
    if (!this.props.isPageVisible || !this.props.data.summaryTarget) {
      return null;
    }

    const mainTopStyle = this.state.isVisible
      ? this.props.tracingState.selectedTrace
        ? expandedHalfStyle
        : expandedStyle
      : collapsedStyle;

    let tourStops = [GraphTourStops.SidePanel];

    tourStops.unshift(GraphTourStops.Graph);
    tourStops.unshift(GraphTourStops.ContextualMenu);

    return (
      <TourStop info={tourStops}>
        <div id="graph-side-panel" className={mainStyle}>
          <div className={mainTopStyle}>
            <div className={classes(toggleSidePanelStyle)} onClick={this.togglePanel}>
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

            {this.getSummaryPanel(this.props.data)}
          </div>

          {this.props.tracingState.selectedTrace && this.state.isVisible && (
            <div className={classes(panelStyle, summaryPanelBottomSplit)}>
              <div className={panelBodyStyle}>
                <SummaryPanelTraceDetails
                  data={this.props.data}
                  graphType={this.props.graphType}
                  tracingURL={this.props.tracingState.info?.url}
                  onFocus={this.props.onFocus}
                  trace={this.props.tracingState.selectedTrace}
                />
              </div>
            </div>
          )}
        </div>
      </TourStop>
    );
  }

  private getSummaryPanel = (summary: SummaryData): React.ReactFragment => {
    const summaryType = summary.summaryType as string;

    switch (summaryType) {
      case 'box': {
        const boxType: BoxByType = summary.summaryTarget.getData()[NodeAttr.isBox];
        switch (boxType) {
          case 'app':
            return (
              <SummaryPanelAppBox
                data={summary}
                duration={this.props.duration}
                graphType={this.props.graphType}
                injectServiceNodes={this.props.injectServiceNodes}
                kiosk={this.props.kiosk}
                namespaces={this.props.data.summaryTarget.namespaces}
                queryTime={this.props.queryTime}
                rateInterval={this.props.rateInterval}
                step={this.props.step}
                trafficRates={this.props.trafficRates}
              />
            );
          case 'cluster':
            return (
              <SummaryPanelClusterBox
                data={summary}
                duration={this.props.duration}
                graphType={this.props.graphType}
                injectServiceNodes={this.props.injectServiceNodes}
                kiosk={this.props.kiosk}
                namespaces={this.props.data.summaryTarget.namespaces}
                queryTime={this.props.queryTime}
                rateInterval={this.props.rateInterval}
                step={this.props.step}
                trafficRates={this.props.trafficRates}
              />
            );
          case 'namespace':
            return (
              <SummaryPanelNamespaceBox
                data={summary}
                duration={this.props.duration}
                graphType={this.props.graphType}
                injectServiceNodes={this.props.injectServiceNodes}
                kiosk={this.props.kiosk}
                namespaces={this.props.data.summaryTarget.namespaces}
                queryTime={this.props.queryTime}
                rateInterval={this.props.rateInterval}
                step={this.props.step}
                trafficRates={this.props.trafficRates}
              />
            );
          default:
            return <></>;
        }
      }
      case 'edge':
        return <SummaryPanelEdge {...this.props} />;
      case 'graph':
        return (
          <SummaryPanelGraph
            data={summary}
            duration={this.props.duration}
            graphType={this.props.graphType}
            injectServiceNodes={this.props.injectServiceNodes}
            kiosk={this.props.kiosk}
            namespaces={this.props.namespaces}
            queryTime={this.props.queryTime}
            rateInterval={this.props.rateInterval}
            step={this.props.step}
            trafficRates={this.props.trafficRates}
          />
        );
      case 'node':
        return (
          <SummaryPanelNode
            data={this.props.data}
            duration={this.props.duration}
            graphType={this.props.graphType}
            injectServiceNodes={this.props.injectServiceNodes}
            namespaces={this.props.namespaces}
            rateInterval={this.props.rateInterval}
            onLaunchWizard={this.props.onLaunchWizard}
            onDeleteTrafficRouting={this.props.onDeleteTrafficRouting}
            queryTime={this.props.queryTime}
            step={this.props.step}
            trafficRates={this.props.trafficRates}
          />
        );
      default:
        return <></>;
    }
  };

  private togglePanel = (): void => {
    this.setState((state: SummaryPanelState) => ({
      isVisible: !state.isVisible
    }));
  };
}

const mapStateToProps = (state: KialiAppState): ReduxProps => ({
  kiosk: state.globalState.kiosk,
  tracingState: state.tracingState
});

export const SummaryPanel = connect(mapStateToProps)(SummaryPanelComponent);
