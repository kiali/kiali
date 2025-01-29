import * as React from 'react';
import { Grid, GridItem } from '@patternfly/react-core';
import { AppDescription } from './AppDescription';
import { App } from '../../types/App';
import { RenderComponentScroll } from '../../components/Nav/Page';
import { DurationInSeconds } from 'types/Common';
import { GraphDataSource } from 'services/GraphDataSource';
import { AppHealth } from 'types/Health';
import { kialiStyle } from 'styles/StyleUtils';
import { GraphEdgeTapEvent } from '../../components/CytoscapeGraph/CytoscapeGraph';
import { location, router, URLParam } from '../../app/History';
import { MiniGraphCard } from '../../components/CytoscapeGraph/MiniGraphCard';
import { serverConfig } from 'config';
import { MiniGraphCardPF } from 'pages/GraphPF/MiniGraphCardPF';

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

  goToMetrics = (e: GraphEdgeTapEvent): void => {
    if (e.source !== e.target && this.props.app) {
      const direction = e.source === this.props.app.name ? 'outbound' : 'inbound';
      const destination = direction === 'inbound' ? 'source_canonical_service' : 'destination_canonical_service';
      const urlParams = new URLSearchParams(location.getSearch());
      urlParams.set('tab', direction === 'inbound' ? 'in_metrics' : 'out_metrics');
      urlParams.set(URLParam.BY_LABELS, `${destination}=${e.source === this.props.app.name ? e.target : e.source}`);
      router.navigate(`${location.getPathname()}?${urlParams.toString()}`, { replace: true });
    }
  };

  render(): React.ReactNode {
    // RenderComponentScroll handles height to provide an inner scroll combined with tabs
    // This height needs to be propagated to minigraph to proper resize in height
    // Graph resizes correctly on width
    const height = this.state.tabHeight ? this.state.tabHeight - 115 : 300;
    const graphContainerStyle = kialiStyle({ width: '100%', height: height });
    const includeMiniGraphCy = serverConfig.kialiFeatureFlags.uiDefaults.graph.impl !== 'pf';
    const includeMiniGraphPF = serverConfig.kialiFeatureFlags.uiDefaults.graph.impl !== 'cy';
    const miniGraphSpan = includeMiniGraphCy && includeMiniGraphPF ? 4 : 8;
    return (
      <RenderComponentScroll onResize={height => this.setState({ tabHeight: height })}>
        <Grid hasGutter={true} className={fullHeightStyle}>
          <GridItem span={4}>
            <AppDescription app={this.props.app} health={this.props.health} isSupported={this.props.isSupported} />
          </GridItem>

          {includeMiniGraphCy && (
            <GridItem span={miniGraphSpan}>
              <MiniGraphCard
                onEdgeTap={this.goToMetrics}
                dataSource={this.graphDataSource}
                graphContainerStyle={graphContainerStyle}
              />
            </GridItem>
          )}

          {includeMiniGraphPF && (
            <GridItem span={miniGraphSpan}>
              <MiniGraphCardPF dataSource={this.graphDataSource} />
            </GridItem>
          )}
        </Grid>
      </RenderComponentScroll>
    );
  }
}
