import * as React from 'react';
import { Validations } from '../../types/IstioObjects';
import { Row, Col, Button, Icon, TabContainer, TabContent, TabPane, Nav, NavItem } from 'patternfly-react';
import WorkloadDescription from './WorkloadInfo/WorkloadDescription';
import WorkloadPods from './WorkloadInfo/WorkloadPods';
import WorkloadServices from './WorkloadInfo/WorkloadServices';
import { severityToIconName, validationToSeverity } from '../../types/ServiceInfo';
import { WorkloadHealth } from '../../types/Health';
import { Workload } from '../../types/Workload';

type WorkloadInfoProps = {
  workload: Workload;
  validations: Validations;
  namespace: string;
  onRefresh: () => void;
  onSelectTab: (tabName: string, tabKey?: string) => void;
  activeTab: (tabName: string, whenEmpty: string) => string;
  istioEnabled: boolean;
  health?: WorkloadHealth;
};

interface ValidationChecks {
  hasPodsChecks: boolean;
}

type WorkloadInfoState = {};

const tabName = 'list';

class WorkloadInfo extends React.Component<WorkloadInfoProps, WorkloadInfoState> {
  constructor(props: WorkloadInfoProps) {
    super(props);
    this.state = {};
  }

  validationChecks(): ValidationChecks {
    let validationChecks = {
      hasPodsChecks: false
    };

    const pods = this.props.workload.pods || [];

    validationChecks.hasPodsChecks = pods.some(
      pod =>
        this.props.validations['pod'] &&
        this.props.validations['pod'][pod.name] &&
        this.props.validations['pod'][pod.name].checks.length > 0
    );

    return validationChecks;
  }

  render() {
    const workload = this.props.workload;
    const pods = workload.pods || [];
    const services = workload.services || [];
    const validationChecks = this.validationChecks();

    const getSeverityIcon: any = (severity: string = 'error') => (
      <span>
        {' '}
        <Icon type="pf" name={severityToIconName(severity)} />
      </span>
    );

    const getValidationIcon = (keys: string[], type: string) => {
      let severity = 'warning';
      keys.map(key => {
        const validations = this.props.validations![type][key];
        if (validationToSeverity(validations) === 'error') {
          severity = 'error';
        }
      });
      return getSeverityIcon(severity);
    };

    return (
      <div>
        <div className="container-fluid container-cards-pf">
          <Row className="row-cards-pf">
            <Col xs={12} sm={12} md={12} lg={12}>
              <Button onClick={this.props.onRefresh} style={{ float: 'right' }}>
                <Icon name="refresh" />
              </Button>
            </Col>
          </Row>
          <Row className="row-cards-pf">
            <Col xs={12} sm={12} md={12} lg={12}>
              <WorkloadDescription
                workload={workload}
                istioEnabled={this.props.istioEnabled}
                health={this.props.health}
              />
            </Col>
          </Row>
          <Row className="row-cards-pf">
            <Col xs={12} sm={12} md={12} lg={12}>
              <TabContainer
                id="service-tabs"
                activeKey={this.props.activeTab(tabName, 'pods')}
                onSelect={this.props.onSelectTab(tabName)}
              >
                <div>
                  <Nav bsClass="nav nav-tabs nav-tabs-pf">
                    <NavItem eventKey={'pods'}>
                      {'Pods (' + pods.length + ')'}
                      {validationChecks.hasPodsChecks
                        ? getValidationIcon((this.props.workload.pods || []).map(a => a.name), 'pod')
                        : undefined}
                    </NavItem>
                    <NavItem eventKey={'services'}>{'Services (' + services.length + ')'}</NavItem>
                  </Nav>
                  <TabContent>
                    <TabPane eventKey={'pods'}>
                      {pods.length > 0 && <WorkloadPods pods={pods} validations={this.props.validations!['pod']} />}
                    </TabPane>
                    <TabPane eventKey={'services'}>
                      {services.length > 0 && <WorkloadServices services={services} namespace={this.props.namespace} />}
                    </TabPane>
                  </TabContent>
                </div>
              </TabContainer>
            </Col>
          </Row>
        </div>
      </div>
    );
  }
}

export default WorkloadInfo;
