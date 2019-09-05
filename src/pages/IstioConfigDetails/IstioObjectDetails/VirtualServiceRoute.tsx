import * as React from 'react';
import { checkForPath, highestSeverity, severityToColor, severityToIconName } from '../../../types/ServiceInfo';
import { DestinationWeight, HTTPRoute, ObjectCheck, ObjectValidation, TCPRoute } from '../../../types/IstioObjects';
import { Icon } from 'patternfly-react';
import DetailObject from '../../../components/Details/DetailObject';
import { Link } from 'react-router-dom';
import { ServiceIcon } from '@patternfly/react-icons';
import { Table, TableBody, TableHeader, TableVariant } from '@patternfly/react-table';
import { Grid, GridItem, Tooltip, TooltipPosition } from '@patternfly/react-core';
import { ChartBullet } from '@patternfly/react-charts/dist/js/components/ChartBullet';

interface VirtualServiceRouteProps {
  name: string;
  namespace: string;
  kind: string;
  routes: any[];
  validation?: ObjectValidation;
}

class VirtualServiceRoute extends React.Component<VirtualServiceRouteProps> {
  columns() {
    return [
      {
        title: 'Status',
        props: {}
      },
      {
        title: 'Destination',
        props: {}
      },
      {
        title: '',
        props: {}
      },
      {
        title: '',
        props: {}
      },
      {
        title: 'Weight',
        props: {}
      }
    ];
  }

  rows(route: any, routeIndex: number) {
    let rows = [
      {
        cells: [
          { title: '' },
          { title: <strong>Host</strong> },
          { title: <strong>Subset</strong> },
          { title: <strong>Port</strong> },
          { title: '' }
        ]
      }
    ];

    rows = rows.concat(
      (route.route || []).map((routeItem, destinationIndex) => {
        const statusFrom = this.statusFrom(this.validation(), routeItem, routeIndex, destinationIndex);
        const isValid = statusFrom === '' ? true : false;
        let cells = [{ title: statusFrom }];

        if (routeItem.destination) {
          const destination = routeItem.destination;
          cells = cells.concat([
            { title: this.serviceLink(this.props.namespace, destination.host, isValid) },
            { title: destination.subset || '-' },
            { title: destination.port ? destination.port.number || '-' : '-' }
          ]);
        } else {
          cells = cells.concat([{ title: '-' }, { title: '-' }, { title: '-' }]);
        }

        return cells.concat([{ title: routeItem.weight ? routeItem.weight : '-' }]);
      })
    );

    return rows;
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
          <ServiceIcon />
        </Link>
      );
    }
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
        <Tooltip
          aria-label={'Validations for route ' + routeIndex + ' and destination ' + destinationIndex}
          position={TooltipPosition.left}
          enableFlip={true}
          content={this.infotipContent(checks)}
        >
          <Icon type="pf" name={iconName} />
        </Tooltip>
      );
    } else {
      return '';
    }
  }

  infotipContent(checks: ObjectCheck[]) {
    return checks.map((check, index) => {
      return this.objectCheckToHtml(check, index);
    });
  }

  objectCheckToHtml(object: ObjectCheck, i: number) {
    return (
      <div key={'validation-check-' + i}>
        <Icon type="pf" name={severityToIconName(object.severity)} />
        {'  '}
        {object.message}
      </div>
    );
  }

  bulletChartValues(routes: TCPRoute | HTTPRoute) {
    let weightSum: number = 0;
    return (routes.route || []).map(destinationWeight => {
      const destination = destinationWeight.destination;
      const destRepresentation = `${destination.host || '-'}_${destination.subset || '-'}_${destination.port || '-'}`;

      const routeSum = routes.route && routes.route.length === 1 ? 100 : destinationWeight.weight || 0;
      weightSum += routeSum;

      return {
        y: weightSum,
        name: `${destinationWeight.weight}_${destRepresentation}`
      };
    });
  }

  bulletChartLabels(datum: any) {
    const [percent, host, subset, port] = datum.name.split('_');
    let label = 'Max weight: 100';
    if (host) {
      label = `Weight: ${percent}\n Host: ${host}\n Subset: ${subset}\n Port: ${port}`;
    }
    return label;
  }

  renderTable(route: any, i: number) {
    return (
      <div key={'bulletchart-wrapper-' + i}>
        {(route.route || []).length > 1 && (
          <div style={{ margin: '0 20%' }}>
            <ChartBullet
              key={'bullet-chart-' + i}
              title={'Weight sum'}
              ariaDesc={'Routing percentage representation'}
              ariaTitle={'Traffic routing distribution'}
              maxDomain={{ y: 100 }}
              qualitativeRangeData={[{ name: 'Range', y: 100 }]}
              primarySegmentedMeasureData={this.bulletChartValues(route)}
              labels={this.bulletChartLabels}
              padding={{
                left: 150,
                right: 150
              }}
              width={600}
            />
          </div>
        )}
        <Table variant={TableVariant.compact} cells={this.columns()} rows={this.rows(route, i)}>
          <TableHeader />
          <TableBody />
        </Table>
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
    return (this.props.routes || []).map((route, i) => (
      <Grid key={'virtualservice-rule' + i}>
        <GridItem sm={12} md={12} lg={4}>
          <DetailObject
            name={this.props.kind + ' Route'}
            detail={route}
            exclude={['route']}
            validation={this.routeStatusMessage(route, i)}
          />
        </GridItem>
        <GridItem sm={12} md={12} lg={8}>
          {this.renderTable(route, i)}
        </GridItem>
      </Grid>
    ));
  }
}

export default VirtualServiceRoute;
