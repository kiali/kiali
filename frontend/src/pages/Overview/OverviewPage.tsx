import * as React from 'react';
import { Grid, GridItem } from '@patternfly/react-core';
import { kialiStyle } from 'styles/StyleUtils';
import { serverConfig } from 'config/ServerConfig';
import { DefaultSecondaryMasthead } from 'components/DefaultSecondaryMasthead/DefaultSecondaryMasthead';
import { Refresh } from 'components/Refresh/Refresh';
import { useKialiDispatch } from 'hooks/redux';
import { useManualRefreshState } from 'hooks/refresh';
import { ManualRefreshEmptyState } from 'components/Refresh/ManualRefreshEmptyState';
import { setAIContext } from 'helpers/ChatAI';
import { t } from 'utils/I18nUtils';
import { ClusterStats } from './ClusterStats';
import { IstioConfigStats } from './IstioConfigStats';
import { ControlPlaneStats } from './ControlPlaneStats';
import { DataPlaneStats } from './DataPlaneStats';
import { ApplicationStats } from './ApplicationStats';
import { ServiceInsights } from './ServiceInsights';

const overviewPageStyle = kialiStyle({
  display: 'flex',
  flexDirection: 'column',
  height: 'calc(100vh - 136px)'
});

const gridStyle = kialiStyle({
  flex: 1,
  gridTemplateRows: 'auto 1fr'
});

const durationLabelStyle = kialiStyle({
  fontSize: '0.875rem',
  fontWeight: 400,
  color: 'var(--pf-global--Color--200)',
  whiteSpace: 'nowrap'
});

const secondRowItemStyle = kialiStyle({
  display: 'flex',
  minHeight: '40vh',
  $nest: {
    '& > *': {
      flex: 1
    }
  }
});

export const OverviewPage: React.FC = () => {
  const dispatch = useKialiDispatch();
  const loaded = useManualRefreshState();

  React.useEffect(() => {
    setAIContext(dispatch, 'Overview page');
  }, [dispatch]);

  const durationLabel = serverConfig.healthConfig?.compute?.duration ?? '5m';

  return (
    <div className={overviewPageStyle}>
      <DefaultSecondaryMasthead
        hideNamespaceSelector={true}
        rightToolbar={
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
            <span className={durationLabelStyle}>{t('Last {{duration}}', { duration: durationLabel })}</span>
            <Refresh id="namespaces-list-refresh" disabled={false} manageURL={true} />
          </div>
        }
      />

      {!loaded ? (
        <ManualRefreshEmptyState />
      ) : (
        <Grid hasGutter className={gridStyle}>
          <GridItem span={6}>
            <Grid hasGutter>
              <GridItem span={4}>
                <ClusterStats />
              </GridItem>

              <GridItem span={4}>
                <IstioConfigStats />
              </GridItem>

              <GridItem span={4}>
                <ControlPlaneStats />
              </GridItem>
            </Grid>
          </GridItem>

          <GridItem span={6}>
            <DataPlaneStats />
          </GridItem>

          <GridItem span={4} className={secondRowItemStyle}>
            <ApplicationStats />
          </GridItem>

          <GridItem span={8}>
            <ServiceInsights />
          </GridItem>
        </Grid>
      )}
    </div>
  );
};
