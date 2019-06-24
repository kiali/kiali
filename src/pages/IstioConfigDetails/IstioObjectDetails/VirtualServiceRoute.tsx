import * as React from 'react';
import * as resolve from 'table-resolver';
import { checkForPath, highestSeverity, severityToColor, severityToIconName } from '../../../types/ServiceInfo';
import {
  Destination,
  DestinationWeight,
  HTTPRoute,
  ObjectCheck,
  ObjectValidation,
  TCPRoute
} from '../../../types/IstioObjects';
import { BulletChart, Col, Icon, OverlayTrigger, Popover, Row, Table, Tooltip } from 'patternfly-react';
import DetailObject from '../../../components/Details/DetailObject';
import { PfColors } from '../../../components/Pf/PfColors';
import { Link } from 'react-router-dom';

interface VirtualServiceRouteProps {
  name: string;
  namespace: string;
  kind: string;
  routes: any[];
  validation?: ObjectValidation;
}

const PFBlueColors = [
  PfColors.Blue,
  PfColors.Blue500,
  PfColors.Blue600,
  PfColors.Blue300,
  PfColors.Blue200,
  PfColors.Blue100
];

class VirtualServiceRoute extends React.Component<VirtualServiceRouteProps> {
  cellFormat = value => <Table.Cell>{value}</Table.Cell>;
  headerFormat = (label, { column }) => {
    const className = column.property || column.header.label.toLowerCase();
    const colSpan = column.header && column.header.props ? column.header.props.colSpan || '' : '';

    return (
      <Table.Heading colSpan={colSpan} className={className}>
        {label}
      </Table.Heading>
    );
  };

  columns() {
    return {
      columns: [
        {
          header: {
            label: 'Status',
            formatters: [this.headerFormat],
            props: {
              colSpan: 1
            }
          },
          cell: {
            formatters: [this.cellFormat]
          },
          children: [
            {
              property: 'status.value',
              header: {
                label: '',
                formatters: [this.headerFormat]
              },
              cell: {
                formatters: [this.cellFormat]
              }
            }
          ]
        },
        {
          header: {
            label: 'Destination',
            formatters: [this.headerFormat],
            props: {
              colSpan: 3
            }
          },
          cell: {
            formatters: [this.cellFormat]
          },
          children: [
            {
              property: 'destination.host',
              header: {
                label: 'Host',
                formatters: [this.headerFormat]
              },
              cell: {
                formatters: [this.cellFormat]
              }
            },
            {
              property: 'destination.subset',
              header: {
                label: 'Subset',
                formatters: [this.headerFormat]
              },
              cell: {
                formatters: [this.cellFormat]
              }
            },
            {
              property: 'destination.port',
              header: {
                label: 'Port',
                formatters: [this.headerFormat]
              },
              cell: {
                formatters: [this.cellFormat]
              }
            }
          ]
        },
        {
          header: {
            label: 'Weights',
            formatters: [this.headerFormat],
            props: {
              colSpan: 1
            }
          },
          cell: {
            formatters: [this.cellFormat]
          },
          children: [
            {
              property: 'weight.value',
              header: {
                label: '',
                formatters: [this.headerFormat]
              },
              cell: {
                formatters: [this.cellFormat]
              }
            }
          ]
        }
      ]
    };
  }

  rows(route: any, routeIndex: number) {
    return (route.route || []).map((routeItem, destinationIndex) => {
      const statusFrom = this.statusFrom(this.validation(), routeItem, routeIndex, destinationIndex);
      const isValid = statusFrom === '' ? true : false;
      return {
        id: destinationIndex,
        status: { value: statusFrom },
        weight: { value: routeItem.weight ? routeItem.weight : '-' },
        destination: this.destinationFrom(routeItem, destinationIndex, isValid)
      };
    });
  }

  validation(): ObjectValidation {
    return this.props.validation ? this.props.validation : ({} as ObjectValidation);
  }

