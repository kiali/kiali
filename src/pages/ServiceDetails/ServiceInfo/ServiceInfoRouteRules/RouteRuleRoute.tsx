import * as React from 'react';
import * as resolve from 'table-resolver';
import { checkForPath, DestinationWeight, ObjectValidation, severityToIconName } from '../../../../types/ServiceInfo';
import { Table, Icon, OverlayTrigger, Popover } from 'patternfly-react';
import Badge from '../../../../components/Badge/Badge';
import { PfColors } from '../../../../components/Pf/PfColors';

import './RouteRuleRoute.css';

interface RouteRuleRouteProps {
  name: string;
  route: DestinationWeight[];
  validations: Map<string, ObjectValidation>;
}

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
      status: this.statusFrom(this.validation(), routeItem),
      weight: routeItem.weight ? routeItem.weight : '-',
      labels: this.labelsFrom(routeItem.labels)
    }));
  }

  validation(): ObjectValidation {
    return this.props.validations[this.props.name];
  }

  statusFrom(validation: ObjectValidation, routeItem: DestinationWeight) {
    let check = checkForPath(validation, 'spec/route/weight/' + routeItem.weight)[0];
    let iconName = check ? severityToIconName(check.severity) : 'ok';
    let message = check ? check.message : 'All checks passed!';

    if (iconName !== 'ok') {
      return (
        <OverlayTrigger
          placement={'right'}
          overlay={this.infotipContent(message)}
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

  infotipContent(message: string) {
    return <Popover id={this.props.name + '-weight-tooltip'}>{message}</Popover>;
  }

  labelsFrom(routeLabels: Map<String, String>) {
    return Object.keys(routeLabels || new Map()).map((key, n) => (
      <Badge
        scale={0.8}
        style="plastic"
        color={PfColors.Green}
        leftText={key}
        rightText={routeLabels[key] ? routeLabels[key] : ''}
      />
    ));
  }

  render() {
    return (
      <div style={{ marginTop: '30px' }}>
        <Table.PfProvider striped={true} bordered={true} hover={true} dataTable={true} columns={this.columns().columns}>
          <Table.Header headerRows={resolve.headerRows(this.columns())} />
          <Table.Body rows={this.rows()} />
        </Table.PfProvider>
      </div>
    );
  }
}

export default RouteRuleRoute;
