import * as React from 'react';
import { Col, Row, Table } from 'patternfly-react';
import * as resolve from 'table-resolver';
import { Link } from 'react-router-dom';
import { EditorLink, ObjectValidation, VirtualService } from '../../../types/ServiceInfo';
import './ServiceInfoVirtualServices.css';
import LocalTime from '../../../components/Time/LocalTime';
import { ConfigIndicator } from '../../../components/ConfigValidation/ConfigIndicator';

interface ServiceInfoVirtualServicesProps extends EditorLink {
  virtualServices?: VirtualService[];
  validations: { [key: string]: ObjectValidation };
}

class ServiceInfoVirtualServices extends React.Component<ServiceInfoVirtualServicesProps> {
  headerFormat = (label, { column }) => <Table.Heading className={column.property}>{label}</Table.Heading>;
  cellFormat = (value, { column }) => {
    const props = column.cell.props;
    const className = props ? props.align : '';

    return <Table.Cell className={className}>{value}</Table.Cell>;
  };

  constructor(props: ServiceInfoVirtualServicesProps) {
    super(props);
  }

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
          property: 'resourceVersion',
          header: {
            label: 'Resource version',
            formatters: [this.headerFormat]
          },
          cell: {
            formatters: [this.cellFormat]
          }
        },
        {
          property: 'actions',
          header: {
            label: 'Actions',
            formatters: [this.headerFormat]
          },
          cell: {
            formatters: [this.cellFormat]
          }
        }
      ]
    };
  }

  validation(virtualService: VirtualService): ObjectValidation {
    return this.props.validations[virtualService.name];
  }

  nameLink(virtualService: VirtualService) {
    return <Link to={this.props.editorLink + '?virtualservice=' + virtualService.name}>{virtualService.name}</Link>;
  }

  showYAML(virtualService: VirtualService) {
    return <Link to={this.props.editorLink + '?virtualservice=' + virtualService.name}>View YAML</Link>;
  }

  rows() {
    return (this.props.virtualServices || []).map((virtualService, vsIdx) => ({
      id: vsIdx,
      status: <ConfigIndicator id={vsIdx + '-config-validation'} validation={this.validation(virtualService)} />,
      name: this.nameLink(virtualService),
      createdAt: <LocalTime time={virtualService.createdAt} />,
      resourceVersion: virtualService.resourceVersion,
      actions: this.showYAML(virtualService)
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

export default ServiceInfoVirtualServices;
