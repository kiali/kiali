import { Grid, GridItem } from '@patternfly/react-core';
import * as React from 'react';
import { style } from 'typestyle';
import { ChatSessionUsage } from './ChatSessionUsage';
import { AIStats } from './AIStats';

const aiDashboardPageStyle = style({
  display: 'flex',
  flexDirection: 'column',
  height: '100%'
});


export const AIDashboardPage: React.FC = () => {
  return (
    <div className={aiDashboardPageStyle}>
      <Grid hasGutter>
        <GridItem span={12}>
          <ChatSessionUsage />
        </GridItem>
        <GridItem span={12}>
          <AIStats />
        </GridItem>
      </Grid>
    </div>
  );
};