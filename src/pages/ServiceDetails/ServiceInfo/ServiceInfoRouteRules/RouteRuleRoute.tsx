import * as React from 'react';
import * as resolve from 'table-resolver';
import {
  checkForPath,
  DestinationWeight,
  highestSeverity,
  ObjectValidation,
  severityToIconName,
  ObjectCheck
} from '../../../../types/ServiceInfo';
import { Row, Col, Table, Icon, OverlayTrigger, Popover, BulletChart, Tooltip } from 'patternfly-react';
import Badge from '../../../../components/Badge/Badge';
import { PfColors } from '../../../../components/Pf/PfColors';

import './RouteRuleRoute.css';

interface RouteRuleRouteProps {
  name: string;
  route: DestinationWeight[];
  validations: { [key: string]: ObjectValidation };
}

const PFBlueColors = [
  PfColors.Blue,
  PfColors.Blue500,
  PfColors.Blue600,
  PfColors.Blue300,
  PfColors.Blue200,
  PfColors.Blue100
];

class RouteRuleRoute extends React.Component<RouteRuleRouteProps> {
  headerFormat = (label, { column }) => <Table.Heading className={column.property}>{label}</Table.Heading>;
  cellFormat = value => <Table.Cell>{value}</Table.Cell>;

  constructor(props: RouteRuleRouteProps) {
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
          property: 'weight',
          header: {
            label: 'Weights',
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
    return (this.props.route || []).map((routeItem, u) => ({
      id: u,
      status: this.statusFrom(this.validation(), routeItem, u),
      weight: routeItem.weight ? routeItem.weight : '-',
      labels: this.labelsFrom(routeItem.labels)
    }));
  }

  bulletChartValues = () => {
    return (this.props.route || []).map((routeItem, u) => ({
      value: this.props.route.length === 1 ? 100 : routeItem.weight,
      title: `${u}_${routeItem.weight}`,
      color: PFBlueColors[u % PFBlueColors.length],
      tooltipFunction: () => {
        const badges = this.labelsFrom(routeItem.labels);
        return (
          <Tooltip id={`${u}_${routeItem.weight}`} key={`${u}_${routeItem.weight}`}>
            {badges}
          </Tooltip>
        );
      }
    }));
  };
  validation(): ObjectValidation {
    return this.props.validations[this.props.name];
  }
  statusFrom(validation: ObjectValidation, routeItem: DestinationWeight, index: number) {
    let checks = checkForPath(validation, 'spec/route[' + index + ']/weight/' + routeItem.weight);
    checks.push(...checkForPath(validation, 'spec/route[' + index + ']/labels'));
    let severity = highestSeverity(checks);
    let iconName = severity ? severityToIconName(severity) : 'ok';
    if (iconName !== 'ok') {
      return (
        <OverlayTrigger
          placement={'right'}
          overlay={this.infotipContent(checks)}
          trigger={['hover', 'focus']}
          rootClose={false}
        >
          <Icon type="pf" name={iconName} />
        </OverlayTrigger>
      );
    } else {
      return '';
    }
  }
  infotipContent(checks: ObjectCheck[]) {
    return (
      <Popover id={this.props.name + '-weight-tooltip'}>
        {checks.map(check => {
          return this.objectCheckToHtml(check);
        })}
      </Popover>
    );
  }
  labelsFrom(routeLabels: { [key: string]: string }) {
    return Object.keys(routeLabels || {}).map(key => (
      <Badge
        key={key}
        scale={0.8}
        style="plastic"
        color={PfColors.Green400}
        leftText={key}
        rightText={routeLabels[key] ? routeLabels[key] : ''}
      />
    ));
  }
  objectCheckToHtml(object: ObjectCheck) {
    return (
      <Row>
        <Col xs={1}>
          <Icon type="pf" name={severityToIconName(object.severity)} />
        </Col>
        <Col xs={10} style={{ marginLeft: '-20px' }}>
          {object.message}
        </Col>
      </Row>
    );
  }
  render() {
    return (
      <div style={{ marginTop: '30px' }}>
        <div>
          <BulletChart
            id="bar-chart-1"
            label="Load"
            stacked={true}
            thresholdWarning={-1}
            thresholdError={-1}
            details="Versions weight"
            values={this.bulletChartValues()}
            ranges={[{ value: 100 }]}
          />
        </div>
        <Table.PfProvider striped={true} bordered={true} hover={true} dataTable={true} columns={this.columns().columns}>
          <Table.Header headerRows={resolve.headerRows(this.columns())} />
          <Table.Body rows={this.rows()} rowKey="id" />
        </Table.PfProvider>
      </div>
    );
  }
}
export default RouteRuleRoute;
