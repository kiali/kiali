import * as React from 'react';
import { Service, Port } from '../../../types/IstioObjects';
import { Row, Col, Table } from 'patternfly-react';
import { Link } from 'react-router-dom';
import Label from '../../../components/Label/Label';
import LocalTime from '../../../components/Time/LocalTime';
import * as resolve from 'table-resolver';

type WorkloadServicesProps = {
  services: Service[];
  namespace: string;
};

type WorkloadServicesState = {};

class WorkloadServices extends React.Component<WorkloadServicesProps, WorkloadServicesState> {
  constructor(props: WorkloadServicesProps) {
    super(props);
    this.state = {};
  }
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
          property: 'type',
          header: {
            label: 'Type',
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
          property: 'resourceVersion',
          header: {
            label: 'Resource Version',
            formatters: [this.headerFormat]
          },
          cell: {
            formatters: [this.cellFormat]
          }
        },
        {
          property: 'ip',
          header: {
            label: 'Ip',
            formatters: [this.headerFormat]
          },
          cell: {
            formatters: [this.cellFormat]
          }
        },
        {
          property: 'ports',
          header: {
            label: 'Ports',
            formatters: [this.headerFormat]
          },
          cell: {
            formatters: [this.cellFormat]
          }
        }
      ]
    };
  }

  renderLabels(labels: { [key: string]: string }, u: Number) {
    return labels ? (
      <div key="labels" className="label-collection">
        {Object.keys(labels).map((key, i) => (
          <Label key={'pod_' + u + '_' + i} name={key} value={labels ? labels[key] : ''} />
        ))}
      </div>
    ) : (
      ''
    );
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

  renderPorts(ports: Port[]) {
    return (
      <ul style={{ listStyleType: 'none' }}>
        {(ports || []).map((port, i) => (
          <li key={'port_' + i}>
            {port.protocol} {port.name} ({port.port})
          </li>
        ))}
      </ul>
    );
  }

  rows() {
    return (this.props.services || []).map((service, vsIdx) => {
      const generateRows = {
        id: vsIdx,
        name: this.overviewLink(service),
        createdAt: <LocalTime time={service.createdAt} />,
        type: service.type,
        labels: this.renderLabels(service.labels || {}, vsIdx),
        resourceVersion: service.resourceVersion,
        ip: service.ip,
        ports: this.renderPorts(service.ports || [])
      };

      return generateRows;
    });
  }
  render() {
    return (
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
    );
  }
}

export default WorkloadServices;
