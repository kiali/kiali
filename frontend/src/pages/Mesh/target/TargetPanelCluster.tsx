import * as React from 'react';
import { Visualization } from '@patternfly/react-topology';
import { kialiStyle } from 'styles/StyleUtils';
import { PFColors } from 'components/Pf/PfColors';
import { PFBadge, PFBadges } from 'components/Pf/PfBadges';
import { getKialiTheme } from 'utils/ThemeUtils';
import { TargetPanelCommonProps, renderInfraSummary, targetPanelStyle } from './TargetPanelCommon';
import { kialiIconDark, kialiIconLight } from 'config';
import { BoxTarget, ClusterNodeData, KialiInstance, isExternal } from 'types/Mesh';
import { Theme } from 'types/Common';
import { KialiIcon } from 'config/KialiIcon';
import { Title, TitleSizes, Tooltip } from '@patternfly/react-core';
import { classes } from 'typestyle';
import { panelBodyStyle, panelHeadingStyle, panelStyle } from 'pages/Graph/SummaryPanelStyle';
import { UNKNOWN } from 'types/Graph';
import { useKialiTranslation } from 'utils/I18nUtils';

type TargetPanelClusterProps = TargetPanelCommonProps & {
  target: BoxTarget<ClusterNodeData>;
};

const kialiIconStyle = kialiStyle({
  width: '1rem',
  marginRight: '0.25rem'
});

export const TargetPanelCluster: React.FC<TargetPanelClusterProps> = (props: TargetPanelClusterProps) => {
  const { t } = useKialiTranslation();

  const renderKialiLinks = (kialiInstances: KialiInstance[]): React.ReactNode => {
    const kialiIcon = getKialiTheme() === Theme.DARK ? kialiIconDark : kialiIconLight;
    return kialiInstances?.map(instance => {
      if (instance.url.length !== 0) {
        return (
          <span>
            <img alt="Kiali Icon" src={kialiIcon} className={kialiIconStyle} />
            <a href={instance.url} target="_blank" rel="noopener noreferrer">
              {instance.namespace} {' / '} {instance.serviceName}
            </a>
            <br />
          </span>
        );
      } else {
        return (
          <span>
            <img alt="Kiali Icon" src={kialiIcon} className={kialiIconStyle} />
            {`${instance.namespace} / ${instance.serviceName}`}
            <br />
          </span>
        );
      }
    });
  };

  /*
  static readonly panelStyle = {
    backgroundColor: PFColors.BackgroundColor100,
    height: '100%',
    margin: 0,
    minWidth: targetPanelWidth,
    overflowY: 'auto' as 'auto',
    width: targetPanelWidth
  };
  */

  const clusterNode = props.target.elem;
  const controller = clusterNode.getController();
  const data = clusterNode.getData()!;
  const clusterData = data.infraData ?? {
    accessible: false,
    isKialiHome: false,
    name: data.infraName
  };
  const version = data.version;
  const notExternal = !isExternal(data.cluster);

  return (
    <div id="target-panel-cluster" className={classes(panelStyle, targetPanelStyle)}>
      <div id="target-panel-cluster-heading" className={panelHeadingStyle}>
        <Title headingLevel="h5" size={TitleSizes.lg}>
          {clusterData.isKialiHome && (
            <Tooltip content={t('Kiali home cluster')}>
              <span style={{ marginRight: '0.5rem' }}>
                <KialiIcon.Star />
              </span>
            </Tooltip>
          )}
          {notExternal && <PFBadge badge={PFBadges.Cluster} size="global" />}
          {clusterData.name}
        </Title>
      </div>
      {notExternal && (
        <div
          className={panelBodyStyle}
          style={{
            paddingBottom: '0.75rem',
            marginTop: '0.75rem',
            borderBottom: `1px solid ${PFColors.BorderColor100}`
          }}
        >
          {clusterData.accessible && renderKialiLinks(clusterData.kialiInstances)}
          {t('Version: {{version}}', { version: version || t(UNKNOWN) })}
          <br />
          {t('API Endpoint: {{apiEndpoint}}', { apiEndpoint: clusterData.apiEndpoint || t('n/a') })}
          <br />
          {t('Secret Name: {{secretName}}', { secretName: clusterData.secretName || t('n/a') })}
          <br />
        </div>
      )}
      {renderInfraSummary(controller as Visualization, clusterNode.getData()?.cluster)}
    </div>
  );
};
