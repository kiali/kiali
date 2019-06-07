import * as React from 'react';
import { Col, Row } from 'patternfly-react';
import AppDescription from './AppInfo/AppDescription';
import { AppHealth } from '../../types/Health';
import { App } from '../../types/App';
import './AppInfo.css';
import { DurationDropdownContainer } from '../../components/DurationDropdown/DurationDropdown';
import RefreshButtonContainer from '../../components/Refresh/RefreshButton';

type AppInfoProps = {
  app: App;
  namespace: string;
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
                <DurationDropdownContainer id="app-info-duration-dropdown" />{' '}
                <RefreshButtonContainer handleRefresh={this.props.onRefresh} />
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
