import * as React from 'react';
import {
  Card,
  CardBody,
  EmptyState,
  EmptyStateBody,
  EmptyStateVariant,
  EmptyStateIcon,
  Grid,
  GridItem,
  Text,
  TextVariants,
  Title
} from '@patternfly/react-core';
import { ICell, IRow, Table, TableHeader, TableBody, TableVariant, cellWidth } from '@patternfly/react-table';
import { BundleIcon } from '@patternfly/react-icons';
import { Link } from 'react-router-dom';
import { ServiceDetailsInfo, WorkloadOverview } from '../../../types/ServiceInfo';
import LocalTime from '../../../components/Time/LocalTime';
import MissingSidecar from '../../../components/MissingSidecar/MissingSidecar';
import Labels from '../../../components/Label/Labels';

interface ServiceInfoWorkloadProps {
  workloads?: WorkloadOverview[];
  service: ServiceDetailsInfo;
  namespace: string;
}

class ServiceInfoWorkload extends React.Component<ServiceInfoWorkloadProps> {
  columns(): ICell[] {
    return [
      { title: 'Name', transforms: [cellWidth(10)] },
      { title: 'Type', transforms: [cellWidth(10)] },
      { title: 'Labels', transforms: [cellWidth(60)] },
      { title: 'Created at', transforms: [cellWidth(20)] },
      { title: 'Resource version', transforms: [cellWidth(10)] }
    ];
  }

  overviewLink(workload: WorkloadOverview) {
    return (
      <span>
        <Link
          to={`/namespaces/${this.props.namespace}/workloads/${workload.name}`}
          key={'ServiceWorkloadItem_' + this.props.namespace + '_' + workload.name}
        >
          <Text component={TextVariants.a}>{workload.name}</Text>
        </Link>
        {!workload.istioSidecar && <MissingSidecar namespace={this.props.namespace} tooltip={true} />}
      </span>
    );
  }

  noWorkloads(): IRow[] {
    return [
      {
        cells: [
          {
            title: (
              <EmptyState variant={EmptyStateVariant.full}>
                <EmptyStateIcon icon={BundleIcon} />
                <Title headingLevel="h5" size="lg">
                  No Workloads {!this.props.service.istioSidecar && ' and Istio Sidecar '} found
                </Title>
                <EmptyStateBody>
                  No workloads {!this.props.service.istioSidecar && ' and istioSidecar '} found for service{' '}
                  {this.props.service.service.name}
                </EmptyStateBody>
              </EmptyState>
            ),
            props: { colSpan: 5 }
          }
        ]
      }
    ];
  }

  rows(): IRow[] {
    if ((this.props.workloads || []).length === 0) {
      return this.noWorkloads();
    }
    let rows: IRow[] = [];
    (this.props.workloads || []).map(workload => {
      rows.push({
        cells: [
          { title: this.overviewLink(workload) },
          { title: workload.type },
          { title: <Labels labels={workload.labels} /> },
          { title: <LocalTime time={workload.createdAt} /> },
          { title: workload.resourceVersion }
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
                aria-label={'list_workloads'}
                cells={this.columns()}
                rows={this.rows()}
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

export default ServiceInfoWorkload;
