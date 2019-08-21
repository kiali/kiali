import * as React from 'react';
import { style } from 'typestyle';
import { Validations } from '../../types/IstioObjects';
import { Col, Icon, Row } from 'patternfly-react';
import WorkloadDescription from './WorkloadInfo/WorkloadDescription';
import WorkloadPods from './WorkloadInfo/WorkloadPods';
import WorkloadServices from './WorkloadInfo/WorkloadServices';
import { severityToIconName, validationToSeverity } from '../../types/ServiceInfo';
import { WorkloadHealth } from '../../types/Health';
import { Workload } from '../../types/Workload';
import { DurationDropdownContainer } from '../../components/DurationDropdown/DurationDropdown';
import RefreshButtonContainer from '../../components/Refresh/RefreshButton';
import { Tab } from '@patternfly/react-core';
import ParameterizedTabs, { activeTab } from '../../components/Tab/Tabs';

type WorkloadInfoProps = {
  workload: Workload;
  validations: Validations;
  namespace: string;
  onRefresh: () => void;
  istioEnabled: boolean;
  health?: WorkloadHealth;
};

interface ValidationChecks {
  hasPodsChecks: boolean;
}

type WorkloadInfoState = {
  currentTab: string;
};

const tabIconStyle = style({
  fontSize: '0.9em'
});
const floatRightStyle = style({
  float: 'right'
});

const tabName = 'list';
const defaultTab = 'pods';
const paramToTab: { [key: string]: number } = {
  pods: 0,
  services: 1
};

class WorkloadInfo extends React.Component<WorkloadInfoProps, WorkloadInfoState> {
  constructor(props: WorkloadInfoProps) {
    super(props);
    this.state = {
      currentTab: activeTab(tabName, defaultTab)
    };
  }

  validationChecks(): ValidationChecks {
    const validationChecks = {
      hasPodsChecks: false
    };

    const pods = this.props.workload.pods || [];

    validationChecks.hasPodsChecks = pods.some(
      pod =>
        this.props.validations.pod &&
        this.props.validations.pod[pod.name] &&
        this.props.validations.pod[pod.name].checks.length > 0
    );

    return validationChecks;
  }

  render() {
    const workload = this.props.workload;
    const pods = workload.pods || [];
    const services = workload.services || [];
    const validationChecks = this.validationChecks();

    const getSeverityIcon: any = (severity: string = 'error') => (
      <span className={tabIconStyle}>
        {' '}
        <Icon type="pf" name={severityToIconName(severity)} />
      </span>
    );

    const getValidationIcon = (keys: string[], type: string) => {
      let severity = 'warning';
      keys.forEach(key => {
        const validations = this.props.validations![type][key];
        if (validationToSeverity(validations) === 'error') {
          severity = 'error';
        }
      });
      return getSeverityIcon(severity);
    };

    const podTabTitle: any = (
      <>
        Pods ({pods.length}){' '}
        {validationChecks.hasPodsChecks
          ? getValidationIcon((this.props.workload.pods || []).map(a => a.name), 'pod')
          : undefined}
      </>
    );

    return (
      <div>
        <div className="container-fluid container-cards-pf">
          <Row className="row-cards-pf">
            <Col xs={12} sm={12} md={12} lg={12}>
              <span className={floatRightStyle}>
                <DurationDropdownContainer id="workload-info-duration-dropdown" />{' '}
                <RefreshButtonContainer handleRefresh={this.props.onRefresh} />
              </span>
            </Col>
          </Row>
          <Row className="row-cards-pf">
            <Col xs={12} sm={12} md={12} lg={12}>
              <WorkloadDescription
                workload={workload}
                namespace={this.props.namespace}
                istioEnabled={this.props.istioEnabled}
                health={this.props.health}
              />
            </Col>
          </Row>
          <Row className="row-cards-pf">
            <Col xs={12} sm={12} md={12} lg={12}>
              <ParameterizedTabs
                id="service-tabs"
                onSelect={tabValue => {
                  this.setState({ currentTab: tabValue });
                }}
                tabMap={paramToTab}
                tabName={tabName}
                defaultTab={defaultTab}
              >
                <Tab title={podTabTitle} eventKey={0}>
                  {pods.length > 0 && (
                    <WorkloadPods
                      namespace={this.props.namespace}
                      pods={pods}
                      validations={this.props.validations!.pod}
                    />
                  )}
                </Tab>
                <Tab title={'Services (' + services.length + ')'} eventKey={1}>
                  {services.length > 0 && <WorkloadServices services={services} namespace={this.props.namespace} />}
                </Tab>
              </ParameterizedTabs>
            </Col>
          </Row>
        </div>
      </div>
    );
  }
}

export default WorkloadInfo;
