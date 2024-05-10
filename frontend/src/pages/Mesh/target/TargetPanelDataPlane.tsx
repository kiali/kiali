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
import { t } from 'utils/I18nUtils';
import { ControlPlaneVersionBadge } from 'pages/Overview/ControlPlaneVersionBadge';

const nodeStyle = kialiStyle({
  alignItems: 'center',
  display: 'flex'
});

export const TargetPanelDataPlane: React.FC<TargetPanelCommonProps> = (props: TargetPanelCommonProps) => {
  const [expanded, setExpanded] = React.useState<string[]>([]);

  const isExpanded = (ns: NamespaceInfo): boolean => {
    return expanded.includes(ns.name);
  };

  const toggleExpanded = (ns: NamespaceInfo): void => {
    const updatedExpanded = expanded.filter(n => ns.name !== n);
    if (updatedExpanded.length === expanded.length) {
      updatedExpanded.push(ns.name);
    }
    setExpanded(updatedExpanded);
  };

  const renderNodeHeader = (data: MeshNodeData): React.ReactNode => {
    return (
      <React.Fragment key={data.infraName}>
        <Title headingLevel="h5" size={TitleSizes.lg}>
          <span className={nodeStyle}>
            <PFBadge badge={PFBadges.DataPlane} size="sm" />
            {data.infraName}
            {data.version && (
              <ControlPlaneVersionBadge isCanary={data.isCanary!} version={data.version}></ControlPlaneVersionBadge>
            )}
          </span>
        </Title>
        <span className={nodeStyle}>
          <PFBadge badge={PFBadges.Cluster} size="sm" />
          {data.cluster}
        </span>
      </React.Fragment>
    );
  };

  const node = props.target?.elem as Node<NodeModel, any>;

  if (!node) {
    return null;
  }

  const data = node.getData() as MeshNodeData;

  return (
    <div id="target-panel-data-plane" className={classes(panelStyle, targetPanelStyle)}>
      <div className={panelHeadingStyle}>{renderNodeHeader(data)}</div>
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
                <Tbody key={ns.name} isExpanded={isExpanded(ns)}>
                  <Tr>
                    <Td
                      expand={{
                        rowIndex: i,
                        isExpanded: isExpanded(ns),
                        onToggle: () => toggleExpanded(ns),
                        expandId: `ns-${ns.name}`
                      }}
                    />
                    <Td dataLabel="Namespace">{ns.name}</Td>
                  </Tr>
                  <Tr isExpanded={isExpanded(ns)}>
                    <Td dataLabel={`detail-${ns}`} noPadding={true} colSpan={2}>
                      <ExpandableRowContent>
                        <TargetPanelDataPlaneNamespace
                          duration={props.duration}
                          istioAPIEnabled={props.istioAPIEnabled}
                          isExpanded={isExpanded(ns)}
                          kiosk={props.kiosk}
                          refreshInterval={props.refreshInterval}
                          targetCluster={ns.cluster!}
                          targetNamespace={ns.name}
                          updateTime={props.updateTime}
                        />
                        {targetPanelHR}
                        <span>{`${t('Configuration')}:`}</span>
                        <pre>
                          {JSON.stringify(
                            data.infraData.find((id: NamespaceInfo) => id.name === ns.name),
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
};
