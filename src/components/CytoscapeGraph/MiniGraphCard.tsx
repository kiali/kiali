import * as React from 'react';
import { style } from 'typestyle';
import {
  Card,
  CardActions,
  CardBody,
  CardHead,
  CardHeader,
  Dropdown,
  DropdownItem,
  KebabToggle,
  Title
} from '@patternfly/react-core';
import history from '../../app/History';
import GraphDataSource from '../../services/GraphDataSource';
import { EdgeLabelMode, GraphType, NodeType } from '../../types/Graph';
import CytoscapeGraph from './CytoscapeGraph';
import { CytoscapeGraphSelectorBuilder } from './CytoscapeGraphSelector';
import { DagreGraph } from './graphs/DagreGraph';

const miniGraphContainerStyle = style({ height: '300px' });

type MiniGraphCardProps = {
  dataSource: GraphDataSource;
};

type MiniGraphCardState = {
  isKebabOpen: boolean;
};

export default class MiniGraphCard extends React.Component<MiniGraphCardProps, MiniGraphCardState> {
  constructor(props) {
    super(props);
    this.state = { isKebabOpen: false };
  }

  render() {
    const graphCardActions = [
      <DropdownItem key="viewGraph" onClick={this.onViewGraph}>
        Show full graph
      </DropdownItem>
    ];

    return (
      <Card style={{ height: '100%' }}>
        <CardHead>
          <CardActions>
            <Dropdown
              toggle={<KebabToggle onToggle={this.onGraphActionsToggle} />}
              dropdownItems={graphCardActions}
              isPlain
              isOpen={this.state.isKebabOpen}
              position={'right'}
            />
          </CardActions>
          <CardHeader>
            <Title style={{ float: 'left' }} headingLevel="h3" size="2xl">
              Graph Overview
            </Title>
          </CardHeader>
        </CardHead>
        <CardBody>
          <div style={{ height: '100%' }}>
            <CytoscapeGraph
              compressOnHide={true}
              containerClassName={miniGraphContainerStyle}
              graphData={{
                elements: this.props.dataSource.graphData,
                errorMessage: !!this.props.dataSource.errorMessage ? this.props.dataSource.errorMessage : undefined,
                isError: this.props.dataSource.isError,
                isLoading: this.props.dataSource.isLoading,
                fetchParams: this.props.dataSource.fetchParameters,
                timestamp: this.props.dataSource.graphTimestamp
              }}
              displayUnusedNodes={() => undefined}
              edgeLabelMode={EdgeLabelMode.NONE}
              isMTLSEnabled={false}
              isMiniGraph={true}
              layout={DagreGraph.getLayout()}
              refreshInterval={0}
              showCircuitBreakers={false}
              showMissingSidecars={true}
              showNodeLabels={true}
              showSecurity={false}
              showServiceNodes={true}
              showTrafficAnimation={false}
              showUnusedNodes={false}
              showVirtualServices={true}
            />
          </div>
        </CardBody>
      </Card>
    );
  }

  private onGraphActionsToggle = (isOpen: boolean) => {
    this.setState({
      isKebabOpen: isOpen
    });
  };

  private onViewGraph = () => {
    const namespace = this.props.dataSource.fetchParameters.namespaces[0].name;
    let cytoscapeGraph = new CytoscapeGraphSelectorBuilder().namespace(namespace);
    let graphType: GraphType = GraphType.APP;

    switch (this.props.dataSource.fetchParameters.node!.nodeType) {
      case NodeType.WORKLOAD:
        graphType = GraphType.WORKLOAD;
        cytoscapeGraph = cytoscapeGraph.workload(this.props.dataSource.fetchParameters.node!.workload);
        break;

      case NodeType.APP:
        cytoscapeGraph = cytoscapeGraph
          .app(this.props.dataSource.fetchParameters.node!.app)
          .nodeType(NodeType.APP)
          .isGroup(null);
        break;

      case NodeType.SERVICE:
        graphType = GraphType.SERVICE;
        cytoscapeGraph = cytoscapeGraph.service(this.props.dataSource.fetchParameters.node!.service);
        break;
    }

    const graphUrl = `/graph/namespaces?graphType=${graphType}&injectServiceNodes=true&namespaces=${namespace}&unusedNodes=true&focusSelector=${encodeURI(
      cytoscapeGraph.build()
    )}`;

    history.push(graphUrl);
  };
}
