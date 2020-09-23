import * as React from 'react';
import { HTTPRoute, TCPRoute } from '../../../types/IstioObjects';
import { ChartBullet } from '@patternfly/react-charts/dist/js/components/ChartBullet';

interface VirtualServiceRouteProps {
  name: string;
  namespace: string;
  kind: string;
  routes: any[];
}

class VirtualServiceRoute extends React.Component<VirtualServiceRouteProps> {
  bulletChartValues(routes: TCPRoute | HTTPRoute) {
    let weightSum: number = 0;
    return (routes.route || []).map(destinationWeight => {
      const destination = destinationWeight.destination;
      const destRepresentation = `${destination.host || '-'}_${destination.subset || '-'}_${destination.port || '-'}`;

      const routeSum = routes.route && routes.route.length === 1 ? 100 : destinationWeight.weight || 0;
      weightSum += routeSum;
      const dWeight = destinationWeight.weight ? destinationWeight.weight : 100;

      return {
        y: weightSum,
        name: `${dWeight}_${destRepresentation}`
      };
    });
  }

  bulletChartLabels(data: any) {
    const datum = data.datum;
    const [percent, host] = datum.name.split('_');
    let label = 'Weight';
    if (host) {
      label = `${percent} %`;
    }
    return label;
  }

  renderWeights(route: any, i: number) {
    return (
      <>
        {(route.route || []).length >= 1 && (
          <ChartBullet
            key={'bullet-chart-' + i}
            ariaDesc={'Routing percentage representation'}
            ariaTitle={'Traffic routing distribution'}
            maxDomain={{ y: 100 }}
            height={80}
            qualitativeRangeData={[{ name: 'Range', y: 100 }]}
            primarySegmentedMeasureData={this.bulletChartValues(route)}
            labels={this.bulletChartLabels}
            padding={'80 0 0 0'}
          />
        )}
      </>
    );
  }

  render() {
    return (this.props.routes || []).map((route, i) => {
      const marginTop = i === 0 ? -30 : 0;
      return (
        <div key={'bulletchart-wrapper-' + i} style={{ marginTop: marginTop }}>
          {this.renderWeights(route, i)}
        </div>
      );
    });
  }
}

export default VirtualServiceRoute;
