import * as React from 'react';
import { SummaryPanelPropType } from '../../types/Graph';
import SummaryPanelEdge from './SummaryPanelEdge';
import SummaryPanelGraph from './SummaryPanelGraph';
import SummaryPanelGroup from './SummaryPanelGroup';
import SummaryPanelNode from './SummaryPanelNode';

type SummaryPanelState = {
  // stateless
};

type MainSummaryPanelPropType = SummaryPanelPropType & {
  isPageVisible: boolean;
};

export default class SummaryPanel extends React.Component<MainSummaryPanelPropType, SummaryPanelState> {
  render() {
    if (!this.props.isPageVisible) {
      return null;
    }
    return (
      <>
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
          <SummaryPanelNode
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
      </>
    );
  }
}
