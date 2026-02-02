import * as React from 'react';
import { Grid, GridItem, Title, TitleSizes } from '@patternfly/react-core';
import { kialiStyle } from 'styles/StyleUtils';
import { PFColors } from 'components/Pf/PfColors';
import { t } from 'utils/I18nUtils';
import { ClusterStats } from './ClusterStats';
import { IstioConfigStats } from './IstioConfigStats';
import { ControlPlaneStats } from './ControlPlaneStats';
import { NamespaceStats } from './NamespaceStats';
import { ApplicationStats } from './ApplicationStats';
import { WorkloadInsights } from './WorkloadInsights';
import { useKialiDispatch } from 'hooks/redux';
import { setAIContext } from 'helpers/ChatAI';

const titleContainerStyle = kialiStyle({
  borderBottom: `1px solid ${PFColors.BorderColor100}`,
  marginBottom: '0.25rem'
});

const titleStyle = kialiStyle({
  marginBottom: '1rem'
});

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

  return (
    <div className={overviewPageStyle}>
      <div className={titleContainerStyle}>
        <Title headingLevel="h1" size={TitleSizes['2xl']} className={titleStyle}>
          {t('Overview')}
        </Title>
      </div>

      {/* Top row - Summary cards */}
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
          <NamespaceStats />
        </GridItem>
      </Grid>

      {/* Bottom row - Applications and Workload insights */}
      <Grid hasGutter>
        <GridItem span={5}>
          <ApplicationStats />
        </GridItem>

        <GridItem span={7}>
          <WorkloadInsights />
        </GridItem>
      </Grid>
    </div>
  );
};
