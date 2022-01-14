import * as React from 'react';
import { connect } from 'react-redux';
import { style } from 'typestyle';
import { SummaryPanelPropType, BoxByType, SummaryData } from '../../types/Graph';
import SummaryPanelEdge from './SummaryPanelEdge';
import SummaryPanelGraph from './SummaryPanelGraph';
import SummaryPanelAppBox from './SummaryPanelAppBox';
import { KialiIcon } from 'config/KialiIcon';
import SummaryPanelNodeContainer from './SummaryPanelNode';
import { JaegerState } from 'reducers/JaegerState';
import SummaryPanelTraceDetailsContainer from './SummaryPanelTraceDetails';
import { KialiAppState } from 'store/Store';
import SummaryPanelClusterBox from './SummaryPanelClusterBox';
import SummaryPanelNamespaceBox from './SummaryPanelNamespaceBox';
import { CyNode } from 'components/CytoscapeGraph/CytoscapeGraphUtils';
import { GraphTourStops } from 'pages/Graph/GraphHelpTour';
import TourStopContainer from 'components/Tour/TourStop';
import { summaryPanelWidth } from './SummaryPanelCommon';

type SummaryPanelState = {
  isVisible: boolean;
};

type MainSummaryPanelPropType = SummaryPanelPropType & {
  isPageVisible: boolean;
  jaegerState: JaegerState;
};

const mainStyle = style({
  fontSize: 'var(--graph-side-panel--font-size)',
  padding: '0',
  position: 'relative'
});

const expandedStyle = style({ height: '100%' });

const expandedHalfStyle = style({ height: '50%' });

const collapsedStyle = style({
  $nest: {
    '& > .panel': {
      display: 'none'
    }
  }
});

const summaryPanelBottomSplit = style({
  height: '50%',
  width: summaryPanelWidth,
  minWidth: summaryPanelWidth,
  overflowY: 'auto'
});

const toggleSidePanelStyle = style({
  backgroundColor: 'white',
  border: '1px #ddd solid',
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

class SummaryPanel extends React.Component<MainSummaryPanelPropType, SummaryPanelState> {
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

  render() {
    if (!this.props.isPageVisible || !this.props.data.summaryTarget) {
      return null;
    }

    const mainTopStyle = this.state.isVisible
      ? this.props.jaegerState.selectedTrace
        ? expandedHalfStyle
        : expandedStyle
      : collapsedStyle;

    return (
      <TourStopContainer info={[GraphTourStops.Graph, GraphTourStops.ContextualMenu, GraphTourStops.SidePanel]}>
        <div id="graph-side-panel" className={mainStyle}>
          <div className={mainTopStyle}>
            <div className={toggleSidePanelStyle} onClick={this.togglePanel}>
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
          {this.props.jaegerState.selectedTrace && this.state.isVisible && (
            <div className={`panel panel-default ${summaryPanelBottomSplit}`}>
              <div className="panel-body">
                <SummaryPanelTraceDetailsContainer
                  trace={this.props.jaegerState.selectedTrace}
                  node={this.props.data.summaryTarget}
                  graphType={this.props.graphType}
                  jaegerURL={this.props.jaegerState.info?.url}
                />
              </div>
            </div>
          )}
        </div>
      </TourStopContainer>
    );
  }

  private getSummaryPanel = (summary: SummaryData): React.ReactFragment => {
    const summaryType = summary.summaryType as string;

    switch (summaryType) {
      case 'box': {
        const boxType: BoxByType | undefined =
          summaryType === 'box' ? this.props.data.summaryTarget.data(CyNode.isBox) : undefined;
        switch (boxType) {
          case 'app':
            return (
              <SummaryPanelAppBox
                data={this.props.data}
                duration={this.props.duration}
                graphType={this.props.graphType}
                injectServiceNodes={this.props.injectServiceNodes}
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
                data={this.props.data}
                duration={this.props.duration}
                graphType={this.props.graphType}
                injectServiceNodes={this.props.injectServiceNodes}
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
                data={this.props.data}
                duration={this.props.duration}
                graphType={this.props.graphType}
                injectServiceNodes={this.props.injectServiceNodes}
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
            namespaces={this.props.namespaces}
            queryTime={this.props.queryTime}
            rateInterval={this.props.rateInterval}
            step={this.props.step}
            trafficRates={this.props.trafficRates}
          />
        );
      case 'node':
        return (
          <SummaryPanelNodeContainer
            data={this.props.data}
            duration={this.props.duration}
            graphType={this.props.graphType}
            injectServiceNodes={this.props.injectServiceNodes}
            namespaces={this.props.namespaces}
            rateInterval={this.props.rateInterval}
            queryTime={this.props.queryTime}
            step={this.props.step}
            trafficRates={this.props.trafficRates}
          />
        );
      default:
        return <></>;
    }
  };

  private togglePanel = () => {
    this.setState((state: SummaryPanelState) => ({
      isVisible: !state.isVisible
    }));
  };
}

const mapStateToProps = (state: KialiAppState) => ({
  jaegerState: state.jaegerState
});

const SummaryPanelContainer = connect(mapStateToProps)(SummaryPanel);
export default SummaryPanelContainer;