  statusFrom(validation: ObjectValidation, routeItem: DestinationWeight, routeIndex: number, destinationIndex: number) {
    const checks = checkForPath(
      validation,
      'spec/' +
        this.props.kind.toLowerCase() +
        '[' +
        routeIndex +
        ']/route[' +
        destinationIndex +
        ']/weight/' +
        routeItem.weight
    );
    checks.push(
      ...checkForPath(
        validation,
        'spec/' + this.props.kind.toLowerCase() + '[' + routeIndex + ']/route[' + destinationIndex + ']/destination'
      )
    );

    const severity = highestSeverity(checks);
    const iconName = severity ? severityToIconName(severity) : 'ok';
    if (iconName !== 'ok') {
      return (
        <OverlayTrigger
          placement={'left'}
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

  destinationFrom(destinationWeight: DestinationWeight, _i: number, isValid: boolean) {
    const destination = destinationWeight.destination;
    if (destination) {
      return {
        host: this.serviceLink(this.props.namespace, destination.host, isValid),
        subset: destination.subset || '-',
        port: destination.port ? destination.port.number || '-' : '-'
      };
    } else {
      return { host: '-', subset: '-', port: '-' };
    }
  }

  infotipContent(checks: ObjectCheck[]) {
    return (
      <Popover id={this.props.name + '-weight-tooltip'}>
        {checks.map((check, index) => {
          return this.objectCheckToHtml(check, index);
        })}
      </Popover>
    );
  }

  objectCheckToHtml(object: ObjectCheck, i: number) {
    return (
      <Row key={'objectCheck-' + i}>
        <Col xs={1}>
          <Icon type="pf" name={severityToIconName(object.severity)} />
        </Col>
        <Col xs={10} style={{ marginLeft: '-20px' }}>
          {object.message}
        </Col>
      </Row>
    );
  }

  bulletChartValues(routes: TCPRoute | HTTPRoute) {
    return (routes.route || []).map((destinationWeight, u) => ({
      value: routes.route && routes.route.length === 1 ? 100 : destinationWeight.weight,
      title: `${u}_${destinationWeight.weight}`,
      color: PFBlueColors[u % PFBlueColors.length],
      tooltipFunction: () => {
        const badges = this.renderDestination(destinationWeight.destination);
        return (
          <Tooltip id={`${u}_${destinationWeight.weight}`} key={`${u}_${destinationWeight.weight}`}>
            <div className="label-collection">{badges}</div>
          </Tooltip>
        );
      }
    }));
  }

  renderDestination(destination: Destination) {
    if (destination) {
      return (
        <ul style={{ listStyleType: 'none', paddingLeft: '15px' }}>
          <li>Host: {destination.host || '-'} </li>
          <li>Subset: {destination.subset || '-'} </li>
          <li>Port: {destination.port ? destination.port.number : '-'} </li>
        </ul>
      );
    } else {
      return undefined;
    }
  }

  renderTable(route: any, i: number) {
    const resolvedColumns = resolve.columnChildren(this.columns());
    const resolvedRows = resolve.resolve({
      columns: resolvedColumns,
      method: resolve.nested
    })(this.rows(route, i));

    return (
      <div key={'bulletchart-wrapper-' + i} style={{ marginTop: '30px' }}>
        {(route.route || []).length > 1 && (
          <div>
            <BulletChart
              key={'bullet-chart-' + i}
              label="Weight sum"
              stacked={true}
              thresholdWarning={-1}
              thresholdError={-1}
              values={this.bulletChartValues(route)}
              ranges={[{ value: 100 }]}
            />
          </div>
        )}
        <Table.PfProvider columns={resolvedColumns} striped={true} bordered={true} hover={true} dataTable={true}>
          <Table.Header headerRows={resolve.headerRows(this.columns())} />
          <Table.Body rows={resolvedRows} rowKey="id" />
        </Table.PfProvider>
      </div>
    );
  }

  routeStatusMessage(_route: HTTPRoute | TCPRoute, routeIndex: number) {
    const checks = checkForPath(
      this.validation(),
      'spec/' + this.props.kind.toLowerCase() + '[' + routeIndex + ']/route'
    );
    const severity = highestSeverity(checks);

    return {
      message: checks.map(check => check.message).join(','),
      icon: severityToIconName(severity),
      color: severityToColor(severity)
    };
  }

  render() {
    return (
      <div>
        {(this.props.routes || []).map((route, i) => (
          <div key={'virtualservice-rule' + i} className="row-cards-pf">
            <Row>
              <Col xs={12} sm={12} md={3} lg={3}>
                <DetailObject
                  name={this.props.kind + ' Route'}
                  detail={route}
                  exclude={['route']}
                  validation={this.routeStatusMessage(route, i)}
                />
              </Col>
              <Col xs={12} sm={12} md={5} lg={5}>
                {this.renderTable(route, i)}
              </Col>
            </Row>
            <hr />
          </div>
        ))}
      </div>
    );
  }
}

export default VirtualServiceRoute;
