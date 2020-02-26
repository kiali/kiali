import * as React from 'react';
import AppDescription from './AppInfo/AppDescription';
import { AppHealth } from '../../types/Health';
import { App } from '../../types/App';
import { RenderComponentScroll } from '../../components/Nav/Page';
import './AppInfo.css';
import { Grid, GridItem } from '@patternfly/react-core';
import GraphDataSource from '../../services/GraphDataSource';

type AppInfoProps = {
  app: App;
  health?: AppHealth;
  miniGraphDataSource: GraphDataSource;
  namespace: string;
};

type AppInfoState = {};

class AppInfo extends React.Component<AppInfoProps, AppInfoState> {
  constructor(props: AppInfoProps) {
    super(props);
    this.state = {};
  }

  render() {
    const app = this.props.app;

    return (
      <RenderComponentScroll>
        <Grid style={{ margin: '30px' }} gutter={'md'}>
          <GridItem span={12}>
            <AppDescription app={app} health={this.props.health} miniGraphDataSource={this.props.miniGraphDataSource} />
          </GridItem>
        </Grid>
      </RenderComponentScroll>
    );
  }
}

export default AppInfo;
