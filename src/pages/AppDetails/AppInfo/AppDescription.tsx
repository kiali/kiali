import * as React from 'react';
import { DisplayMode, HealthIndicator } from '../../../components/Health/HealthIndicator';
import MissingSidecar from '../../../components/MissingSidecar/MissingSidecar';
import { AppHealth } from '../../../types/Health';
import { App, AppWorkload } from '../../../types/App';
import { Link } from 'react-router-dom';
import {
  Badge,
  Card,
  CardBody,
  DataList,
  DataListCell,
  DataListItem,
  DataListItemCells,
  DataListItemRow,
  Grid,
  GridItem,
  List,
  ListItem,
  Text,
  TextVariants
} from '@patternfly/react-core';

type AppDescriptionProps = {
  app: App;
  health?: AppHealth;
};

type AppDescriptionState = {};

class AppDescription extends React.Component<AppDescriptionProps, AppDescriptionState> {
  constructor(props: AppDescriptionProps) {
    super(props);
    this.state = {};
  }

  istioSidecar() {
    let istioSidecar = true; // true until proven otherwise (workload with missing sidecar exists)
    this.props.app.workloads.forEach(wkd => {
      istioSidecar = istioSidecar && wkd.istioSidecar;
    });
    return istioSidecar;
  }

  serviceLink(namespace: string, service: string) {
    return '/namespaces/' + namespace + '/services/' + service;
  }

  workloadLink(namespace: string, workload: string) {
    return '/namespaces/' + namespace + '/workloads/' + workload;
  }

  renderWorkloadItem(namespace: string, workload: AppWorkload) {
    return (
      <ListItem key={`AppWorkload_${workload.workloadName}`}>
        <Link to={this.workloadLink(namespace, workload.workloadName)}>{workload.workloadName}</Link>
        {!workload.istioSidecar && (
          <MissingSidecar namespace={namespace} style={{ marginLeft: '10px' }} tooltip={true} text={''} />
        )}
      </ListItem>
    );
  }

  renderServiceItem(namespace: string, _appName: string, serviceName: string) {
    return (
      <ListItem key={`AppService_${serviceName}`}>
        <Link to={this.serviceLink(namespace, serviceName)}>{serviceName}</Link>
      </ListItem>
    );
  }

  renderEmptyItem(type: string) {
    const message = 'No ' + type + ' found for this app.';
    return <DataListCell> {message} </DataListCell>;
  }

  workloadList() {
    const ns = this.props.app.namespace.name;
    const workloads = this.props.app.workloads;
    const workloadList =
      workloads.length > 0 ? workloads.map(wkd => this.renderWorkloadItem(ns, wkd)) : this.renderEmptyItem('workloads');

    return [
      <DataListCell key="workload-icon" isIcon={true}>
        <Badge>W</Badge>
      </DataListCell>,
      <DataListCell key="workload-list" className="resourceList">
        <Text component={TextVariants.h3}>Workloads</Text>
        <List>{workloadList}</List>
      </DataListCell>
    ];
  }

  serviceList() {
    const ns = this.props.app.namespace.name;
    const services = this.props.app.serviceNames;
    const serviceList =
      services.length > 0
        ? services.map(sn => this.renderServiceItem(ns, this.props.app.name, sn))
        : this.renderEmptyItem('services');

    return [
      <DataListCell key="service-icon" isIcon={true}>
        <Badge>S</Badge>
      </DataListCell>,
      <DataListCell key="service-list" className="resourceList">
        <Text component={TextVariants.h3}>Services</Text>
        <List>{serviceList}</List>
      </DataListCell>
    ];
  }

  render() {
    const app = this.props.app;
    return app ? (
      <Grid gutter="md">
        <GridItem span={6}>
          <Card>
            <CardBody className="noPadding">
              <h2>Application Overview</h2>
              <DataList aria-label="workloads and services">
                <DataListItem aria-labelledby="Workloads">
                  <DataListItemRow>
                    <DataListItemCells dataListCells={this.workloadList()} />
                  </DataListItemRow>
                </DataListItem>
                <DataListItem aria-labelledby="Services">
                  <DataListItemRow>
                    <DataListItemCells dataListCells={this.serviceList()} />
                  </DataListItemRow>
                </DataListItem>
              </DataList>
            </CardBody>
          </Card>
        </GridItem>
        <GridItem span={6}>
          <Card>
            <CardBody>
              <div>
                <Text component={TextVariants.h2}>Health Overview</Text>
                <strong>Health</strong>
              </div>
              <HealthIndicator id={app.name} health={this.props.health} mode={DisplayMode.LARGE} />
            </CardBody>
          </Card>
        </GridItem>
      </Grid>
    ) : (
      'Loading'
    );
  }
}

export default AppDescription;
