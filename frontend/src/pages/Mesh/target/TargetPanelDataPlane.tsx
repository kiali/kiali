import * as React from 'react';
import { Node, NodeModel } from '@patternfly/react-topology';
import { TargetPanelCommonProps, targetPanelHR, targetPanelStyle } from './TargetPanelCommon';
import { classes } from 'typestyle';
import { MeshNodeData } from 'types/Mesh';
import { panelBodyStyle, panelHeadingStyle, panelStyle } from 'pages/Graph/SummaryPanelStyle';
import { PFBadge, PFBadges } from 'components/Pf/PfBadges';
import { kialiStyle } from 'styles/StyleUtils';
import { Title, TitleSizes } from '@patternfly/react-core';
import { ExpandableRowContent, Table, Tbody, Td, Th, Thead, Tr } from '@patternfly/react-table';
import { NamespaceInfo } from 'types/NamespaceInfo';
import { TargetPanelDataPlaneNamespace } from './TargetPanelDataPlaneNamespace';
import { serverConfig } from 'config';

type TargetPanelDataPlaneState = {
  expanded: string[];
  loading: boolean;
  node?: Node<NodeModel, any>;
};

const defaultState: TargetPanelDataPlaneState = {
  expanded: [],
  loading: false,
  node: undefined
};

const nodeStyle = kialiStyle({
  alignItems: 'center',
  display: 'flex'
});

export class TargetPanelDataPlane extends React.Component<TargetPanelCommonProps, TargetPanelDataPlaneState> {
  constructor(props: TargetPanelCommonProps) {
    super(props);

    const dataPlaneNode = this.props.target.elem as Node<NodeModel, any>;
    this.state = { ...defaultState, node: dataPlaneNode };
  }

  render(): React.ReactNode {
    if (!this.state.node) {
      return null;
    }

    const node = this.props.target.elem as Node<NodeModel, any>;
    const data = node.getData() as MeshNodeData;

    return (
      <div id="target-panel-data-plane" className={classes(panelStyle, targetPanelStyle)}>
        <div className={panelHeadingStyle}>{this.renderNodeHeader(data)}</div>
        <div className={panelBodyStyle}>
          <Table aria-label="dataplane-table" variant="compact">
            <Thead>
              <Tr>
                <Th />
                <Th>Namespace</Th>
              </Tr>
            </Thead>
            {(data.infraData as NamespaceInfo[])
              .filter(ns => ns.name !== serverConfig.istioNamespace)
              .sort((ns1, ns2) => (ns1.name < ns2.name ? -1 : 1))
              .map((ns, i) => {
                return (
                  <Tbody key={ns.name} isExpanded={this.isExpanded(ns)}>
                    <Tr>
                      <Td
                        expand={{
                          rowIndex: i,
                          isExpanded: this.isExpanded(ns),
                          onToggle: () => this.toggleExpanded(ns),
                          expandId: `ns-${ns.name}`
                        }}
                      />
                      <Td dataLabel="Namespace">{ns.name}</Td>
                    </Tr>
                    <Tr isExpanded={this.isExpanded(ns)}>
                      <Td dataLabel={`detail-${ns}`} noPadding={true} colSpan={2}>
                        <ExpandableRowContent>
                          <TargetPanelDataPlaneNamespace
                            duration={this.props.duration}
                            istioAPIEnabled={this.props.istioAPIEnabled}
                            isExpanded={this.isExpanded(ns)}
                            kiosk={this.props.kiosk}
                            refreshInterval={this.props.refreshInterval}
                            targetCluster={ns.cluster!}
                            targetNamespace={ns.name}
                            updateTime={this.props.updateTime}
                          />
                          {targetPanelHR}
                          <pre>
                            {JSON.stringify(
                              data.infraData.find(id => id.name === ns.name),
                              null,
                              2
                            )}
                          </pre>
                        </ExpandableRowContent>
                      </Td>
                    </Tr>
                  </Tbody>
                );
              })}
          </Table>
        </div>
      </div>
    );
  }

  private isExpanded = (ns: NamespaceInfo): boolean => {
    return this.state.expanded.includes(ns.name);
  };

  private toggleExpanded = (ns: NamespaceInfo): void => {
    const updatedExpanded = this.state.expanded.filter(n => ns.name !== n);
    if (updatedExpanded.length === this.state.expanded.length) {
      updatedExpanded.push(ns.name);
    }
    this.setState({ expanded: updatedExpanded });
  };

  private renderNodeHeader = (data: MeshNodeData): React.ReactNode => {
    return (
      <React.Fragment key={data.infraName}>
        <Title headingLevel="h5" size={TitleSizes.lg}>
          <span className={nodeStyle}>
            <PFBadge badge={PFBadges.Namespace} size="sm" />
            {data.infraName}
          </span>
        </Title>
        <span className={nodeStyle}>
          <PFBadge badge={PFBadges.Cluster} size="sm" />
          {data.cluster}
        </span>
      </React.Fragment>
    );
  };
}
