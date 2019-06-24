import * as React from 'react';
import { Col, Icon, Row, Table } from 'patternfly-react';
import { globalChecks, severityToColor, severityToIconName, validationToSeverity } from '../../../types/ServiceInfo';
import { DestinationRule, ObjectValidation, Subset } from '../../../types/IstioObjects';
import LocalTime from '../../../components/Time/LocalTime';
import DetailObject from '../../../components/Details/DetailObject';
import * as resolve from 'table-resolver';
import Label from '../../../components/Label/Label';
import { Link } from 'react-router-dom';

interface DestinationRuleProps {
  namespace: string;
  destinationRule: DestinationRule;
  validation?: ObjectValidation;
}

class DestinationRuleDetail extends React.Component<DestinationRuleProps> {
  validation(_destinationRule: DestinationRule): ObjectValidation | undefined {
    return this.props.validation;
  }

  globalStatus(rule: DestinationRule) {
    const validation = this.validation(rule);
    if (!validation) {
      return '';
    }
    const checks = globalChecks(validation);
    const severity = validationToSeverity(validation);
    const iconName = severityToIconName(severity);
    const color = severityToColor(severity);
    let message = checks.map(check => check.message).join(',');

    if (!message.length) {
      if (!validation.valid) {
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
      labelSubset: subset.labels
        ? Object.keys(subset.labels).map((key, _) => <Label key={key} name={key} value={subset.labels[key]} />)
        : [],
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

  serviceLink(namespace: string, host: string, isValid: boolean): any {
    if (!host) {
      return '-';
    }
    // TODO Full FQDN are not linked yet, it needs more checks in crossnamespace scenarios + validation of target
    if (host.indexOf('.') > -1 || !isValid) {
      return host;
    } else {
      return (
        <Link to={'/namespaces/' + namespace + '/services/' + host}>
          {host + ' '}
          <Icon type="pf" name="service" />
        </Link>
      );
    }
  }

  rawConfig(destinationRule: DestinationRule) {
    const globalStatus = this.globalStatus(destinationRule);
    const isValid = globalStatus === '' ? true : false;
    return (
      <div className="card-pf-body" key={'virtualServiceConfig'}>
        <h4>DestinationRule: {destinationRule.metadata.name}</h4>
        <div>{globalStatus}</div>
        <div>
          <strong>Created at</strong>: <LocalTime time={destinationRule.metadata.creationTimestamp || ''} />
        </div>
        <div>
          <strong>Resource Version</strong>: {destinationRule.metadata.resourceVersion}
        </div>
        {destinationRule.spec.host && (
          <div>
            <strong>Host</strong>:{' '}
            {this.serviceLink(destinationRule.metadata.namespace || '', destinationRule.spec.host, isValid)}
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
