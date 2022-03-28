import * as React from 'react';
import { Grid, GridItem } from '@patternfly/react-core';
import AppDescription from './AppDescription';
import { App } from '../../types/App';
import { RenderComponentScroll } from '../../components/Nav/Page';
import { DurationInSeconds, TimeInMilliseconds } from 'types/Common';
import GraphDataSource from 'services/GraphDataSource';
import { AppHealth } from 'types/Health';
import { KialiAppState } from '../../store/Store';
import { connect } from 'react-redux';
import { meshWideMTLSEnabledSelector } from '../../store/Selectors';
import { style } from 'typestyle';
import MiniGraphCard from '../../components/CytoscapeGraph/MiniGraphCard';
import { GraphEdgeTapEvent } from '../../components/CytoscapeGraph/CytoscapeGraph';
import history, { URLParam } from '../../app/History';

type AppInfoProps = {
  app?: App;
  duration: DurationInSeconds;
  health?: AppHealth;
  lastRefreshAt: TimeInMilliseconds;
  mtlsEnabled: boolean;
};

type AppInfoState = {
  tabHeight?: number;
};

const fullHeightStyle = style({
  height: '100%'
});

class AppInfo extends React.Component<AppInfoProps, AppInfoState> {
  private graphDataSource = new GraphDataSource();

  constructor(props: AppInfoProps) {
    super(props);
    this.state = {};
  }

  componentDidMount() {
    this.fetchBackend();
  }

  componentDidUpdate(prev: AppInfoProps) {
    if (this.props.duration !== prev.duration || this.props.app !== prev.app) {
      this.fetchBackend();
    }
  }

  private fetchBackend = () => {
    if (!this.props.app) {
      return;
    }
    this.graphDataSource.fetchForVersionedApp(this.props.duration, this.props.app.namespace.name, this.props.app.name);
  };

  goToMetrics = (e: GraphEdgeTapEvent) => {
    if (e.source !== e.target && this.props.app) {
      const direction = e.source === this.props.app.name ? 'outbound' : 'inbound';
      const destination = direction === 'inbound' ? 'source_canonical_service' : 'destination_canonical_service';
      const urlParams = new URLSearchParams(history.location.search);
      urlParams.set('tab', direction === 'inbound' ? 'in_metrics' : 'out_metrics');
      urlParams.set(URLParam.BY_LABELS, destination + '=' + (e.source === this.props.app.name ? e.target : e.source));
      history.replace(history.location.pathname + '?' + urlParams.toString());
    }
  };

  render() {
    // RenderComponentScroll handles height to provide an inner scroll combined with tabs
    // This height needs to be propagated to minigraph to proper resize in height
    // Graph resizes correctly on width
    const height = this.state.tabHeight ? this.state.tabHeight - 115 : 300;
    const graphContainerStyle = style({ width: '100%', height: height });
    return (
      <RenderComponentScroll onResize={height => this.setState({ tabHeight: height })}>
        <Grid hasGutter={true} className={fullHeightStyle}>
          <GridItem span={4}>
            <AppDescription app={this.props.app} health={this.props.health} />
          </GridItem>
          <GridItem span={8}>
            <MiniGraphCard
              onEdgeTap={this.goToMetrics}
              dataSource={this.graphDataSource}
              mtlsEnabled={this.props.mtlsEnabled}
              graphContainerStyle={graphContainerStyle}
            />
          </GridItem>
        </Grid>
      </RenderComponentScroll>
    );
  }
}

const mapStateToProps = (state: KialiAppState) => ({
  lastRefreshAt: state.globalState.lastRefreshAt,
  mtlsEnabled: meshWideMTLSEnabledSelector(state)
});

const AppInfoContainer = connect(mapStateToProps)(AppInfo);
export default AppInfoContainer;
