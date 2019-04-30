import * as React from 'react';
import { Col, Row, Table } from 'patternfly-react';
import { Link } from 'react-router-dom';
import * as resolve from 'table-resolver';

import { WorkloadOverview } from '../../../types/ServiceInfo';
import LocalTime from '../../../components/Time/LocalTime';
import MissingSidecar from '../../../components/MissingSidecar/MissingSidecar';
import Labels from '../../../components/Label/Labels';

interface ServiceInfoWorkloadProps {
  workloads?: WorkloadOverview[];
  namespace: string;
}

class ServiceInfoWorkload extends React.Component<ServiceInfoWorkloadProps> {
  headerFormat = (label, { column }) => <Table.Heading className={column.property}>{label}</Table.Heading>;
  cellFormat = value => {
    return <Table.Cell>{value}</Table.Cell>;
  };

  columns() {
    return {
      columns: [
        {
          property: 'name',
          header: {
            label: 'Name',
            formatters: [this.headerFormat]
          },
          cell: {
            formatters: [this.cellFormat]
          }
        },
        {
          property: 'type',
          header: {
            label: 'Type',
            formatters: [this.headerFormat]
          },
          cell: {
            formatters: [this.cellFormat],
            props: {
              align: 'text-center'
            }
          }
        },
        {
          property: 'labels',
          header: {
            label: 'Labels',
            formatters: [this.headerFormat]
          },
          cell: {
            formatters: [this.cellFormat]
          }
        },
        {
          property: 'createdAt',
          header: {
            label: 'Created at',
            formatters: [this.headerFormat]
          },
          cell: {
            formatters: [this.cellFormat]
          }
        },
        {
          property: 'resourceVersion',
          header: {
            label: 'Resource version',
            formatters: [this.headerFormat]
          },
          cell: {
            formatters: [this.cellFormat]
          }
        }
      ]
    };
  }

  overviewLink(workload: WorkloadOverview) {
    return (
      <span>
        <Link
          to={`/namespaces/${this.props.namespace}/workloads/${workload.name}`}
          key={'ServiceWorkloadItem_' + this.props.namespace + '_' + workload.name}
        >
          {workload.name}
        </Link>
        {!workload.istioSidecar && <MissingSidecar tooltip={true} style={{ marginLeft: '10px' }} />}
      </span>
    );
  }

  rows() {
    return (this.props.workloads || []).map((workload, vsIdx) => ({
      id: vsIdx,
      type: workload.type,
      name: this.overviewLink(workload),
      createdAt: <LocalTime time={workload.createdAt} />,
      resourceVersion: workload.resourceVersion,
      labels: <Labels labels={workload.labels} />
    }));
  }

  renderTable() {
    return (
      <Table.PfProvider columns={this.columns().columns} striped={true} bordered={true} hover={true} dataTable={true}>
        <Table.Header headerRows={resolve.headerRows(this.columns())} />
        <Table.Body rows={this.rows()} rowKey="id" />
      </Table.PfProvider>
    );
  }

  render() {
    return (
      <Row className="card-pf-body">
        <Col xs={12}>{this.renderTable()}</Col>
      </Row>
    );
  }
}

export default ServiceInfoWorkload;
