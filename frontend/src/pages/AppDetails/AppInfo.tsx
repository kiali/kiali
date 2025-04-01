import * as React from 'react';
import { Grid, GridItem } from '@patternfly/react-core';
import { AppDescription } from './AppDescription';
import { App } from '../../types/App';
import { RenderComponentScroll } from '../../components/Nav/Page';
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

type AppInfoState = {
  tabHeight?: number;
};

const fullHeightStyle = kialiStyle({
  height: '100%'
});

export class AppInfo extends React.Component<AppInfoProps, AppInfoState> {
  private graphDataSource = new GraphDataSource();

  constructor(props: AppInfoProps) {
    super(props);
    this.state = {};
  }

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
    // RenderComponentScroll handles height to provide an inner scroll combined with tabs
    // This height needs to be propagated to minigraph to proper resize in height
    // Graph resizes correctly on width
    const miniGraphSpan = 8;
    return (
      <RenderComponentScroll onResize={height => this.setState({ tabHeight: height })}>
        <Grid hasGutter={true} className={fullHeightStyle}>
          <GridItem span={4}>
            <AppDescription app={this.props.app} health={this.props.health} isSupported={this.props.isSupported} />
          </GridItem>

          <GridItem span={miniGraphSpan}>
            <MiniGraphCard dataSource={this.graphDataSource} />
          </GridItem>
        </Grid>
      </RenderComponentScroll>
    );
  }
}
