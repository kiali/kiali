import * as React from 'react';
import { Grid, GridItem } from '@patternfly/react-core';
import { kialiStyle } from 'styles/StyleUtils';
import { DefaultSecondaryMasthead } from 'components/DefaultSecondaryMasthead/DefaultSecondaryMasthead';
import { Refresh } from 'components/Refresh/Refresh';
import { HealthComputeDurationMastheadToolbar } from 'components/Time/HealthComputeDurationMastheadToolbar';
import { useManualRefreshState } from 'hooks/refresh';
import { ManualRefreshEmptyState } from 'components/Refresh/ManualRefreshEmptyState';
import { ClusterStats } from './ClusterStats';
import { IstioConfigStats } from './IstioConfigStats';
import { ControlPlaneStats } from './ControlPlaneStats';
import { DataPlaneStats } from './DataPlaneStats';
import { ApplicationStats } from './ApplicationStats';
import { ServiceInsights } from './ServiceInsights';

const overviewPageStyle = kialiStyle({
  display: 'flex',
  flexDirection: 'column',
  height: '100%'
});

const gridStyle = kialiStyle({
  flex: 1,
  overflow: 'auto'
});

const secondRowItemStyle = kialiStyle({
  display: 'flex',
  minHeight: '50vh'
});

export const OverviewPage: React.FC = () => {
  const loaded = useManualRefreshState();

  return (
    <div className={overviewPageStyle}>
      <DefaultSecondaryMasthead
        hideNamespaceSelector={true}
        rightToolbar={
          <HealthComputeDurationMastheadToolbar>
            <Refresh id="namespaces-list-refresh" disabled={false} manageURL={true} />
          </HealthComputeDurationMastheadToolbar>
        }
      />

      <div className={gridStyle}>
        {!loaded ? (
          <ManualRefreshEmptyState />
        ) : (
          <Grid hasGutter>
            <GridItem span={2}>
              <ClusterStats />
            </GridItem>

            <GridItem span={2}>
              <ControlPlaneStats />
            </GridItem>

            <GridItem span={5}>
              <DataPlaneStats />
            </GridItem>

            <GridItem span={3}>
              <IstioConfigStats />
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
    </div>
  );
};
