import * as React from 'react';
import { Col, Icon, Row, Table } from 'patternfly-react';
import { globalChecks, severityToColor, severityToIconName, validationToSeverity } from '../../../../types/ServiceInfo';
import { DestinationRule, ObjectValidation, Subset } from '../../../../types/IstioObjects';
import LocalTime from '../../../../components/Time/LocalTime';
import DetailObject from '../../../../components/Details/DetailObject';
import * as resolve from 'table-resolver';
import Label from '../../../../components/Label/Label';

interface DestinationRuleProps {
  namespace: string;
  destinationRule: DestinationRule;
  validations: { [key: string]: ObjectValidation };
}

class DestinationRuleDetail extends React.Component<DestinationRuleProps> {
  constructor(props: DestinationRuleProps) {
    super(props);
  }

  validation(destinationRule: DestinationRule): ObjectValidation | undefined {
    if (this.props.validations && this.props.validations[destinationRule.metadata.name]) {
      return this.props.validations[destinationRule.metadata.name];
    }
    return undefined;
  }

  globalStatus(rule: DestinationRule) {
    let validation = this.validation(rule);
    if (!validation) {
      return '';
    }
    let checks = globalChecks(validation);
    let severity = validationToSeverity(validation);
    let iconName = severityToIconName(severity);
    let color = severityToColor(severity);
    let message = checks.map(check => check.message).join(',');

    if (!message.length) {
      if (validation && !validation.valid) {
        message = 'Not all checks passed!';
      }
    }

    if (message.length) {
      return (
        <div>
          <p style={{ color: color }}>
            <Icon type="pf" name={iconName} /> {message}
          </p>
        </div>
      );
    } else {
      return '';
    }
  }

  headerFormat = (label, { column }) => <Table.Heading className={column.property}>{label}</Table.Heading>;
  cellFormat = (value, { column }) => {
    const props = column.cell.props;
    const className = props ? props.align : '';

    return <Table.Cell className={className}>{value}</Table.Cell>;
  };
  columnsSubsets() {
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
          property: 'labelSubset',
          header: {
            label: 'Labels',
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
        }
      ]
    };
  }

  rowsSubset(subsets: Subset[]) {
    return subsets.map((subset, vsIdx) => ({
      id: vsIdx,
      name: subset.name,
      labelSubset: Object.keys(subset.labels).map((key, _) => (
        <Label key={key} name={key} value={subset.labels[key]} />
      )),
      trafficPolicy: <DetailObject name={subset.trafficPolicy ? 'trafficPolicy' : ''} detail={subset.trafficPolicy} />
    }));
  }
  generateSubsets(subsets: Subset[]) {
    return (
      <Table.PfProvider
        columns={this.columnsSubsets().columns}
        striped={true}
        bordered={true}
        hover={true}
        dataTable={true}
      >
        <Table.Header headerRows={resolve.headerRows(this.columnsSubsets())} />
        <Table.Body rows={this.rowsSubset(subsets)} rowKey="id" />
      </Table.PfProvider>
    );
  }

  rawConfig(destinationRule: DestinationRule) {
    return (
      <div className="card-pf-body" key={'virtualServiceConfig'}>
        <h4>DestinationRule: {destinationRule.metadata.name}</h4>
        <div>{this.globalStatus(destinationRule)}</div>
        <div>
          <strong>Created at</strong>: <LocalTime time={destinationRule.metadata.creationTimestamp || ''} />
        </div>
        <div>
          <strong>Resource Version</strong>: {destinationRule.metadata.resourceVersion}
        </div>
        {destinationRule.spec.host && (
          <div>
            <strong>Host</strong>: {destinationRule.spec.host}
          </div>
        )}
        {destinationRule.spec.trafficPolicy && (
          <div>
            <strong>Traffic Policy</strong>
            <DetailObject name="" detail={destinationRule.spec.trafficPolicy} />
          </div>
        )}
      </div>
    );
  }

  render() {
    return (
      <Row className="row-cards-pf">
        <Col xs={12} sm={12} md={3} lg={3}>
          {this.rawConfig(this.props.destinationRule)}
        </Col>
        {this.props.destinationRule.spec.subsets && (
          <Col xs={12} sm={12} md={3} lg={3}>
            <Row className="card-pf-body" key={'destinationRulesSubsets'}>
              <Col>
                <strong> Subsets : </strong>
                {this.generateSubsets(this.props.destinationRule.spec.subsets)}
              </Col>
            </Row>
          </Col>
        )}
      </Row>
    );
  }
}

export default DestinationRuleDetail;
