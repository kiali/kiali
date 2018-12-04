import * as React from 'react';
import { EditorLink } from '../../../types/ServiceInfo';
import { Col, Row, Table } from 'patternfly-react';
import * as resolve from 'table-resolver';
import LocalTime from '../../../components/Time/LocalTime';
import Label from '../../../components/Label/Label';
import DetailObject from '../../../components/Details/DetailObject';
import { Link } from 'react-router-dom';
import { ConfigIndicator } from '../../../components/ConfigValidation/ConfigIndicator';
import { DestinationRule, ObjectValidation, Subset } from '../../../types/IstioObjects';

interface ServiceInfoDestinationRulesProps extends EditorLink {
  destinationRules?: DestinationRule[];
  validations: { [key: string]: ObjectValidation };
}

class ServiceInfoDestinationRules extends React.Component<ServiceInfoDestinationRulesProps> {
  constructor(props: ServiceInfoDestinationRulesProps) {
    super(props);
  }

  headerFormat = (label, { column }) => <Table.Heading className={column.property}>{label}</Table.Heading>;
  cellFormat = (value, { column }) => {
    const props = column.cell.props;
    const className = props ? props.align : '';

    return <Table.Cell className={className}>{value}</Table.Cell>;
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
          property: 'trafficPolicy',
          header: {
            label: 'Traffic Policy',
            formatters: [this.headerFormat]
          },
          cell: {
            formatters: [this.cellFormat]
          }
        },
        {
          property: 'subsets',
          header: {
            label: 'Subsets',
            formatters: [this.headerFormat]
          },
          cell: {
            formatters: [this.cellFormat]
          }
        },
        {
          property: 'host',
          header: {
            label: 'Host',
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

  yamlLink(destinationRule: DestinationRule) {
    return (
      <Link to={this.props.editorLink + '?destinationrule=' + destinationRule.metadata.name + '&detail=yaml'}>
        View YAML
      </Link>
    );
  }

  validation(destinationRule: DestinationRule): ObjectValidation {
    return this.props.validations[destinationRule.metadata.name];
  }

  overviewLink(destinationRule: DestinationRule) {
    return (
      <Link to={this.props.editorLink + '?destinationrule=' + destinationRule.metadata.name + '&detail=overview'}>
        {destinationRule.metadata.name}
      </Link>
    );
  }

  rows() {
    return (this.props.destinationRules || []).map((destinationRule, vsIdx) => ({
      id: vsIdx,
      name: this.overviewLink(destinationRule),
      status: <ConfigIndicator id={vsIdx + '-config-validation'} validations={[this.validation(destinationRule)]} />,
      trafficPolicy: destinationRule.spec.trafficPolicy ? (
        <DetailObject name="" detail={destinationRule.spec.trafficPolicy} />
      ) : (
        'None'
      ),
      subsets:
        destinationRule.spec.subsets && destinationRule.spec.subsets.length > 0
          ? this.generateSubsets(destinationRule.spec.subsets)
          : 'None',
      host: destinationRule.spec.host ? <DetailObject name="" detail={destinationRule.spec.host} /> : undefined,
      createdAt: <LocalTime time={destinationRule.metadata.creationTimestamp || ''} />,
      resourceVersion: destinationRule.metadata.resourceVersion,
      actions: this.yamlLink(destinationRule)
    }));
  }

  generateKey() {
    return (
      'key_' +
      Math.random()
        .toString(36)
        .substr(2, 9)
    );
  }

  generateSubsets(subsets: Subset[]) {
    let childrenList: any = [];
    subsets.map(subset => {
      childrenList.push(
        <li key={this.generateKey() + '_k' + subset.name} style={{ marginBottom: '13px' }}>
          <Row>
            <Col xs={3}>
              <span style={{ paddingRight: '10px', paddingTop: '3px' }}>{subset.name}</span>{' '}
            </Col>
            <Col xs={4}>
              {Object.keys(subset.labels).map((key, _) => (
                <Label key={key} name={key} value={subset.labels[key]} />
              ))}
            </Col>
            <Col xs={4}>
              <DetailObject name={subset.trafficPolicy ? 'trafficPolicy' : ''} detail={subset.trafficPolicy} />
            </Col>
          </Row>
        </li>
      );
    });
    return <ul style={{ listStyleType: 'none', paddingLeft: '0px' }}>{childrenList}</ul>;
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

export default ServiceInfoDestinationRules;
