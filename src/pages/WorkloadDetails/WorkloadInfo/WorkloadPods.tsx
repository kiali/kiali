import * as React from 'react';
import { ObjectValidation, Pod } from '../../../types/IstioObjects';
import { ValidationSummary } from '../../../components/Validations/ValidationSummary';
import Labels from '../../../components/Label/Labels';
import { cellWidth, ICell, IRow, Table, TableBody, TableHeader, TableVariant } from '@patternfly/react-table';
import LocalTime from '../../../components/Time/LocalTime';
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
import { CogsIcon } from '@patternfly/react-icons';

type WorkloadPodsProps = {
  namespace: string;
  workload: string;
  pods: Pod[];
  validations: { [key: string]: ObjectValidation };
};

class WorkloadPods extends React.Component<WorkloadPodsProps> {
  columns(): ICell[] {
    return [
      { title: 'Status', transforms: [cellWidth(10)] },
      { title: 'Name', transforms: [cellWidth(10)] },
      { title: 'Created at', transforms: [cellWidth(10)] },
      { title: 'Created by', transforms: [cellWidth(10)] },
      { title: 'Labels', transforms: [cellWidth(60)] },
      { title: 'Istio Init Containers', transforms: [cellWidth(60)] },
      { title: 'Istio Containers', transforms: [cellWidth(60)] },
      { title: 'Phase', transforms: [cellWidth(10)] }
    ];
  }

  noPods(): IRow[] {
    return [
      {
        cells: [
          {
            title: (
              <EmptyState variant={EmptyStateVariant.full}>
                <EmptyStateIcon icon={CogsIcon} />
                <Title headingLevel="h5" size="lg">
                  No Pods found
                </Title>
                <EmptyStateBody>No Pods in workload {this.props.workload}</EmptyStateBody>
              </EmptyState>
            ),
            props: { colSpan: 5 }
          }
        ]
      }
    ];
  }

  rows(): IRow[] {
    if ((this.props.pods || []).length === 0) {
      return this.noPods();
    }

    let rows: IRow[] = [];
    (this.props.pods || []).map((pod, podIdx) => {
      const validations: ObjectValidation[] = [];
      if (this.props.validations[pod.name]) {
        validations.push(this.props.validations[pod.name]);
      }

      rows.push({
        cells: [
          {
            title: <ValidationSummary id={podIdx + '-config-validation'} validations={validations} definition={true} />
          },
          { title: <>{pod.name}</> },
          { title: <LocalTime time={pod.createdAt || ''} /> },
          {
            title:
              pod.createdBy && pod.createdBy.length > 0
                ? pod.createdBy.map(ref => ref.name + ' (' + ref.kind + ')').join(', ')
                : ''
          },
          { title: <Labels key={'labels' + podIdx} labels={pod.labels} /> },
          { title: pod.istioInitContainers ? pod.istioInitContainers.map(c => `${c.image}`).join(', ') : '' },
          { title: pod.istioContainers ? pod.istioContainers.map(c => `${c.image}`).join(', ') : '' },
          { title: pod.status }
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
                aria-label={'list_workloads_pods'}
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

export default WorkloadPods;
