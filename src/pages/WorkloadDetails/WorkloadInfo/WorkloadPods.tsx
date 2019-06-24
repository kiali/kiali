import * as React from 'react';
import { ObjectValidation, Pod } from '../../../types/IstioObjects';
import { Col, Row, Table } from 'patternfly-react';
import * as resolve from 'table-resolver';
import { ConfigIndicator } from '../../../components/ConfigValidation/ConfigIndicator';
import Labels from '../../../components/Label/Labels';

type WorkloadPodsProps = {
  namespace: string;
  pods: Pod[];
  validations: { [key: string]: ObjectValidation };
};

class WorkloadPods extends React.Component<WorkloadPodsProps> {
  headerFormat = (label, { column }) => <Table.Heading className={column.property}>{label}</Table.Heading>;
  cellFormat = value => {
    return <Table.Cell>{value}</Table.Cell>;
  };

  columns() {
    return {
      columns: [
        {
          property: 'status',
          header: {
            label: 'Status',
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
          property: 'createdBy',
          header: {
            label: 'Created by',
            formatters: [this.headerFormat]
          },
          cell: {
            formatters: [this.cellFormat]
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
          property: 'istioInitContainers',
          header: {
            label: 'Istio Init Containers',
            formatters: [this.headerFormat]
          },
          cell: {
            formatters: [this.cellFormat]
          }
        },
        {
          property: 'istioContainers',
          header: {
            label: 'Istio Containers',
            formatters: [this.headerFormat]
          },
          cell: {
            formatters: [this.cellFormat]
          }
        },
        {
          property: 'podStatus',
          header: {
            label: 'Phase',
            formatters: [this.headerFormat]
          },
          cell: {
            formatters: [this.cellFormat]
          }
        }
      ]
    };
  }

  rows() {
    return (this.props.pods || []).map((pod, podIdx) => {
      const validations: ObjectValidation[] = [];
      if (this.props.validations[pod.name]) {
        validations.push(this.props.validations[pod.name]);
      }
      return {
        id: podIdx,
        status: <ConfigIndicator id={podIdx + '-config-validation'} validations={validations} definition={true} />,
        name: pod.name,
        createdAt: new Date(pod.createdAt).toLocaleString(),
        createdBy:
          pod.createdBy && pod.createdBy.length > 0
            ? pod.createdBy.map(ref => ref.name + ' (' + ref.kind + ')').join(', ')
            : '',
        labels: <Labels key={'labels' + podIdx} labels={pod.labels} />,
        istioInitContainers: pod.istioInitContainers ? pod.istioInitContainers.map(c => `${c.image}`).join(', ') : '',
        istioContainers: pod.istioContainers ? pod.istioContainers.map(c => `${c.image}`).join(', ') : '',
        podStatus: pod.status
      };
    });
  }

  render() {
    return (
      <>
        <Row className="card-pf-body">
          <Col xs={12}>
            <Table.PfProvider
              columns={this.columns().columns}
              striped={true}
              bordered={true}
              hover={true}
              dataTable={true}
            >
              <Table.Header headerRows={resolve.headerRows(this.columns())} />
              <Table.Body rows={this.rows()} rowKey="id" />
            </Table.PfProvider>
          </Col>
        </Row>
      </>
    );
  }
}

export default WorkloadPods;
