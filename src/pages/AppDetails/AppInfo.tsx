import * as React from 'react';
import { Grid, GridItem } from '@patternfly/react-core';
import * as API from '../../services/Api';
import * as AlertUtils from '../../utils/AlertUtils';
import AppDescription from './AppInfo/AppDescription';
import { App } from '../../types/App';
import { RenderComponentScroll } from '../../components/Nav/Page';
import './AppInfo.css';
import { DurationInSeconds } from 'types/Common';
import { DurationDropdownContainer } from 'components/DurationDropdown/DurationDropdown';
import RefreshButtonContainer from 'components/Refresh/RefreshButton';
import GraphDataSource from 'services/GraphDataSource';
import { AppHealth } from 'types/Health';
import { RightActionBar } from 'components/RightActionBar/RightActionBar';

type AppInfoProps = {
  app?: App;
  duration: DurationInSeconds;
  onRefresh: () => void;
};

type AppInfoState = {
  health?: AppHealth;
};

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
    if (prev.duration !== this.props.duration || prev.app !== this.props.app) {
      this.fetchBackend();
    }
  }

  private fetchBackend = () => {
    if (!this.props.app) {
      return;
    }
    this.graphDataSource.fetchForApp(this.props.duration, this.props.app.namespace.name, this.props.app.name);
    const hasSidecar = this.props.app.workloads.some((w) => w.istioSidecar);
    API.getAppHealth(this.props.app.namespace.name, this.props.app.name, this.props.duration, hasSidecar)
      .then((health) => this.setState({ health: health }))
      .catch((error) => AlertUtils.addError('Could not fetch Health.', error));
  };

  render() {
    return (
      <>
        <RightActionBar>
          <DurationDropdownContainer id="app-info-duration-dropdown" prefix="Last" />
          <RefreshButtonContainer handleRefresh={this.fetchBackend} />
        </RightActionBar>
        <RenderComponentScroll>
          <Grid style={{ margin: '10px' }} gutter={'md'}>
            <GridItem span={12}>
              <AppDescription
                app={this.props.app}
                miniGraphDataSource={this.graphDataSource}
                health={this.state.health}
              />
            </GridItem>
          </Grid>
        </RenderComponentScroll>
      </>
    );
  }
}

export default AppInfo;
