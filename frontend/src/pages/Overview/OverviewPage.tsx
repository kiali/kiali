import * as React from 'react';
import { Grid, GridItem } from '@patternfly/react-core';
import { kialiStyle } from 'styles/StyleUtils';
import { serverConfig } from 'config/ServerConfig';
import { DefaultSecondaryMasthead } from 'components/DefaultSecondaryMasthead/DefaultSecondaryMasthead';
import { Refresh } from 'components/Refresh/Refresh';
import { useKialiDispatch } from 'hooks/redux';
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
  gap: '1rem'
});

export const OverviewPage: React.FC = () => {
  const dispatch = useKialiDispatch();

  React.useEffect(() => {
    setAIContext(dispatch, 'Overview page');
  }, [dispatch]);

  const durationLabel = serverConfig.healthConfig?.compute?.duration ?? '5m';

  return (
    <div className={overviewPageStyle}>
      <DefaultSecondaryMasthead
        hideNamespaceSelector={true}
        rightToolbar={<Refresh id="namespaces-list-refresh" disabled={false} manageURL={true} />}
        titleSuffix={t('Last {{duration}}', { duration: durationLabel })}
      />

      <Grid hasGutter>
        <GridItem span={7}>
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

        <GridItem span={5}>
          <DataPlaneStats />
        </GridItem>
      </Grid>

      {/* Bottom row - Applications and Workload insights */}
      <Grid hasGutter>
        <GridItem span={5}>
          <ApplicationStats />
        </GridItem>

        <GridItem span={7}>
          <ServiceInsights />
        </GridItem>
      </Grid>
    </div>
  );
};
