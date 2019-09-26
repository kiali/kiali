import * as React from 'react';
import { checkForPath, highestSeverity } from '../../../types/ServiceInfo';
import { DestinationWeight, HTTPRoute, ObjectValidation, TCPRoute, ValidationTypes } from '../../../types/IstioObjects';
import DetailObject from '../../../components/Details/DetailObject';
import { Link } from 'react-router-dom';
import { ServiceIcon } from '@patternfly/react-icons';
import { Table, TableBody, TableHeader, TableVariant } from '@patternfly/react-table';
import { Grid, GridItem, Text, TextVariants } from '@patternfly/react-core';
import { ChartBullet } from '@patternfly/react-charts/dist/js/components/ChartBullet';
import ValidationList from '../../../components/Validations/ValidationList';

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
        const checks = this.checksFrom(this.validation(), routeItem, routeIndex, destinationIndex);
        const validation = <ValidationList checks={checks} />;
        const severity = highestSeverity(checks);
        const isValid = severity === ValidationTypes.Correct;
        let cells;

        if (routeItem.destination) {
          const destination = routeItem.destination;
          cells = [
            { title: validation },
            { title: this.serviceLink(this.props.namespace, destination.host, isValid) },
            { title: destination.subset || '-' },
            { title: destination.port ? destination.port.number || '-' : '-' },
            { title: routeItem.weight ? routeItem.weight : '-' }
          ];
        } else {
          cells = [
            { title: validation },
            { title: '-' },
            { title: '-' },
            { title: '-' },
            { title: routeItem.weight ? routeItem.weight : '-' }
          ];
        }

        return cells;
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

  checksFrom(validation: ObjectValidation, routeItem: DestinationWeight, routeIndex: number, destinationIndex: number) {
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

    checks.push(
      ...checkForPath(
        validation,
        'spec/' +
          this.props.kind.toLowerCase() +
          '[' +
          routeIndex +
          ']/route[' +
          destinationIndex +
          ']/destination/host'
      )
    );

    return checks;
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

  bulletChartLabels(data: any) {
    const datum = data.datum;
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
      severity
    };
  }

  render() {
    return (this.props.routes || []).map((route, i) => (
      <Grid key={'virtualservice-rule' + i}>
        <GridItem sm={12} md={12} lg={4}>
          <Text component={TextVariants.h3}>{this.props.kind + ' Route'}</Text>
          <DetailObject name={''} detail={route} exclude={['route']} validation={this.routeStatusMessage(route, i)} />
        </GridItem>
        <GridItem sm={12} md={12} lg={8}>
          {this.renderTable(route, i)}
        </GridItem>
      </Grid>
    ));
  }
}

export default VirtualServiceRoute;
