import * as React from 'react';
import { Node, NodeModel } from '@patternfly/react-topology';
import { TargetPanelCommonProps, targetPanel, targetPanelBody, targetPanelHeading } from './TargetPanelCommon';
import { classes } from 'typestyle';
import { MeshNodeData } from 'types/Mesh';
import { panelStyle } from 'pages/Graph/SummaryPanelStyle';
import { PFBadge, PFBadges } from 'components/Pf/PfBadges';
import { kialiStyle } from 'styles/StyleUtils';
import { Title, TitleSizes } from '@patternfly/react-core';
import { ExpandableRowContent, Table, Tbody, Td, Th, Thead, Tr } from '@patternfly/react-table';
import { NamespaceInfo } from 'types/NamespaceInfo';

type TargetPanelDataplanesState = {
  expanded: string[];
  node?: Node<NodeModel, any>;
  loading: boolean;
};

const defaultState: TargetPanelDataplanesState = {
  expanded: [],
  node: undefined,
  loading: false
};

const nodeStyle = kialiStyle({
  alignItems: 'center',
  display: 'flex'
});

export class TargetPanelDataplanes extends React.Component<TargetPanelCommonProps, TargetPanelDataplanesState> {
  constructor(props: TargetPanelCommonProps) {
    super(props);

    const dataplanesNode = this.props.target.elem as Node<NodeModel, any>;
    this.state = { ...defaultState, node: dataplanesNode };
  }

  render() {
    if (!this.state.node) {
      return null;
    }

    const node = this.props.target.elem as Node<NodeModel, any>;
    const data = node.getData() as MeshNodeData;

    return (
      <div className={classes(panelStyle, targetPanel)}>
        <div className={targetPanelHeading}>{this.renderNodeHeader(data)}</div>
        <div className={targetPanelBody}>
          <Table aria-label="dataplanes-table" variant="compact">
            <Thead>
              <Tr>
                <Th />
                <Th>Namespace</Th>
              </Tr>
            </Thead>
            {(data.infraData as NamespaceInfo[]).map((ns, i) => {
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
                    <Td dataLabel="detail">
                      <ExpandableRowContent>{JSON.stringify(ns)}</ExpandableRowContent>
                    </Td>
                  </Tr>
                </Tbody>
              );
            })}
          </Table>
          <pre>{JSON.stringify(data.infraData, null, 2)}</pre>
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
