import * as React from 'react';
import { style } from 'typestyle';
import { SummaryPanelPropType } from '../../types/Graph';
import SummaryPanelEdge from './SummaryPanelEdge';
import SummaryPanelGraph from './SummaryPanelGraph';
import SummaryPanelGroup from './SummaryPanelGroup';
import { KialiIcon } from 'config/KialiIcon';
import SummaryPanelNodeContainer from './SummaryPanelNode';

type SummaryPanelState = {
  isVisible: boolean;
};

type MainSummaryPanelPropType = SummaryPanelPropType & {
  isPageVisible: boolean;
};

const expandedStyle = style({
  fontSize: 'var(--graph-side-panel--font-size)',
  padding: '0',
  position: 'relative'
});

const collapsedStyle = style({
  fontSize: 'var(--graph-side-panel--font-size)',
  padding: '0',
  position: 'relative',
  $nest: {
    '& > .panel': {
      display: 'none'
    }
  }
});

const toggleSidePanelStyle = style({
  backgroundColor: 'white',
  border: '1px #ddd solid',
  borderRadius: '3px',
  cursor: 'pointer',
  left: '-1.6em',
  minWidth: '5em',
  position: 'absolute',
  textAlign: 'center',
  top: '6.5em',
  transform: 'rotate(-90deg)',
  transformOrigin: 'left top 0'
});

export default class SummaryPanel extends React.Component<MainSummaryPanelPropType, SummaryPanelState> {
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
    return (
      <div id="graph-side-panel" className={this.state.isVisible ? expandedStyle : collapsedStyle}>
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
        {this.props.data.summaryType === 'edge' ? <SummaryPanelEdge {...this.props} /> : null}
        {this.props.data.summaryType === 'graph' ? (
          <SummaryPanelGraph
            data={this.props.data}
            namespaces={this.props.namespaces}
            graphType={this.props.graphType}
            injectServiceNodes={this.props.injectServiceNodes}
            queryTime={this.props.queryTime}
            duration={this.props.duration}
            step={this.props.step}
            rateInterval={this.props.rateInterval}
          />
        ) : null}
        {this.props.data.summaryType === 'group' ? (
          <SummaryPanelGroup
            data={this.props.data}
            namespaces={this.props.data.summaryTarget.namespaces}
            graphType={this.props.graphType}
            injectServiceNodes={this.props.injectServiceNodes}
            queryTime={this.props.queryTime}
            duration={this.props.duration}
            step={this.props.step}
            rateInterval={this.props.rateInterval}
          />
        ) : null}
        {this.props.data.summaryType === 'node' ? (
          <SummaryPanelNodeContainer
            data={this.props.data}
            queryTime={this.props.queryTime}
            namespaces={this.props.namespaces}
            graphType={this.props.graphType}
            injectServiceNodes={this.props.injectServiceNodes}
            duration={this.props.duration}
            step={this.props.step}
            rateInterval={this.props.rateInterval}
          />
        ) : null}
      </div>
    );
  }

  private togglePanel = () => {
    this.setState((state: SummaryPanelState) => ({
      isVisible: !state.isVisible
    }));
  };
}
