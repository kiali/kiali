import * as React from 'react';
import { Service } from '../../../types/IstioObjects';
import { Link } from 'react-router-dom';
import LocalTime from '../../../components/Time/LocalTime';
import Labels from '../../../components/Label/Labels';
import { cellWidth, ICell, IRow, Table, TableBody, TableHeader, TableVariant } from '@patternfly/react-table';
import {
  Card,
  CardBody,
  EmptyState,
  EmptyStateBody,
  EmptyStateIcon,
  EmptyStateVariant,
  Grid,
  GridItem,
  Title
} from '@patternfly/react-core';
import { ServiceIcon } from '@patternfly/react-icons';
import { ServicePort } from '../../../types/ServiceInfo';

type WorkloadServicesProps = {
  services: Service[];
  workload: string;
  namespace: string;
};

class WorkloadServices extends React.Component<WorkloadServicesProps> {
  columns(): ICell[] {
    // TODO: Casting 'as any' because @patternfly/react-table@2.22.19 has a typing bug. Remove the casting when PF fixes it.
    // https://github.com/patternfly/patternfly-next/issues/2373
    return [
      { title: 'Name', transforms: [cellWidth(10) as any] },
      { title: 'Created at' },
      { title: 'Type' },
      { title: 'Labels' },
      { title: 'Resource Version' },
      { title: 'Ip' },
      { title: 'Ports' }
    ];
  }

  overviewLink(service: Service) {
    return (
      <Link
        to={`/namespaces/${this.props.namespace}/services/${service.name}`}
        key={'WorkloadServiceItem_' + this.props.namespace + '_' + service.name}
      >
        {service.name}
      </Link>
    );
  }

  renderPorts(ports: ServicePort[]) {
    return (
      <ul style={{ listStyleType: 'none' }}>
        {(ports || []).map((port, i) => (
          <li key={'port_' + i}>
            <span style={{ whiteSpace: 'nowrap' }}>
              {port.protocol} {port.name} ({port.port})
            </span>
          </li>
        ))}
      </ul>
    );
  }

  noServices(): IRow[] {
    return [
      {
        cells: [
          {
            title: (
              <EmptyState variant={EmptyStateVariant.full}>
                <EmptyStateIcon icon={ServiceIcon} />
                <Title headingLevel="h5" size="lg">
                  No Services found
                </Title>
                <EmptyStateBody>No Services in workload {this.props.workload}</EmptyStateBody>
              </EmptyState>
            ),
            props: { colSpan: 7 }
          }
        ]
      }
    ];
  }

  rows() {
    if ((this.props.services || []).length === 0) {
      return this.noServices();
    }
    let rows: IRow[] = [];

    (this.props.services || []).map((service, vsIdx) => {
      rows.push({
        cells: [
          { title: this.overviewLink(service) },
          { title: <LocalTime time={service.createdAt} /> },
          { title: service.type },
          { title: <Labels key={'pod_' + vsIdx} labels={service.labels} /> },
          { title: service.resourceVersion },
          { title: service.ip },
          { title: this.renderPorts(service.ports || []) }
        ]
      });
      return rows;
    });
    return rows;
  }
  render() {
    return (
      <Grid>
        <GridItem span={12}>
          <Card>
            <CardBody>
              <Table
                variant={TableVariant.compact}
                aria-label={'list_workloads_services'}
                cells={this.columns()}
                rows={this.rows()}
                // This style is declared on _overrides.scss
                className="table"
              >
                <TableHeader />
                <TableBody />
              </Table>
            </CardBody>
          </Card>
        </GridItem>
      </Grid>
    );
  }
}

export default WorkloadServices;
