import * as React from 'react';
import { Row, Col, Button, Icon } from 'patternfly-react';
import AppDescription from './AppInfo/AppDescription';
import { AppHealth } from '../../types/Health';
import { App } from '../../types/App';
import './AppInfo.css';
import MetricsDurationContainer from '../../components/MetricsOptions/MetricsDuration';
import { DurationInSeconds } from '../../types/Common';

type AppInfoProps = {
  app: App;
  namespace: string;
  onRateIntervalChanged: (rateInterval: DurationInSeconds) => void;
  onRefresh: () => void;
  onSelectTab: (tabName: string, postHandler?: (k: string) => void) => (tabKey: string) => void;
  activeTab: (tabName: string, whenEmpty: string) => string;
  health?: AppHealth;
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
      <>
        <div className="container-fluid container-cards-pf">
          <Row className="row-cards-pf">
            <Col xs={12} sm={12} md={12} lg={12}>
              <span style={{ float: 'right' }}>
                <MetricsDurationContainer onChanged={this.props.onRateIntervalChanged} />{' '}
                <Button onClick={this.props.onRefresh}>
                  <Icon name="refresh" />
                </Button>
              </span>
            </Col>
          </Row>
          <Row className="row-cards-pf">
            <Col xs={12} sm={12} md={12} lg={12}>
              <AppDescription app={app} health={this.props.health} />
            </Col>
          </Row>
        </div>
      </>
    );
  }
}

export default AppInfo;
