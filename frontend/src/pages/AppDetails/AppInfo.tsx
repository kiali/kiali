import * as React from 'react';
import { Grid, GridItem, Stack, StackItem } from '@patternfly/react-core';
import { AppDescription } from './AppDescription';
import { App } from '../../types/App';
import { Spire } from '../../components/Spire/Spire';
import { flexFillStyle } from 'styles/FlexStyles';
import { DurationInSeconds } from 'types/Common';
import { GraphDataSource } from 'services/GraphDataSource';
import { AppHealth } from 'types/Health';
import { kialiStyle } from 'styles/StyleUtils';
import { MiniGraphCard } from 'pages/Graph/MiniGraphCard';

type AppInfoProps = {
  app?: App;
  duration: DurationInSeconds;
  health?: AppHealth;
  isSupported?: boolean;
};

const gridStyle = kialiStyle({
  alignItems: 'stretch',
  flex: 1,
  marginTop: '1rem',
  minHeight: 0
});

export class AppInfo extends React.Component<AppInfoProps> {
  private graphDataSource = new GraphDataSource();

  componentDidMount(): void {
    this.fetchBackend();
  }

  componentDidUpdate(prev: AppInfoProps): void {
    if (this.props.duration !== prev.duration || this.props.app !== prev.app) {
      this.fetchBackend();
    }
  }

  private fetchBackend = (): void => {
    if (!this.props.app) {
      return;
    }

    this.graphDataSource.fetchForVersionedApp(
      this.props.duration,
      this.props.app.namespace.name,
      this.props.app.name,
      this.props.app.cluster
    );
  };

  render(): React.ReactNode {
    const miniGraphSpan = 8;

    return (
      <div className={flexFillStyle}>
        <Grid hasGutter={true} className={gridStyle}>
          <GridItem span={4} style={{ overflowY: 'auto', paddingRight: '0.5rem' }}>
            <Stack hasGutter={true}>
              <StackItem>
                <AppDescription app={this.props.app} health={this.props.health} isSupported={this.props.isSupported} />
              </StackItem>

              {this.props.app &&
                this.props.app.workloads &&
                this.props.app.workloads.length > 0 &&
                this.props.app.workloads.some(w => w.spireInfo?.isSpireManaged) && (
                  <StackItem>
                    <Spire object={this.props.app} objectType="app" />
                  </StackItem>
                )}
            </Stack>
          </GridItem>

          <GridItem span={miniGraphSpan}>
            <MiniGraphCard dataSource={this.graphDataSource} />
          </GridItem>
        </Grid>
      </div>
    );
  }
}
