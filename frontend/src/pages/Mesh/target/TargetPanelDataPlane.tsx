import * as React from 'react';
import { TargetPanelCommonProps, nodeStyle, targetPanelStyle } from './TargetPanelCommon';
import { classes } from 'typestyle';
import { DataPlaneNodeData, MeshNodeData, NodeTarget } from 'types/Mesh';
import { panelBodyStyle, panelHeadingStyle, panelStyle } from 'pages/Graph/SummaryPanelStyle';
import { PFBadge, PFBadges } from 'components/Pf/PfBadges';
import { Title, TitleSizes } from '@patternfly/react-core';
import { ExpandableRowContent, Table, Tbody, Td, Th, Thead, Tr } from '@patternfly/react-table';
import { NamespaceInfo } from 'types/NamespaceInfo';
import { TargetPanelDataPlaneNamespace } from './TargetPanelDataPlaneNamespace';
import { serverConfig } from 'config';
import { useKialiTranslation } from 'utils/I18nUtils';
import { ControlPlaneVersionBadge } from 'pages/Overview/ControlPlaneVersionBadge';

interface TargetPanelDataPlaneProps extends TargetPanelCommonProps {
  target: NodeTarget<DataPlaneNodeData>;
}

export const TargetPanelDataPlane: React.FC<TargetPanelDataPlaneProps> = props => {
  const [expanded, setExpanded] = React.useState<string[]>([]);

  const { t } = useKialiTranslation();

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

  const renderDataPlaneHeader = (data: MeshNodeData): React.ReactNode => {
    return (
      <React.Fragment key={data.infraName}>
        <Title headingLevel="h5" size={TitleSizes.lg}>
          <span className={nodeStyle}>
            <PFBadge badge={PFBadges.DataPlane} size="global" />
            {data.infraName}
            {data.version && <ControlPlaneVersionBadge version={data.version}></ControlPlaneVersionBadge>}
          </span>
        </Title>
        <span className={nodeStyle}>
          <PFBadge badge={PFBadges.Cluster} size="sm" />
          {data.cluster}
        </span>
      </React.Fragment>
    );
  };

  const node = props.target;

  if (!node) {
    return null;
  }

  const data = node.elem.getData()!;

  return (
    <div id="target-panel-data-plane" className={classes(panelStyle, targetPanelStyle)}>
      <div className={panelHeadingStyle}>{renderDataPlaneHeader(data)}</div>
      <div className={panelBodyStyle}>
        <Table aria-label={t('Dataplane table')} variant="compact">
          <Thead>
            <Tr>
              <Th />
              <Th>{t('Namespace')}</Th>
            </Tr>
          </Thead>

          {data.infraData
            .filter(ns => ns.name !== serverConfig.istioNamespace)
            .sort((ns1, ns2) => (ns1.name < ns2.name ? -1 : 1))
            .map((ns, i) => {
              const namespaceData = data.infraData.find((id: NamespaceInfo) => id.name === ns.name);

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

                    <Td dataLabel={t('Namespace')}>{ns.name}</Td>
                  </Tr>

                  <Tr isExpanded={isExpanded(ns)}>
                    <Td dataLabel={`detail-${ns}`} noPadding={true} colSpan={2}>
                      <ExpandableRowContent>
                        <TargetPanelDataPlaneNamespace
                          duration={props.duration}
                          namespaceData={namespaceData!}
                          istioAPIEnabled={props.istioAPIEnabled}
                          isExpanded={isExpanded(ns)}
                          kiosk={props.kiosk}
                          refreshInterval={props.refreshInterval}
                          targetCluster={ns.cluster!}
                          targetNamespace={ns.name}
                          updateTime={props.updateTime}
                        />
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
