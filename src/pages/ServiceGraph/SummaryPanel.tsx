import * as React from 'react';
import SummaryPanelEdge from './SummaryPanelEdge';
import SummaryPanelGraph from './SummaryPanelGraph';
import SummaryPanelGroup from './SummaryPanelGroup';
import SummaryPanelNode from './SummaryPanelNode';

type SummaryPanelState = {
  // stateless
};

type SummaryPanelProps = {
  data: any;
};

export default class SummaryPanel extends React.Component<SummaryPanelProps, SummaryPanelState> {
  render() {
    return (
      <div>
        {this.props.data.summaryType === 'edge' ? <SummaryPanelEdge data={this.props.data} /> : null}
        {this.props.data.summaryType === 'graph' ? <SummaryPanelGraph data={this.props.data} /> : null}
        {this.props.data.summaryType === 'group' ? <SummaryPanelGroup data={this.props.data} /> : null}
        {this.props.data.summaryType === 'node' ? <SummaryPanelNode data={this.props.data} /> : null}
      </div>
    );
  }
}
