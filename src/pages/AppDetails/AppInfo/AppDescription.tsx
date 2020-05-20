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
  CardHeader,
  DataList,
  DataListItem,
  DataListItemCells,
  DataListItemRow,
  Grid,
  GridItem,
  List,
  ListItem,
  PopoverPosition,
  Stack,
  StackItem,
  Title
} from '@patternfly/react-core';
import GraphDataSource from '../../../services/GraphDataSource';
import MiniGraphCard from '../../../components/CytoscapeGraph/MiniGraphCard';
import './AppDescription.css';
import { style } from 'typestyle';

const iconStyle = style({
  margin: '0 16px 0 0',
  padding: '24px 0 0 0'
});

const resourceListStyle = style({
  margin: '0px 0 11px 0'
});

const titleStyle = style({
  margin: '15px 0 11px 0'
});

type AppDescriptionProps = {
  app?: App;
  health?: AppHealth;
  miniGraphDataSource: GraphDataSource;
};

class AppDescription extends React.Component<AppDescriptionProps> {
  private serviceLink(namespace: string, service: string) {
    return '/namespaces/' + namespace + '/services/' + service;
  }

  private workloadLink(namespace: string, workload: string) {
    return '/namespaces/' + namespace + '/workloads/' + workload;
  }

  private renderWorkloadItem(namespace: string, workload: AppWorkload) {
    return (
      <ListItem key={`AppWorkload_${workload.workloadName}`}>
        <Link to={this.workloadLink(namespace, workload.workloadName)}>{workload.workloadName}</Link>
        {!workload.istioSidecar && (
          <MissingSidecar namespace={namespace} tooltip={true} style={{ marginLeft: '10px' }} text={''} />
        )}
      </ListItem>
    );
  }

  private renderServiceItem(namespace: string, _appName: string, serviceName: string) {
    return (
      <ListItem key={`AppService_${serviceName}`}>
        <Link to={this.serviceLink(namespace, serviceName)}>{serviceName}</Link>
      </ListItem>
    );
  }

  private renderEmptyItem(type: string) {
    const message = 'No ' + type + ' found for this app.';
    return <div> {message} </div>;
  }

  private workloadList() {
    const ns = this.props.app?.namespace.name || '';
    const workloads = this.props.app?.workloads || [];
    const workloadList =
      workloads.length > 0 ? workloads.map(wkd => this.renderWorkloadItem(ns, wkd)) : this.renderEmptyItem('workloads');

    return [
      <div key="workload-icon" className={iconStyle}>
        <Badge>W</Badge>
      </div>,
      <div key="workload-list" className={resourceListStyle}>
        <Title headingLevel="h3" size="lg" className={titleStyle}>
          Workloads
        </Title>
        <List>{workloadList}</List>
      </div>
    ];
  }

  private serviceList() {
    const ns = this.props.app?.namespace.name || '';
    const services = this.props.app?.serviceNames || [];
    const serviceList =
      services.length > 0
        ? services.map(sn => this.renderServiceItem(ns, this.props.app!.name, sn))
        : this.renderEmptyItem('services');

    return [
      <div key="service-icon" className={iconStyle}>
        <Badge>S</Badge>
      </div>,
      <div key="service-list" className={resourceListStyle}>
        <Title headingLevel="h3" size="lg" className={titleStyle}>
          Services
        </Title>
        <List>{serviceList}</List>
      </div>
    ];
  }

  render() {
    const app = this.props.app;
    return app ? (
      <Grid gutter="md">
        <GridItem span={4}>
          <Card style={{ height: '100%' }}>
            <CardHeader>
              <Title headingLevel="h3" size="2xl">
                {' '}
                Application Structure
              </Title>
            </CardHeader>
            <CardBody className="noPadding">
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
        <GridItem span={4}>
          <MiniGraphCard dataSource={this.props.miniGraphDataSource} />
        </GridItem>
        <GridItem span={4}>
          <Card style={{ height: '100%' }}>
            <CardHeader>
              <Title headingLevel="h3" size="2xl">
                {' '}
                Health Overview{' '}
              </Title>
            </CardHeader>
            <CardBody>
              <Stack>
                <StackItem id="health" className={'stack_service_details'}>
                  <Title headingLevel="h3" size="lg" className={titleStyle}>
                    Overall Health
                  </Title>
                  <HealthIndicator
                    id={app.name}
                    health={this.props.health}
                    mode={DisplayMode.LARGE}
                    tooltipPlacement={PopoverPosition.left}
                  />
                </StackItem>
              </Stack>
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
