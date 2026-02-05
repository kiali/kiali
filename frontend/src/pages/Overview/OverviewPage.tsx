import * as React from 'react';
import { Grid, GridItem } from '@patternfly/react-core';
import { kialiStyle } from 'styles/StyleUtils';
import { ClusterStats } from './ClusterStats';
import { IstioConfigStats } from './IstioConfigStats';
import { ControlPlaneStats } from './ControlPlaneStats';
import { DataPlaneStats } from './DataPlaneStats';
import { ApplicationStats } from './ApplicationStats';
import { WorkloadInsights } from './WorkloadInsights';
import { useKialiDispatch } from 'hooks/redux';
import { setAIContext } from 'helpers/ChatAI';
import { DefaultSecondaryMasthead } from 'components/DefaultSecondaryMasthead/DefaultSecondaryMasthead';
import { Refresh } from 'components/Refresh/Refresh';

const overviewPageStyle = kialiStyle({
  display: 'flex',
  flexDirection: 'column',
  gap: '1rem'
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

  React.useEffect(() => {
    setAIContext(dispatch, 'Overview page');
  }, [dispatch]);

  return (
    <div className={overviewPageStyle}>
      <DefaultSecondaryMasthead
        hideNamespaceSelector={true}
        rightToolbar={<Refresh id="namespaces-list-refresh" disabled={false} manageURL={true} />}
      />

      <Grid hasGutter>
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
        {/* Bottom row - Applications and Workload insights */}
        <GridItem span={4} className={secondRowItemStyle}>
          <ApplicationStats />
        </GridItem>

        <GridItem span={8} className={secondRowItemStyle}>
          <WorkloadInsights />
        </GridItem>
      </Grid>
    </div>
  );
};
